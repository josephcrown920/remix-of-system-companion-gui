import { useEffect, useRef, useState } from "react";
import { Paperclip, Clapperboard, CheckCircle2, Loader2, AlertCircle, CircleDashed, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";

export type CreativeMessage = {
  role: "user" | "assistant";
  text: string;
  steps?: string[];
  agent?: string;
};
export type CrewRun = {
  name: string;
  task: string;
  status: "queued" | "working" | "complete" | "skipped" | "failed";
};
export const DIRECTING_STYLES = [
  {
    id: "original",
    label: "Your vision",
    brief: "Follow the user's creative direction without imposing a style.",
  },
  {
    id: "hype",
    label: "Music video",
    brief: "Music-video direction: rhythmic cuts, bold energy, strong performance moments.",
  },
  {
    id: "cinema",
    label: "Indie cinema",
    brief: "Independent-cinema direction: restrained cuts, natural light, emotional pacing.",
  },
  {
    id: "sleek",
    label: "Commercial",
    brief: "Commercial direction: clean composition, precise pacing, clear product focus.",
  },
];

const CREW_IDS: { id: string; match: string; ask: string }[] = [
  { id: "astra", match: "Astra", ask: "Give me a bold creative direction for my timeline: mood, pacing and camera moves." },
  { id: "codex", match: "Codex", ask: "Tighten my edit: trim dead space and line cuts to the beat." },
  { id: "fable", match: "Fable", ask: "Shape a story arc for this edit with emotional beats." },
  { id: "ark-seed-pro", match: "ModelArk", ask: "Plan b-roll inserts and transition effects for my edit." },
];

export function CrewBoard({ crew, busy, onAsk }: { crew: CrewRun[]; busy: boolean; onAsk?: (agentId: string, task: string) => void }) {
  const [brief, setBrief] = useState("");
  const planned: CrewRun[] = [
    { name: "GPT-6 Astra", task: "Creative direction — tap to ask", status: "queued" },
    { name: "Claude Codex", task: "Precision cuts — tap to ask", status: "queued" },
    { name: "Claude Fable", task: "Story & emotion — tap to ask", status: "queued" },
    { name: "ModelArk specialists", task: "B-roll & transitions — tap to ask", status: "queued" },
  ];
  return (
    <section className="crew-board border-t border-border pt-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">Your creative crew</span>
        <span className="font-mono text-[9px] uppercase text-muted-foreground">{busy ? "Awaiting crew report" : crew.length ? "Crew report" : "Ready"}</span>
      </div>
      {onAsk && (
        <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (brief.trim()) { onAsk("orchestrator", brief); setBrief(""); } }}>
          <input value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Brief the whole crew…" aria-label="Crew brief"
            className="min-w-0 flex-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] outline-none focus:border-primary" />
          <Button type="submit" size="sm" disabled={busy || !brief.trim()} className="h-7 text-[11px]">Dispatch crew</Button>
        </form>
      )}
      <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
        {(crew.length ? crew : planned).map((run, i) => {
          const def = CREW_IDS.find((c) => run.name.includes(c.match));
          return (
            <button type="button" key={run.name} disabled={!onAsk || !def || busy}
              onClick={() => def && onAsk?.(def.id, def.ask)}
              className="grid min-w-0 grid-cols-[32px_minmax(0,1fr)_16px] items-center gap-3 border-b border-border py-3 text-left transition enabled:hover:bg-primary/5 disabled:cursor-default">
              <span className={cn("crew-monogram grid size-8 place-items-center rounded-md font-mono text-[10px] font-semibold", busy && "animate-pulse", i % 3 === 0 ? "bg-primary/15 text-primary" : i % 3 === 1 ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive")}>{run.name.includes("Astra") ? "AS" : run.name.includes("Codex") ? "CX" : run.name.includes("Fable") ? "FB" : "MK"}</span>
              <div className="min-w-0"><p className="truncate text-[11px] font-semibold">{run.name}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">{run.task}</p></div>
              <span title={run.status === "queued" ? "Ready" : run.status}>
                {run.status === "complete" ? <CheckCircle2 className="size-3.5 text-accent" /> : run.status === "working" || busy ? <Loader2 className="size-3.5 animate-spin text-primary" /> : run.status === "failed" ? <AlertCircle className="size-3.5 text-destructive" /> : <CircleDashed className="size-3.5 text-muted-foreground" />}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function CreativeChat({
  messages,
  brief,
  setBrief,
  busy,
  send,
  spacious = false,
  onAttach,
  references = [],
}: {
  messages: CreativeMessage[];
  brief: string;
  setBrief: (text: string) => void;
  busy: boolean;
  send: (text: string) => Promise<void>;
  spacious?: boolean;
  onAttach?: (files: FileList | null) => void;
  references?: string[];
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rec = useRef<any>(null);
  function toggleMic() {
    if (listening) { rec.current?.stop(); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) { alert("Voice input isn't supported in this browser. Try Chrome or Safari."); return; }
    const r = new SR();
    r.continuous = true; r.interimResults = true;
    const base = brief ? brief + " " : "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => setBrief(base + Array.from(e.results).map((x: any) => x[0].transcript).join(""));
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r; r.start(); setListening(true);
  }
  useEffect(() => {
    if (!busy) textarea.current?.focus();
  }, [busy]);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Conversation className={cn("min-h-[120px]", spacious ? "max-h-[340px]" : "max-h-[300px]")}>
        <ConversationContent className="gap-5 p-0 pb-3">
          {messages.map((m, i) => (
            <Message key={i} from={m.role} className="max-w-full">
              <MessageContent
                className={cn(
                  "text-sm leading-relaxed",
                  m.role === "user" &&
                    "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground",
                )}
              >
                <MessageResponse>{m.text}</MessageResponse>
                {!!m.steps?.length && (
                  <details className="mt-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Edit decisions · {m.steps.length}</summary>
                    <ul className="mt-2 space-y-1">
                      {m.steps.map((step, j) => (
                        <li key={j}>{step}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </MessageContent>
            </Message>
          ))}
          {busy && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Reading your brief…
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="flex flex-wrap gap-1.5" aria-label="Quick starts">
        {[["Image", "Generate a photoreal image of "], ["Video", "Generate a 6-second video of "], ["Bullet time", "Freeze the action in a bullet-time orbit around "], ["Match cut", "Match cut my subject through new worlds on every beat: "]].map(([label, text]) => (
          <Button key={label} type="button" variant="outline" size="sm" className="h-7 rounded-full border-border bg-card/40 px-3 text-[11px]" onClick={() => { setBrief(text!); textarea.current?.focus(); }}>{label}</Button>
        ))}
      </div>
      <PromptInput onSubmit={() => send(brief)} className="creative-composer rounded-2xl border border-border bg-card/60 shadow-lg backdrop-blur-xl focus-within:border-primary/60">
        <PromptInputTextarea
          ref={textarea}
          aria-label="Creative brief"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Describe a shot, an edit or a look… (Enter to send)"
          className="min-h-14 resize-none border-0 bg-transparent text-sm"
        />
        <PromptInputFooter>
          <span className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
            <Button type="button" variant="ghost" size="icon" className={cn("size-7", listening && "text-primary")} aria-pressed={listening} aria-label={listening ? "Stop dictation" : "Speak your brief"} title="Voice input" onClick={toggleMic}>
              {listening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
            </Button>
            {onAttach && (
              <>
                <input ref={fileInput} type="file" multiple accept="image/*,video/*,audio/*" className="hidden" aria-label="Reference files" onChange={(e) => { onAttach(e.target.files); e.target.value = ""; }} />
                <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Add reference files" title="Add references" onClick={() => fileInput.current?.click()}>
                  <Paperclip className="size-3.5" />
                </Button>
              </>
            )}
            {references.length ? <span className="truncate">{references.length} reference{references.length > 1 ? "s" : ""}: {references.slice(-2).join(", ")}</span> : <><Clapperboard className="size-3" /> Your co-editor</>}
          </span>
          <PromptInputSubmit
            disabled={busy || !brief.trim()}
            status={busy ? "submitted" : "ready"}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
