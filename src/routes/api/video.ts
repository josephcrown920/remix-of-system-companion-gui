import { createFileRoute } from "@tanstack/react-router";
import { GATEWAY, VIDEO_MODEL, apiKey, passthrough } from "@/lib/gateway.server";
import { VIDEO_ENGINES } from "@/lib/engines";
import { arkFetch, arkError } from "@/lib/ark.server";

type Media = { data: string; mime: string };
type Body = { prompt: string; engine?: string; motion?: string; duration?: string; draft?: boolean; image?: Media; video?: Media; audio?: Media };

// Creates a video job. Client polls /api/video/$id.
export const Route = createFileRoute("/api/video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const b = (await request.json()) as Body;
        if (!b.prompt?.trim()) return new Response("Prompt required", { status: 400 });

        const e = VIDEO_ENGINES.find((x) => x.id === b.engine);
        if (e && (!e.available || !e.model)) {
          return Response.json({ error: { message: `${e.name} is not available on this workspace yet. Pick another video engine.` } }, { status: 400 });
        }
        const model = e?.model ?? VIDEO_MODEL;
        const res = b.draft ? "480p" : "720p";

        const prompt = b.motion ? `${b.prompt}\n\n${b.motion}` : b.prompt;
        if (e?.provider === "ark") {
          const secs = parseInt(b.duration ?? "5", 10) || 5;
          const content: unknown[] = [{ type: "text", text: `${prompt} --duration ${secs} --resolution ${res} --ratio 16:9` }];
          if (b.image) content.push({ type: "image_url", image_url: { url: `data:${b.image.mime};base64,${b.image.data}` } });
          const r = await arkFetch("/contents/generations/tasks", { method: "POST", body: JSON.stringify({ model, content }) });
          if (!r.ok) return arkError(r);
          const job = (await r.json()) as { id?: string };
          return Response.json({ id: `ark_${job.id}`, status: "queued" });
        }
        const key = apiKey();
        const parts: unknown[] = [{ type: "text", text: prompt }];
        if (b.image) parts.push({ type: "image", data: b.image.data, mime_type: b.image.mime });
        if (b.video) parts.push({ type: "video", data: b.video.data, mime_type: b.video.mime });
        if (b.audio) parts.push({ type: "audio", data: b.audio.data, mime_type: b.audio.mime });
        const response_format: Record<string, string> = { type: "video", resolution: res, duration: b.duration ?? "6s" };
        if (!b.video) response_format["aspect_ratio"] = "16:9";

        return passthrough(
          await fetch(`${GATEWAY}/v1/videos`, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model, input: parts.length === 1 ? prompt : parts, response_format }),
          }),
        );
      },
    },
  },
});
