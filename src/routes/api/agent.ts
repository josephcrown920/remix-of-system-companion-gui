import { createFileRoute } from "@tanstack/react-router";
import { GATEWAY, ARK_BASE, apiKey, arkKey } from "@/lib/gateway.server";
import { AGENTS, agentById } from "@/lib/agents";
import { readSse, partialReply } from "@/lib/agent-stream";
import { z } from "zod";

type Body = {
  agent: string;
  brief: string;
  history?: { role: "user" | "assistant"; text: string }[];
  assets: { id: string; name: string; kind: string; dur: number }[];
  clips: { id: string; assetId: string; track: string; start: number; dur: number }[];
};

const bodySchema = z.object({
  agent: z.string().max(80), brief: z.string().min(1).max(20000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(20000) })).max(8).optional(),
  assets: z.array(z.object({ id: z.string().max(100), name: z.string().max(500), kind: z.enum(["image", "video", "audio"]), dur: z.number().finite().nonnegative() })).max(1000),
  clips: z.array(z.object({ id: z.string().max(100), assetId: z.string().max(100), track: z.enum(["V1", "V2", "V3", "A1", "A2"]), start: z.number().finite().nonnegative(), dur: z.number().finite().nonnegative() })).max(2000),
});

const LOOKS = "none, gold hour, noir, violet dusk, teal & orange, bleach, dreamy, crimson";

const BASE_SYSTEM = `You are an AI video co-editor working inside a multi-track non-linear editor.
Tracks, top to bottom: V3 (titles/overlays), V2 (b-roll/inserts), V1 (main footage), A1 (dialogue/VO), A2 (music/SFX).
You receive the user's media bin and the current timeline, then respond with edit decisions.

Reply with ONLY a JSON object, no markdown fence:
{
  "reply": "short conversational answer to the editor, first person, under 60 words",
  "steps": ["short log lines describing what you did, e.g. 'Cut rush_02 at 00:04:12'"],
  "actions": [ ... ]
}
Action shapes (seconds, decimals allowed):
{"op":"add","assetId":"<id from media bin>","track":"V1","start":0,"dur":4,"name":"optional label"}
{"op":"move","clipId":"<id>","track":"V2","start":3.5}
{"op":"trim","clipId":"<id>","dur":2.5}
{"op":"split","clipId":"<id>","at":1.8}
{"op":"remove","clipId":"<id>"}
{"op":"set","clipId":"<id>","volume":0.4,"opacity":0.8,"speed":1.5,"filter":"noir"}
Looks: ${LOOKS}.
Only use assetIds and clipIds that exist. Never leave gaps on V1 unless asked. Keep audio under the video it belongs to.
If the media bin is empty, ask for files and return an empty actions array.`;

const ORCHESTRATOR_SYSTEM = `${BASE_SYSTEM}

You are the ORCHESTRATOR: you run a crew of specialist editing agents and answer on their behalf.
Crew: ${AGENTS.filter((a) => a.available && a.id !== "orchestrator").map((a) => `${a.name} (${a.role})`).join("; ")}.
Also add a "crew" field: an array of 1-3 short strings naming which specialists you routed this brief to and why, e.g. "Claude Codex — timecode-accurate cuts".
Begin your steps with the routing decision, then the concrete edits you made.`;

const SPECIALIST_BRIEFS = [
  { id: "astra", task: "Direct pacing, visual structure, and the overall creative arc." },
  { id: "codex", task: "Propose precise timeline cuts, trims, track placement, and assembly." },
  { id: "fable", task: "Strengthen story clarity, emotion, and the ending." },
] as const;

function extractJson(text: string) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { reply: text.slice(0, 400), steps: [], actions: [], crew: [] };
  try {
    const p = JSON.parse(m[0]) as Record<string, unknown>;
    return {
      reply: typeof p["reply"] === "string" ? p["reply"] : "Done.",
      steps: Array.isArray(p["steps"]) ? (p["steps"] as string[]).slice(0, 12) : [],
      actions: Array.isArray(p["actions"]) ? p["actions"] : [],
      crew: Array.isArray(p["crew"]) ? (p["crew"] as string[]).slice(0, 4) : [],
    };
  } catch {
    return { reply: text.slice(0, 400), steps: [], actions: [], crew: [] };
  }
}

async function runOpenAI(model: string, key: string, system: string, user: string, history: Body["history"], onText?: (text: string) => void, signal?: AbortSignal) {
  const messages = [
    { role: "system", content: system },
    ...(history ?? []).slice(-8).map((h) => ({ role: h.role, content: h.text })),
    { role: "user", content: user },
  ];
  const res = await fetch(`${GATEWAY}/v1/chat/completions`, {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model, messages, reasoning_effort: "low", max_completion_tokens: 4000, stream: true, response_format: { type: "json_object" } }),
  });
  if (!res.ok) return { error: await res.text(), status: res.status };
  if (!res.body) return { error: "Empty provider response", status: 502 };
  let text = "";
  let streamError = false;
  await readSse(res.body, (_event, data) => {
    if (data === "[DONE]") return;
    const frame = JSON.parse(data) as { error?: unknown; choices?: { delta?: { content?: string } }[] };
    if (frame.error) { streamError = true; return; }
    const delta = frame.choices?.[0]?.delta?.content;
    if (delta) { text += delta; onText?.(text); }
  });
  return streamError ? { error: "Provider stream failed", status: 502 } : { text };
}

async function runModelArk(model: string, system: string, user: string, history: Body["history"], onText?: (text: string) => void, signal?: AbortSignal) {
  const key = arkKey();
  if (!key) {
    return { error: "ModelArk is not connected on this workspace. Add a ModelArk API key to use these agents.", status: 401 };
  }
  const messages = [
    { role: "system", content: system },
    ...(history ?? []).slice(-8).map((h) => ({ role: h.role, content: h.text })),
    { role: "user", content: user },
  ];
  const res = await fetch(`${ARK_BASE}/chat/completions`, {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.4, stream: true }),
  });
  if (!res.ok) return { error: await res.text(), status: res.status };
  if (!res.body) return { error: "Empty provider response", status: 502 };
  let text = "";
  let streamError = false;
  await readSse(res.body, (_event, data) => {
    if (data === "[DONE]") return;
    const frame = JSON.parse(data) as { error?: unknown; choices?: { delta?: { content?: string } }[] };
    if (frame.error) { streamError = true; return; }
    const delta = frame.choices?.[0]?.delta?.content;
    if (delta) { text += delta; onText?.(text); }
  });
  return streamError ? { error: "Provider stream failed", status: 502 } : { text };
}

async function runAnthropic(model: string, key: string, system: string, user: string, history: Body["history"], onText?: (text: string) => void, signal?: AbortSignal) {
  const messages = [
    ...(history ?? []).slice(-8).map((h) => ({ role: h.role, content: h.text })),
    { role: "user" as const, content: user },
  ];
  const res = await fetch(`${GATEWAY}/v1/messages`, {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model, max_tokens: 6000, system, messages, stream: true }),
  });
  if (!res.ok || !res.body) return { error: await res.text(), status: res.status };
  let text = "";
  let streamError = false;
  await readSse(res.body, (event, data) => {
    const frame = JSON.parse(data) as { type?: string; delta?: { type?: string; text?: string } };
    if (event === "error" || frame.type === "error") { streamError = true; return; }
    if (frame.type === "content_block_delta" && frame.delta?.type === "text_delta") {
      text += frame.delta.text ?? "";
      onText?.(text);
    }
  });
  if (streamError) return { error: "Provider stream failed", status: 502 };
  return { text };
}

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsedBody.success) return Response.json({ reply: "Please send a valid creative brief." }, { status: 400 });
        const b = parsedBody.data;
        const agent = agentById(b.agent);
        const abort = new AbortController();
        request.signal.addEventListener("abort", () => abort.abort(), { once: true });
        let closed = false;
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const emit = (event: string, data: unknown) => {
              if (!closed && !abort.signal.aborted) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };
            const json = (value: unknown, status = 200) => {
              emit(status >= 400 ? "error" : "done", value);
              return undefined;
            };
            const onText = (text: string) => emit("reply", { text: partialReply(text) });
            const heartbeat = setInterval(() => emit("ping", {}), 15000);
            const execute = async () => {

        if (!agent.available || !agent.model) {
          return json({ reply: `${agent.name} isn't available on this workspace yet. Pick another editor.`, steps: [], actions: [], crew: [] });
        }

        const system = agent.id === "orchestrator" ? ORCHESTRATOR_SYSTEM : BASE_SYSTEM;
        const user = [
          `MEDIA BIN:\n${b.assets.length ? b.assets.map((a) => `- ${a.id} | ${a.name} | ${a.kind} | ${a.dur.toFixed(1)}s`).join("\n") : "(empty)"}`,
          `TIMELINE:\n${b.clips.length ? b.clips.map((c) => `- ${c.id} | asset ${c.assetId} | ${c.track} | ${c.start.toFixed(1)}s → ${(c.start + c.dur).toFixed(1)}s`).join("\n") : "(empty)"}`,
          `BRIEF: ${b.brief}`,
        ].join("\n\n");

        let out: { text?: string; error?: string; status?: number };
        if (agent.id === "orchestrator") {
          const key = apiKey();
          const modelArkAgents = AGENTS.filter((candidate) => candidate.available && candidate.api === "modelark" && candidate.model);
          const specialists = [
            ...SPECIALIST_BRIEFS.map((specialist) => ({ ...specialist, model: agentById(specialist.id).model, api: agentById(specialist.id).api })),
            ...modelArkAgents.map((specialist) => ({ id: specialist.id, task: specialist.role, model: specialist.model, api: specialist.api })),
          ].filter((specialist) => specialist.model);
          const results = await Promise.all(specialists.map(async (specialist) => {
            const specialistSystem = `${BASE_SYSTEM}\nYou are ${agentById(specialist.id).name}. ${specialist.task} Return advice and proposed actions for the Orchestrator.`;
            const response = specialist.api === "modelark"
              ? await runModelArk(specialist.model ?? "", specialistSystem, user, b.history)
              : specialist.api === "anthropic"
                ? await runAnthropic(specialist.model ?? "", key, specialistSystem, user, b.history)
                : await runOpenAI(specialist.model ?? "", key, specialistSystem, user, b.history, undefined, abort.signal);
            return { name: agentById(specialist.id).name, task: specialist.task, ...response };
          }));
          const successful = results.filter((result) => result.text);
          const report = successful.map((result) => `${result.name}: ${result.text}`).join("\n\n");
          const synthesis = `${user}\n\nSPECIALIST PASSES (completed in parallel):\n${report || "No specialist completed a pass."}\n\nCombine the strongest compatible decisions. Return one valid JSON edit plan and include every specialist name in the crew field.`;
          out = await runOpenAI(agent.model, key, ORCHESTRATOR_SYSTEM, synthesis, b.history, onText, abort.signal);
          if (out.text) {
            const parsed = extractJson(out.text);
            return json({
              ...parsed,
              crew: results.map((result) => ({ name: result.name, task: result.task, status: result.text ? "complete" : result.status === 401 ? "skipped" : "failed" })),
            });
          }
        } else if (agent.api === "modelark") {
          out = await runModelArk(agent.model, system, user, b.history, onText, abort.signal);
        } else {
          const key = apiKey();
          out = agent.api === "anthropic"
            ? await runAnthropic(agent.model, key, system, user, b.history, onText, abort.signal)
            : await runOpenAI(agent.model, key, system, user, b.history, undefined, abort.signal);
        }

        if (out.error) {
          const status = out.status ?? 500;
          const msg =
            status === 401 && agent.api === "modelark" ? out.error
            : status === 402 ? "The workspace is out of AI credits."
            : status === 429 ? "Rate limited — try again in a moment."
            : "The editor agent couldn't respond.";
          return json({ reply: msg, steps: [], actions: [], crew: [] }, status);
        }
        if (!out.text) return json({ reply: "The editor returned an empty reply. Please try again." }, 502);
        return json(extractJson(out.text));
            };
            void execute().catch(() => emit("error", { reply: "The creative crew lost connection. Please try again." })).finally(() => {
              clearInterval(heartbeat);
              if (!closed) { closed = true; controller.close(); }
            });
          },
          cancel() { closed = true; abort.abort(); },
        });
        return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
      },
    },
  },
});
