import { useEffect, useRef, useState } from "react";
import { SquareTerminal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Maps a clip filter name to its animated overlay class (see styles.css). */
export function vfxClass(filter: string) {
  const slug = filter.toLowerCase().replace(/[^a-z]+/g, "-");
  return `vfx-overlay vfx-${slug}`;
}

type Mode = "start" | "edit" | "canvas" | "layers" | "workflows";
const CREW: Record<string, string> = { astra: "astra", codex: "codex", fable: "fable", modelark: "ark-seed-pro", orchestrator: "orchestrator" };

const HELP = `Commands
  crew dispatch "<brief>"      whole crew works your brief together
  crew <astra|codex|fable|modelark> "<ask>"   ask one agent
  vfx <bullettime|freeze|glitch|nightvision|cold|boomerang|reset>
  gen image "<prompt>"  ·  gen video "<prompt>"
  split                        cut the clip under the playhead
  export                       render the timeline
  open <edit|canvas|layers|workflows|start>
  clear  ·  help`;

export function Terminal(props: {
  busy: boolean;
  clipCount: number;
  onAsk: (agentId: string, task: string) => void;
  onVfx: (id: string) => string;
  onGenerate: (kind: "image" | "video", prompt: string) => void;
  onSplit: () => string;
  onExport: () => void;
  onMode: (m: Mode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[]>(["Out the Mud Records studio CLI — type help"]);
  const [input, setInput] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [lines, open]);

  function run(raw: string): string {
    const quoted = raw.match(/"([^"]*)"/)?.[1] ?? "";
    const [cmd, sub, ...rest] = raw.trim().split(/\s+/);
    const arg = quoted || rest.join(" ");
    switch (cmd?.toLowerCase()) {
      case "help": return HELP;
      case "clear": setLines([]); return "";
      case "crew": {
        const who = sub?.toLowerCase() ?? "";
        if (who === "dispatch") { if (!arg) return 'Usage: crew dispatch "<brief>"'; props.onAsk("orchestrator", arg); return "Crew dispatched — Astra, Codex, Fable and ModelArk are on it. Report lands in chat."; }
        const id = CREW[who];
        if (!id) return "Crew: astra, codex, fable, modelark (or dispatch).";
        if (!arg) return `Usage: crew ${who} "<ask>"`;
        props.onAsk(id, arg); return `Sent to ${who}. Reply streams into chat.`;
      }
      case "vfx": return sub ? props.onVfx(sub.toLowerCase()) : "Usage: vfx <effect>";
      case "gen": case "generate": {
        const kind = sub === "video" ? "video" : sub === "image" ? "image" : null;
        if (!kind || !arg) return 'Usage: gen image|video "<prompt>"';
        props.onGenerate(kind, arg); return `Generating ${kind}… it drops into your gallery and timeline.`;
      }
      case "split": return props.onSplit();
      case "export": case "render": if (!props.clipCount) return "Timeline is empty."; props.onExport(); return "Rendering timeline…";
      case "open": {
        const m = (["edit", "canvas", "layers", "workflows", "start"] as Mode[]).find((x) => x === sub);
        if (!m) return "Usage: open edit|canvas|layers|workflows|start";
        props.onMode(m); return `Opened ${m}.`;
      }
      case "status": return `${props.clipCount} clip(s) on timeline · ${props.busy ? "crew working" : "idle"}`;
      default: return `Unknown command: ${cmd}. Type help.`;
    }
  }

  function submit() {
    const c = input.trim();
    if (!c) return;
    setHist((h) => [c, ...h]); setHi(-1); setInput("");
    const out = run(c);
    if (c !== "clear") setLines((l) => [...l, `❯ ${c}`, ...(out ? [out] : [])]);
  }

  if (!open)
    return (
      <Button variant="ghost" onClick={() => setOpen(true)} aria-label="Open terminal"
        className="fixed bottom-20 right-3 z-40 gap-1.5 rounded-full border border-border glass-panel px-3 font-mono text-[11px] md:bottom-4">
        <SquareTerminal className="size-3.5" /> Terminal
      </Button>
    );

  return (
    <div className="fixed inset-x-2 bottom-20 z-40 flex h-72 flex-col overflow-hidden rounded-lg border border-border glass-panel font-mono text-[11px] md:inset-x-auto md:bottom-4 md:right-4 md:w-[560px]">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-muted-foreground"><SquareTerminal className="size-3.5" /> studio — zsh</span>
        <Button variant="ghost" size="icon" className="size-6" onClick={() => setOpen(false)} aria-label="Close terminal"><X className="size-3.5" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2" onClick={() => document.getElementById("cli-input")?.focus()}>
        {lines.map((l, i) => (
          <pre key={i} className={cn("whitespace-pre-wrap break-words", l.startsWith("❯") ? "text-primary" : "text-foreground/85")}>{l}</pre>
        ))}
        <div className="flex items-center gap-2">
          <span className="text-accent">~$</span>
          <input id="cli-input" autoFocus value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "ArrowUp") { const n = Math.min(hi + 1, hist.length - 1); if (hist[n]) { setHi(n); setInput(hist[n]); } e.preventDefault(); }
              if (e.key === "ArrowDown") { const n = hi - 1; setHi(n); setInput(n >= 0 ? hist[n] ?? "" : ""); e.preventDefault(); }
            }}
            aria-label="Terminal command" spellCheck={false}
            className="flex-1 bg-transparent outline-none" />
        </div>
        <div ref={end} />
      </div>
    </div>
  );
}
