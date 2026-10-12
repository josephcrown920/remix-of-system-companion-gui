import { useRef, useState, type PointerEvent } from "react";
import { Upload, Layers3, Eye, EyeOff, Loader2, Wand2, FolderInput, Undo2, Scan, Eraser, Sun, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { generateImage, urlToBlob } from "@/lib/generate";
import { IMAGE_ENGINES } from "@/lib/engines";

type Box = { x: number; y: number; w: number; h: number };
type Plate = { id: string; name: string; visible: boolean; locked: boolean };
type Swap = { url: string; prompt: string; plate: string };

const PLATE_NAMES = [
  "Background", "Subject", "Face", "Hair", "Outfit — top", "Outfit — bottom", "Footwear", "Jewelry",
  "Eyewear", "Hands", "Props", "Vehicles", "Lights & neon", "Reflections", "Weather / rain", "Sky",
  "Crowd / extras", "Text & signage", "Shadows", "Relight pass",
];
const RESOLUTIONS = ["1K", "1.5K", "2K", "4K"] as const;
const TOOLS = [
  { id: "decompose", label: "Layer decomposition", icon: Layers3 },
  { id: "bg", label: "Remove background", icon: Eraser, prompt: "Remove the background completely and leave the subject on a clean flat transparent-style neutral backdrop." },
  { id: "relight", label: "Relight", icon: Sun, prompt: "Relight the scene with dramatic cinematic rim light; keep every person, pose and object identical." },
  { id: "upscale", label: "Upscale & enhance", icon: ArrowUpRight, prompt: "Upscale and enhance detail and sharpness; change nothing in the content." },
] as const;

export function LayerStudio({ onAsset }: { onAsset: (url: string, kind: "image" | "video", name: string, addToTimeline?: boolean) => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [history, setHistory] = useState<Swap[]>([]);
  const [plates, setPlates] = useState<Plate[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [res, setRes] = useState<(typeof RESOLUTIONS)[number]>("2K");
  const [fast, setFast] = useState(true);
  const [count, setCount] = useState(8);
  const [box, setBox] = useState<Box | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const engines = IMAGE_ENGINES.filter((e) => e.available);
  const [engine, setEngine] = useState(engines[0]?.id ?? "seedream5");
  const file = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const current = history.at(-1)?.url ?? src;

  function load(f: File | undefined) {
    if (!f) return;
    setSrc(URL.createObjectURL(f));
    setHistory([]); setPlates([]); setActive(null); setBox(null); setError(null);
  }

  function decompose() {
    setPlates(PLATE_NAMES.slice(0, count).map((name, i) => ({ id: `p${i}`, name, visible: true, locked: false })));
    setActive("p1");
  }

  function pt(e: PointerEvent) {
    const r = frame.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  }

  async function run(instruction: string, label: string) {
    if (!current) return;
    setBusy(label); setError(null);
    try {
      const plate = plates.find((p) => p.id === active);
      const locked = plates.filter((p) => p.locked).map((p) => p.name);
      const region = box ? `Only edit the region from ${Math.round(box.x * 100)}% left, ${Math.round(box.y * 100)}% top, ${Math.round(box.w * 100)}% wide, ${Math.round(box.h * 100)}% tall.` : "";
      const full = [
        plate && label === "swap" ? `Edit ONLY the "${plate.name}" layer.` : "",
        region, instruction,
        "Keep everything else pixel-identical: same pose, framing, lighting, shadows, faces and background.",
        locked.length ? `Do not touch these locked layers: ${locked.join(", ")}.` : "",
        `Output ${res} ${fast ? "fast" : "standard"} quality.`,
      ].filter(Boolean).join(" ");
      const url = await generateImage(full, engine, await urlToBlob(current));
      setHistory((h) => [...h, { url, prompt: instruction, plate: plate?.name ?? label }]);
      setPrompt(""); setBox(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Edit failed.");
    } finally { setBusy(null); }
  }

  return (
    <div className="grid h-full gap-3 lg:grid-cols-[260px_minmax(0,1fr)_280px]">
      {/* tools */}
      <section className="flex flex-col gap-3 rounded-lg border border-border glass-panel p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Layers · edit image</p>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => load(e.target.files?.[0])} />
        <Button onClick={() => file.current?.click()} className="gap-2"><Upload className="size-4" /> Upload image</Button>
        {TOOLS.map((t) => (
          <Button key={t.id} variant="ghost" disabled={!current || !!busy}
            onClick={() => ("prompt" in t ? void run(t.prompt, t.id) : decompose())}
            className="justify-start gap-2 text-xs">
            {busy === t.id ? <Loader2 className="size-3.5 animate-spin" /> : <t.icon className="size-3.5" />} {t.label}
          </Button>
        ))}
        <div className="space-y-2 rounded-md border border-border glass-control p-2.5">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Resolution</p>
          <div className="grid grid-cols-4 gap-1">
            {RESOLUTIONS.map((r) => (
              <button key={r} onClick={() => setRes(r)} className={cn("rounded py-1 text-[11px]", res === r ? "bg-primary text-primary-foreground" : "bg-secondary")}>{r}</button>
            ))}
          </div>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Mode</p>
          <div className="grid grid-cols-2 gap-1">
            {["Standard", "Fast"].map((m) => (
              <button key={m} onClick={() => setFast(m === "Fast")} className={cn("rounded py-1 text-[11px]", fast === (m === "Fast") ? "bg-primary text-primary-foreground" : "bg-secondary")}>{m}</button>
            ))}
          </div>
          <label className="flex items-center justify-between text-[10px] font-semibold uppercase text-muted-foreground">Layers <span className="font-mono text-foreground">{count}</span></label>
          <input type="range" min={2} max={20} value={count} onChange={(e) => setCount(+e.target.value)} className="w-full accent-[var(--primary)]" aria-label="Layer count" />
          <select aria-label="Image model" value={engine} onChange={(e) => setEngine(e.target.value)} className="w-full rounded border border-border bg-card px-2 py-1 text-[11px]">
            {engines.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </section>

      {/* frame */}
      <section className="flex min-h-[420px] flex-col gap-3 rounded-lg border border-border glass-panel p-3">
        {current ? (
          <>
            <div className="flex flex-1 items-center justify-center overflow-hidden">
              <div ref={frame} className="relative max-h-full touch-none select-none"
                onPointerDown={(e) => { const p = pt(e); drag.current = p; setBox({ ...p, w: 0, h: 0 }); (e.target as Element).setPointerCapture?.(e.pointerId); }}
                onPointerMove={(e) => { if (!drag.current) return; const p = pt(e), s = drag.current; setBox({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) }); }}
                onPointerUp={() => { drag.current = null; setBox((b) => (b && b.w > 0.02 && b.h > 0.02 ? b : null)); }}>
                <img src={current} alt="Layer frame" draggable={false} className="max-h-[60vh] rounded-md object-contain" />
                {box && <div className="pointer-events-none absolute border-2 border-dashed border-primary bg-primary/10" style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }} />}
                {busy && <div className="absolute inset-0 grid place-items-center rounded-md bg-background/60"><Loader2 className="size-8 animate-spin text-primary" /></div>}
              </div>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (prompt.trim()) void run(prompt.trim(), "swap"); }}
              className="flex items-center gap-2 rounded-full border border-border glass-control p-1.5 pl-4">
              <Scan className="size-4 shrink-0 text-muted-foreground" />
              <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={box ? "Describe the swap for the selected area…" : "Drag a box, or pick a layer, then type — e.g. outfit into medieval warrior"} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              <Button type="submit" size="sm" disabled={!prompt.trim() || !!busy} className="rounded-full"><Wand2 className="size-4" /></Button>
            </form>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </>
        ) : (
          <button onClick={() => file.current?.click()} className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border text-center">
            <Layers3 className="size-10 text-primary" />
            <span className="text-lg font-bold">Turn flat images into editable layers</span>
            <span className="max-w-sm text-xs text-muted-foreground">Drop any image, decompose it into up to 20 layers, then swap one element at a time — nothing else moves.</span>
          </button>
        )}
      </section>

      {/* layers + swaps */}
      <section className="flex flex-col gap-3 rounded-lg border border-border glass-panel p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold">Layers</p>
          <span className="font-mono text-[10px] text-muted-foreground">{plates.length || "—"}</span>
        </div>
        <div className="max-h-64 space-y-1 overflow-auto">
          {plates.length === 0 && <p className="text-[11px] text-muted-foreground">Run Layer decomposition to split the frame.</p>}
          {plates.map((p) => (
            <div key={p.id} onClick={() => setActive(p.id)} className={cn("flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[11px]", active === p.id ? "bg-primary/20 text-primary" : "hover:bg-secondary")}>
              <button aria-label="Toggle visibility" onClick={(e) => { e.stopPropagation(); setPlates((ps) => ps.map((q) => q.id === p.id ? { ...q, visible: !q.visible } : q)); }}>
                {p.visible ? <Eye className="size-3" /> : <EyeOff className="size-3 opacity-50" />}
              </button>
              <span className="flex-1 truncate">{p.name}</span>
              <button onClick={(e) => { e.stopPropagation(); setPlates((ps) => ps.map((q) => q.id === p.id ? { ...q, locked: !q.locked } : q)); }} className={cn("rounded px-1 font-mono text-[9px]", p.locked ? "bg-accent text-accent-foreground" : "text-muted-foreground")}>{p.locked ? "LOCK" : "lock"}</button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3">
          <p className="text-xs font-semibold">Swap stack</p>
          <Button variant="ghost" size="sm" disabled={!history.length} onClick={() => setHistory((h) => h.slice(0, -1))} className="h-6 gap-1 px-2 text-[10px]"><Undo2 className="size-3" /> Undo</Button>
        </div>
        <div className="grid grid-cols-2 gap-2 overflow-auto">
          {history.map((s, i) => (
            <div key={i} className="overflow-hidden rounded border border-border">
              <img src={s.url} alt={s.prompt} className="aspect-square w-full object-cover" />
              <p className="truncate px-1.5 py-1 text-[9px] text-muted-foreground">{s.plate}: {s.prompt}</p>
            </div>
          ))}
        </div>
        <Button disabled={!current || current === src} onClick={() => current && onAsset(current, "image", `layers_${Date.now()}.png`, true)} className="mt-auto gap-2"><FolderInput className="size-4" /> Send to timeline</Button>
      </section>
    </div>
  );
}
