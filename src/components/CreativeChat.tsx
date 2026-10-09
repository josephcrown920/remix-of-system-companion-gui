import { useEffect, useRef } from "react";
import { Clapperboard, CheckCircle2, Loader2, AlertCircle, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";

export type CreativeMessage = { role: "user" | "assistant"; text: string; steps?: string[]; agent?: string };
export type CrewRun = { name: string; task: string; status: "queued" | "working" | "complete" | "skipped" | "failed" };
export const DIRECTING_STYLES = [
  { id: "original", label: "Your vision", brief: "Follow the user's creative direction without imposing a style." },
  { id: "hype", label: "Music video", brief: "Music-video direction: rhythmic cuts, bold energy, strong performance moments." },
  { id: "cinema", label: "Indie cinema", brief: "Independent-cinema direction: restrained cuts, natural light, emotional pacing." },
  { id: "sleek", label: "Commercial", brief: "Commercial direction: clean composition, precise pacing, clear product focus." },
];

export function CrewBoard({ crew, busy }: { crew: CrewRun[]; busy: boolean }) {
  const planned: CrewRun[] = [
    { name: "GPT-6 Astra", task: "Creative direction", status: "queued" },
    { name: "Claude Codex", task: "Precision cuts", status: "queued" },
    { name: "Claude Fable", task: "Story & emotion", status: "queued" },
    { name: "ModelArk", task: "Requires connection", status: "skipped" },
  ];
  return <div className="border-t border-border pt-4">
    <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold">Creative crew</span><span className="font-mono text-[10px] text-muted-foreground">{busy ? "Dispatching" : crew.length ? "Pass complete" : "Standby"}</span></div>
    <div className="grid grid-cols-2 gap-2">{(crew.length ? crew : planned).map((run) => <div key={run.name} className="flex min-w-0 items-start gap-2 rounded-md border border-border bg-card p-2.5">
      {run.status === "complete" ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent" /> : run.status === "working" ? <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-primary" /> : run.status === "failed" ? <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" /> : <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
      <div className="min-w-0"><p className="text-[11px] font-semibold">{run.name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{run.task}</p><p className="mt-1 font-mono text-[9px] capitalize text-muted-foreground">{run.status === "queued" ? "Ready" : run.status === "working" ? "Awaiting crew report" : run.status}</p></div>
    </div>)}</div>
  </div>;
}

export function CreativeChat({ messages, brief, setBrief, busy, send, spacious = false }: {
  messages: CreativeMessage[]; brief: string; setBrief: (text: string) => void;
  busy: boolean; send: (text: string) => Promise<void>; spacious?: boolean;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (!busy) textarea.current?.focus(); }, [busy]);
  return <div className="flex min-h-0 flex-1 flex-col gap-4">
    <Conversation className={cn("min-h-[120px]", spacious ? "max-h-[340px]" : "max-h-[300px]")}>
      <ConversationContent className="gap-5 p-0 pb-3">{messages.map((m, i) => <Message key={i} from={m.role} className="max-w-full">
        <MessageContent className={cn("text-sm leading-relaxed", m.role === "user" && "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground")}>
          <MessageResponse>{m.text}</MessageResponse>
          {!!m.steps?.length && <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Edit decisions · {m.steps.length}</summary><ul className="mt-2 space-y-1">{m.steps.map((step, j) => <li key={j}>{step}</li>)}</ul></details>}
        </MessageContent>
      </Message>)}{busy && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Reading your brief…</p>}</ConversationContent>
      <ConversationScrollButton />
    </Conversation>
    <PromptInput onSubmit={() => send(brief)} className="creative-composer">
      <PromptInputTextarea ref={textarea} aria-label="Creative brief" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Tell me what you want to create…" className="min-h-24 text-sm" />
      <PromptInputFooter><span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Clapperboard className="size-3" /> Your co-editor</span><PromptInputSubmit disabled={busy || !brief.trim()} status={busy ? "submitted" : "ready"} /></PromptInputFooter>
    </PromptInput>
  </div>;
}