import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Upload, Layers3, Loader2, Wand2, FolderInput, Undo2, Eraser, Sun, ArrowUpRight, Plus, Save, Download, Trash2, ArrowUp, ArrowDown, LockKeyhole, UnlockKeyhole, Copy, Film, ImagePlus, ZoomIn, ZoomOut, Scan, Check, X, UserRound, Sparkles, Camera, Shirt, Gem, Box, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { generateImage, generateVideo, urlToBlob } from "@/lib/generate";
import { IMAGE_ENGINES, VIDEO_ENGINES, DEFAULT_IMAGE_ENGINE, DEFAULT_VIDEO_ENGINE, CAMERA_MOVES } from "@/lib/engines";
import { removeImageBackground } from "@/lib/remove-background";
import { CreativeContext } from "@/components/CreativeContext";
import { sequence, upsertShot, moveShot, patchShot, removeShot, shotCode, buildSequencePrompt, type Shot } from "@/lib/layers-storyboard";
import { listLayersProjects, storeLayersProject, deleteLayersProject, exportLayersProject, downloadLayer, composeLayersSheet, referencePlate, type LayersProject } from "@/lib/layers-projects";
import armor from "@/assets/aurora-layer-armor.jpg.asset.json";
import braids from "@/assets/aurora-layer-braids.jpg.asset.json";
import bandana from "@/assets/aurora-layer-bandana.jpg.asset.json";
import chains from "@/assets/aurora-layer-chains.jpg.asset.json";

type Region = { x: number; y: number; w: number; h: number };
const TARGETS = [
  { id: "background", name: "Background", icon: Layers3, region: "environment, walls, street and everything behind the subjects", sample: "Night block party, neon signage, wet asphalt reflections" },
  { id: "talent", name: "Talent", icon: UserRound, region: "body and posture of the person only", sample: "Same person, taller stance, shoulders squared to camera" },
  { id: "face", name: "Face", icon: Scan, region: "facial features and makeup only", sample: "Joker circus face paint, smudged red grin" },
  { id: "hair", name: "Hair", icon: Palette, region: "hair and headwear only", sample: "Long neon-green braids with beaded tips" },
  { id: "wardrobe", name: "Wardrobe", icon: Shirt, region: "clothing and outfit only", sample: "Full trap streetwear — puffer jacket, cargos, designer shades" },
  { id: "jewelry", name: "Jewelry", icon: Gem, region: "chains, rings, grillz, watches and accessories only", sample: "Iced-out cuban links, diamond grillz, pinky rings" },
  { id: "props", name: "Props", icon: Box, region: "handheld objects and props only", sample: "Swap the handheld prop for a chrome boombox" },
  { id: "lighting", name: "Lighting", icon: Sun, region: "lighting, colour grade and atmosphere only", sample: "Hard magenta rim light, teal shadows, light haze" },
  ...["Footwear", "Eyewear", "Hands", "Vehicles", "Reflections", "Weather", "Sky", "Crowd", "Signage", "Shadows", "Foreground", "Texture"].map((name) => ({ id: name.toLowerCase(), name, icon: Layers3, region: `${name.toLowerCase()} only`, sample: `Change only the ${name.toLowerCase()}, preserving everything else` })),
];
const PRESETS = [
  { label: "Trap streetwear", image: armor.url, prompt: "Turn the outfit into full trap streetwear — puffer jacket, iced-out cuban chains, designer shades", target: "wardrobe" },
  { label: "Neon braids", image: braids.url, prompt: "Give her long neon-green braids and oversized varsity jacket", target: "hair" },
  { label: "Bandana & fitted", image: bandana.url, prompt: "Add a red bandana, backwards fitted cap and gold rope chain", target: "hair" },
  { label: "Iced-out jewelry", image: chains.url, prompt: "Add iced-out cuban links, diamond grillz and pinky rings", target: "jewelry" },
];
const IDENTITY_LOCK = "LOCKED PLATE: preserve identical face, ethnicity, skin tone, hair, body, expression, pose, hand placement, camera angle, crop and background. Keep every subject on the same side of frame. Do not mirror, flip, swap, recast or reposition anyone. Change only the named region.";
const field = "w-full rounded-md border border-input bg-secondary/40 px-3 py-2.5 text-xs outline-none focus:border-primary";

export function LayerStudio({ onAsset }: { onAsset: (url: string, kind: "image" | "video", name: string, addToTimeline?: boolean) => void }) {
  const [name, setName] = useState("Untitled shoot");
  const [projectId, setProjectId] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [targetEdits, setTargetEdits] = useState<Record<string, string>>({});
  const [locked, setLocked] = useState<string[]>([]);
  const [identityLock, setIdentityLock] = useState(true);
  const [identity, setIdentity] = useState("");
  const [prompt, setPrompt] = useState("");
  const [engine, setEngine] = useState(DEFAULT_IMAGE_ENGINE);
  const [videoEngine, setVideoEngine] = useState(DEFAULT_VIDEO_ENGINE);
  const [resolution, setResolution] = useState("2K");
  const [fast, setFast] = useState(false);
  const [count, setCount] = useState(8);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<LayersProject[]>([]);
  const [region, setRegion] = useState<Region | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [compare, setCompare] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState("6s");
  const [camera, setCamera] = useState("push");
  const input = useRef<HTMLInputElement>(null);
  const referenceInput = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const ordered = sequence(shots);
  const selected = ordered.find((shot) => shot.id === active);
  const result = selected?.dataUrl || null;
  const current = result ?? source;
  const selectedTarget = TARGETS.find((item) => item.id === target);
  const hasRenders = ordered.some((shot) => shot.dataUrl);

  useEffect(() => { void listLayersProjects().then(setProjects).catch(() => {}); }, []);

  async function load(file: File | undefined, asReference = false) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; }
    const url = URL.createObjectURL(file);
    if (asReference) setReference(url);
    else { setSource(url); setShots([]); setActive(null); setTarget(null); setTargetEdits({}); setRegion(null); setVideoUrl(null); }
    setError(null); setStatus("");
  }
  function newProject() {
    if ((source || shots.length) && !window.confirm("Start a new shoot? Save your current shoot first to keep its rendered frames.")) return;
    setProjectId(""); setName("Untitled shoot"); setSource(null); setReference(null); setShots([]); setActive(null);
    setTarget(null); setTargetEdits({}); setLocked([]); setPrompt(""); setIdentity(""); setRegion(null); setVideoUrl(null); setError(null); setStatus("");
  }
  function project(): LayersProject {
    return { id: projectId || crypto.randomUUID(), name: name.trim() || "Untitled shoot", prompt, engine, videoEngine, identity, identityLock, resolution, shots: ordered, updatedAt: Date.now() };
  }
  async function action(label: string, task: () => Promise<void>) {
    if (busy) return;
    setBusy(label); setError(null); setStatus(label);
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : "This action failed."); setStatus(""); }
    finally { setBusy(null); }
  }
  function append(url: string, instruction: string, targetId?: string, existing?: Shot) {
    const id = existing?.id ?? crypto.randomUUID();
    setShots((previous) => upsertShot(previous, { id, dataUrl: url, prompt: instruction, beat: existing?.beat ?? TARGETS.find((t) => t.id === targetId)?.name ?? "Layer edit", motion: existing?.motion ?? CAMERA_MOVES.find((c) => c.id === camera)?.phrase ?? "" }));
    setActive(id); setVideoUrl(null);
    if (targetId) setTargetEdits((previous) => ({ ...previous, [targetId]: id }));
    setStatus("Frame ready");
  }
  async function render(instruction = prompt, targetId = target ?? undefined, existing?: Shot) {
    if (!instruction.trim()) return;
    if (targetId && locked.includes(targetId)) { setError("Unlock this target before editing it."); return; }
    await action("Rendering layer…", async () => {
      const base = existing?.dataUrl || current;
      const definition = TARGETS.find((t) => t.id === targetId);
      const full = [
        identity ? `CHARACTER IDENTITY: ${identity}` : "",
        definition ? `LAYER TARGET — ${definition.name.toUpperCase()}: re-render only ${definition.region}. Every other element stays unchanged.` : "",
        region ? `Edit only the rectangle at ${Math.round(region.x * 100)}% left, ${Math.round(region.y * 100)}% top, ${Math.round(region.w * 100)}% wide, ${Math.round(region.h * 100)}% tall.` : "",
        instruction.trim(), identityLock && base ? IDENTITY_LOCK : "",
        locked.length ? `Do not change these locked targets: ${locked.join(", ")}.` : "",
        reference ? (base ? "The LEFT image is the source frame. The RIGHT image is a character identity reference only. Output only the edited source frame, not a collage." : "Use the supplied character reference to keep the same identity. Output one frame.") : "",
        `Requested output: ${resolution}. ${fast ? "Prioritize fast iteration." : "Prioritize highest detail and fidelity."}`,
      ].filter(Boolean).join("\n\n");
      const blob = reference ? await referencePlate(base, reference) : base ? await urlToBlob(base) : undefined;
      append(await generateImage(full, engine, blob), instruction, targetId, existing);
      setRegion(null);
    });
  }
  function point(e: PointerEvent<HTMLDivElement>) {
    const rect = frame.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) };
  }
  async function save() {
    await action("Saving shoot…", async () => {
      const next = project(); await storeLayersProject(next); setProjectId(next.id); setProjects(await listLayersProjects()); setStatus("Shoot saved on this device");
    });
  }
  function open(saved: LayersProject) {
    if ((source || shots.length) && !window.confirm("Open this saved shoot? Unsaved changes to the current shoot will be replaced.")) return;
    setProjectId(saved.id); setName(saved.name); setPrompt(saved.prompt); setEngine(saved.engine); setVideoEngine(saved.videoEngine);
    setIdentity(saved.identity); setIdentityLock(saved.identityLock); setResolution(saved.resolution); setShots(saved.shots);
    setActive(sequence(saved.shots).at(-1)?.id ?? null); setSource(null); setReference(null); setTarget(null); setTargetEdits({}); setLocked([]); setRegion(null); setVideoUrl(null); setStatus("Saved shoot opened"); setError(null);
  }

  return (
    <div className="layers-app mx-auto w-full max-w-[1500px]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-5 sm:px-7">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-primary/15 text-primary"><Layers3 /></span><div><p className="font-mono text-[10px] text-muted-foreground">AURORA PERFORMANCE STUDIO</p><h1 className="font-display text-2xl font-extrabold">Layers</h1></div></div>
        <div className="flex items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:inline">{ordered.length} shots</span><Button variant="outline" size="sm" onClick={newProject} disabled={!!busy}><Plus />New shoot</Button><Button size="sm" onClick={() => void save()} disabled={!hasRenders || !!busy}><Save />Save shoot</Button></div>
      </div>
      <div className="grid gap-7 p-4 sm:p-7 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="min-w-0 space-y-6" aria-label="Layer editing controls">
          <div className="flex items-center gap-2"><input aria-label="Project name" className="min-w-0 flex-1 border-b border-border bg-transparent pb-2 text-lg font-bold outline-none focus:border-primary" value={name} onChange={(e) => setName(e.target.value)} /><span className="font-mono text-[10px] text-muted-foreground">{projectId ? "SAVED SHOOT" : "NEW SHOOT"}</span></div>
          <div><Step number="01" title="Source plate" />
            <div className={cn("mt-3 overflow-hidden rounded-lg border border-dashed p-2 transition-colors", dragging ? "border-primary bg-primary/10" : "border-input bg-secondary/20")} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); if (!busy) void load(e.dataTransfer.files[0]); }}>
              {source ? <><img src={source} alt="Source plate" className="aspect-[4/3] w-full rounded-md object-contain" /><div className="mt-2 flex gap-2"><Button variant="secondary" size="sm" className="flex-1" onClick={() => input.current?.click()} disabled={!!busy}><Upload />Replace photo</Button><Button variant="ghost" size="icon" aria-label="Remove source photo" title="Remove source photo" onClick={() => setSource(null)} disabled={!!busy}><X /></Button></div></> : <Button variant="ghost" className="flex aspect-[4/3] h-auto w-full flex-col gap-4 whitespace-normal hover:bg-secondary/50" onClick={() => input.current?.click()} disabled={!!busy}><span className="grid size-14 place-items-center rounded-lg gradient-control"><Upload /></span><span className="text-base font-bold">Upload your photo</span><span className="font-mono text-[10px] text-muted-foreground">JPG · PNG · WEBP</span></Button>}
            </div>
            <input ref={input} type="file" aria-label="Upload source image" accept="image/*" hidden onChange={(e) => { void load(e.target.files?.[0]); e.target.value = ""; }} />
            <input ref={referenceInput} type="file" aria-label="Upload identity reference" accept="image/*" hidden onChange={(e) => { void load(e.target.files?.[0], true); e.target.value = ""; }} />
            <div className="mt-3 flex items-center gap-2 rounded-md border border-border p-2"><Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start whitespace-normal text-left text-xs" disabled={!!busy} onClick={() => referenceInput.current?.click()}>{reference ? <img src={reference} alt="Character reference" className="size-9 rounded object-cover" /> : <UserRound />}<span className="flex-1">Character sheet / face reference</span>{reference ? <Check className="text-accent" /> : <Plus />}</Button>{reference && <Button variant="ghost" size="icon" title="Remove identity reference" aria-label="Remove identity reference" onClick={() => setReference(null)}><X /></Button>}</div>
          </div>
          <div><Step number="02" title="Engines & identity" /><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="space-y-2 text-xs text-muted-foreground"><span>Image engine</span><select aria-label="Image model" className={field} value={engine} onChange={(e) => setEngine(e.target.value)}>{IMAGE_ENGINES.filter((e) => e.available).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label className="space-y-2 text-xs text-muted-foreground"><span>Motion engine</span><select aria-label="Video model" className={field} value={videoEngine} onChange={(e) => setVideoEngine(e.target.value)}>{VIDEO_ENGINES.filter((e) => e.available).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="mb-2 text-xs text-muted-foreground">Requested resolution</p><div className="grid grid-cols-4 gap-1 rounded-md bg-secondary/50 p-1">{["1K", "1.5K", "2K", "4K"].map((r) => <Button key={r} size="sm" variant="ghost" onClick={() => setResolution(r)} className={cn("px-1", resolution === r && "bg-primary/20 text-primary")}>{r}</Button>)}</div></div><div><p className="mb-2 text-xs text-muted-foreground">Render mode</p><div className="grid grid-cols-2 gap-1 rounded-md bg-secondary/50 p-1">{[false, true].map((value) => <Button key={String(value)} size="sm" variant="ghost" onClick={() => setFast(value)} className={cn(fast === value && "bg-primary/20 text-primary")}>{value ? "Fast" : "Standard"}</Button>)}</div></div></div>
            <label className="mt-4 flex items-center gap-2 text-xs"><input type="checkbox" checked={identityLock} onChange={(e) => setIdentityLock(e.target.checked)} className="accent-primary" /><LockKeyhole className="size-3.5 text-accent" />Lock identity, pose & framing</label>
            <details className="mt-3 border-b border-border pb-3"><summary className="cursor-pointer text-xs text-muted-foreground">Character identity</summary><textarea aria-label="Character identity" rows={3} className={cn(field, "mt-3 resize-y")} value={identity} onChange={(e) => setIdentity(e.target.value)} placeholder="Face, hair, skin tone, wardrobe and traits…" /></details><div className="mt-3"><CreativeContext /></div>
          </div>
          <div><Step number="03" title={selectedTarget ? `${selectedTarget.name} — layer prompt` : "Layer prompt"} /><textarea aria-label="Layer prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} className={cn(field, "mt-3 resize-y text-sm")} placeholder={selectedTarget?.sample ?? "Describe the edit or the frame you want to create…"} />
            <div className="mt-3 grid grid-cols-4 gap-2">{PRESETS.map((preset) => <Button key={preset.label} variant="ghost" className="h-auto min-w-0 flex-col gap-0 overflow-hidden rounded-md border border-border p-0 whitespace-normal text-left" onClick={() => { setPrompt(preset.prompt); setTarget(preset.target); }}><img src={preset.image} alt={preset.label} className="aspect-square w-full object-cover" /><span className="block w-full px-2 py-2 text-[10px] leading-4">{preset.label}</span></Button>)}</div>
            <Button className="mt-4 h-11 w-full font-bold" disabled={!!busy || !prompt.trim() || (!!target && locked.includes(target))} onClick={() => void render()}>{busy?.startsWith("Rendering") ? <Loader2 className="animate-spin" /> : <Wand2 />}{selectedTarget ? `Render ${selectedTarget.name.toLowerCase()}` : hasRenders ? "Stack another shot" : "Run layer edit"}</Button>
            <div className="mt-3 grid grid-cols-3 gap-2">{[{ label: "Remove background", icon: Eraser, job: () => action("Removing background…", async () => { if (!current) return; append(await removeImageBackground(current, setStatus), "Transparent background", "background"); }) }, { label: "Relight", icon: Sun, job: () => render("Relight with cinematic rim lighting; preserve every subject, pose and object.", "lighting") }, { label: "Enhance", icon: ArrowUpRight, job: () => render("Enhance detail and sharpness without changing content.", undefined) }].map((tool) => <Button key={tool.label} variant="outline" className="h-auto min-h-12 min-w-0 flex-col gap-1 px-1 py-2 whitespace-normal text-[10px]" disabled={!current || !!busy} onClick={() => void tool.job()}><tool.icon />{tool.label}</Button>)}</div>
          </div>
          <div aria-live="polite">{busy && <p className="flex items-center gap-2 text-xs text-primary"><Loader2 className="size-3 animate-spin" />{status}</p>}{!busy && status && <p className="text-xs text-accent">{status}</p>}{error && <p role="alert" className="mt-2 break-words text-xs text-destructive">{error}</p>}</div>
          <div className="border-t border-border pt-5"><p className="mb-3 text-xs font-semibold">Saved shoots <span className="text-muted-foreground">· this device</span></p>{!projects.length && <p className="text-xs text-muted-foreground">No saved shoots</p>}{projects.map((saved) => <div key={saved.id} className="flex items-center gap-1 border-b border-border py-2"><Button variant="ghost" className="min-w-0 flex-1 justify-start text-left" disabled={!!busy} onClick={() => open(saved)}><span className="truncate">{saved.name}</span><span className="ml-auto text-[10px] text-muted-foreground">{saved.shots.length} shots</span></Button><Button variant="ghost" size="icon" title={`Delete ${saved.name}`} aria-label={`Delete ${saved.name}`} disabled={!!busy} onClick={() => { if (window.confirm(`Delete ${saved.name}?`)) void action("Deleting shoot…", async () => { await deleteLayersProject(saved.id); setProjects(await listLayersProjects()); setStatus("Shoot deleted"); }); }}><Trash2 /></Button></div>)}</div>
        </section>
        <section className="min-w-0 space-y-6" aria-label="Layer output and storyboard">
          <div><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold"><Layers3 className="size-4 text-primary" />Layer decomposition</h2><label className="flex items-center gap-2 text-[10px] text-muted-foreground">Targets <select aria-label="Layer count" value={count} onChange={(e) => setCount(Number(e.target.value))} className="rounded border border-border bg-secondary px-2 py-1">{[8, 12, 16, 20].map((n) => <option key={n} value={n}>{n}</option>)}</select></label></div>
            <div className="mt-3 grid grid-cols-4 gap-2">{TARGETS.slice(0, count).map((item) => {
              const edit = shots.find((shot) => shot.id === targetEdits[item.id]); const isLocked = locked.includes(item.id);
              return <div key={item.id} className={cn("overflow-hidden rounded-lg border bg-secondary/20", target === item.id ? "border-primary ring-1 ring-primary" : "border-border")}><Button variant="ghost" className="relative flex h-auto w-full flex-col gap-0 rounded-none p-0" disabled={!current || !!busy} onClick={() => { setTarget(item.id); setPrompt(edit?.prompt ?? item.sample); if (edit) setActive(edit.id); }}><span className="relative block aspect-square w-full overflow-hidden">{current ? <img src={edit?.dataUrl ?? source ?? current} alt={`${item.name} target`} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-muted-foreground"><item.icon className="size-6" /></span>}<span className="absolute left-1.5 top-1.5 grid size-5 place-items-center rounded bg-background/80 text-accent"><item.icon className="size-3" /></span>{edit && <span className="absolute bottom-1 right-1 rounded bg-primary px-1 text-[8px] text-primary-foreground">EDITED</span>}</span><span className="w-full truncate px-2 pb-2 pt-1.5 text-left text-[10px] font-bold">{item.name}</span></Button><Button variant="ghost" title={isLocked ? `Unlock ${item.name}` : `Lock ${item.name}`} aria-label={isLocked ? `Unlock ${item.name}` : `Lock ${item.name}`} className={cn("h-6 w-full rounded-none border-t border-border", isLocked ? "text-accent" : "text-muted-foreground")} disabled={!!busy} onClick={() => setLocked((previous) => previous.includes(item.id) ? previous.filter((id) => id !== item.id) : [...previous, item.id])}>{isLocked ? <LockKeyhole className="size-3" /> : <UnlockKeyhole className="size-3" />}</Button></div>;
            })}</div>
            <div className="mt-3 flex items-center justify-between gap-2"><span className="text-[10px] text-muted-foreground">{selectedTarget ? `${selectedTarget.name} ${locked.includes(selectedTarget.id) ? '· locked' : '· selected'}` : current ? `${count} addressable edit targets` : "Awaiting source plate"}</span>{target && <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setTarget(null)}><X />Clear target</Button>}</div>
          </div>
          <div className="layers-output overflow-hidden rounded-lg border border-border"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2"><h2 className="text-xs font-semibold">Output</h2><div className="flex items-center gap-1"><Button size="sm" variant="ghost" className="h-7 text-[10px]" disabled={!source || !result} onClick={() => { setCompare((value) => !value); setVideoUrl(null); }}>{compare ? "Edited" : "Original"}</Button><Button size="icon" variant="ghost" className="size-7" aria-label="Select edit region" title="Select edit region" disabled={!current} onClick={() => { setSelecting((value) => !value); setRegion(null); }}><Scan className={selecting ? "text-primary" : ""} /></Button><Button size="icon" variant="ghost" className="size-7" title="Zoom out" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(25, value - 25))}><ZoomOut /></Button><span className="w-9 text-center font-mono text-[9px]">{zoom}%</span><Button size="icon" variant="ghost" className="size-7" title="Zoom in" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(200, value + 25))}><ZoomIn /></Button></div></div>
            <div className="transparency-grid relative flex min-h-[340px] items-center justify-center overflow-auto p-4">
              {videoUrl ? <video src={videoUrl} controls className="max-h-[480px] w-full" /> : current ? <div ref={frame} className="relative shrink-0 touch-none select-none" style={{ width: `${zoom}%`, maxWidth: zoom <= 100 ? "100%" : undefined }} onPointerDown={(e) => { if (!selecting || busy) return; const p = point(e); drag.current = p; setRegion({ ...p, w: 0, h: 0 }); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={(e) => { if (!drag.current) return; const p = point(e), start = drag.current; setRegion({ x: Math.min(p.x, start.x), y: Math.min(p.y, start.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) }); }} onPointerUp={() => { drag.current = null; setRegion((r) => r && r.w > 0.02 && r.h > 0.02 ? r : null); }} onPointerCancel={() => { drag.current = null; }}><img src={compare && source ? source : current} alt={compare ? "Original frame" : "Layer output"} className="block max-h-[560px] w-full object-contain" draggable={false} />{region && <div className="pointer-events-none absolute border-2 border-dashed border-primary bg-primary/10" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.w * 100}%`, height: `${region.h * 100}%` }} />}</div> : <div className="flex flex-col items-center gap-3 text-muted-foreground"><ImagePlus className="size-10" /><p className="text-xs">Your edited frame</p></div>}
              {busy && <div className="absolute inset-0 grid place-items-center bg-background/70"><div className="flex flex-col items-center gap-3 px-6 text-center"><Loader2 className="size-7 animate-spin text-primary" /><p className="text-xs">{status}</p></div></div>}
            </div><div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2"><span className="font-mono text-[9px] text-muted-foreground">{selected ? shotCode(selected.order) : "SOURCE PLATE"}{region ? " · REGION SELECTED" : ""}</span><Button variant="ghost" size="sm" className="h-7 text-[10px]" disabled={!selected || !!busy} onClick={() => { if (selected) { const remaining = removeShot(shots, selected.id); setShots(remaining); setActive(remaining.at(-1)?.id ?? null); setVideoUrl(null); } }}><Undo2 />Undo frame</Button></div>
          </div>
          <div><div className="flex items-center justify-between"><h2 className="text-sm font-bold">Storyboard <span className="ml-1 text-xs font-normal text-muted-foreground">{ordered.length} shots</span></h2><Button variant="ghost" size="sm" disabled={!!busy} onClick={() => { const id = crypto.randomUUID(); setShots((previous) => upsertShot(previous, { id, dataUrl: "", prompt, beat: "New beat" })); setActive(id); }}><Plus />Add shot</Button></div>
            {!ordered.length && <div className="mt-3 grid min-h-20 place-items-center border-y border-dashed border-border text-xs text-muted-foreground">No shots yet</div>}
            <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto">{ordered.map((shot) => <div key={shot.id} className={cn("rounded-lg border p-3", shot.id === active ? "border-primary bg-primary/5" : "border-border")}><div className="flex items-center gap-2"><Button variant="ghost" className="size-10 shrink-0 overflow-hidden p-0" aria-label={`Open ${shotCode(shot.order)}`} onClick={() => { setActive(shot.id); setVideoUrl(null); setCompare(false); }}>{shot.dataUrl ? <img src={shot.dataUrl} alt={shotCode(shot.order)} className="h-full w-full object-cover" /> : <ImagePlus />}</Button><span className="font-mono text-[10px] text-accent">{shotCode(shot.order)}</span><input aria-label={`${shotCode(shot.order)} story beat`} value={shot.beat ?? ""} onChange={(e) => setShots((previous) => patchShot(previous, shot.id, { beat: e.target.value }))} className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none" placeholder="Story beat" /><div className="flex"><Button variant="ghost" size="icon" className="size-6" aria-label={`Move ${shotCode(shot.order)} up`} title="Move shot up" disabled={shot.order === 1 || !!busy} onClick={() => setShots((previous) => moveShot(previous, shot.id, -1))}><ArrowUp /></Button><Button variant="ghost" size="icon" className="size-6" aria-label={`Move ${shotCode(shot.order)} down`} title="Move shot down" disabled={shot.order === ordered.length || !!busy} onClick={() => setShots((previous) => moveShot(previous, shot.id, 1))}><ArrowDown /></Button><Button variant="ghost" size="icon" className="size-6" aria-label={`Delete ${shotCode(shot.order)}`} title="Delete shot" disabled={!!busy} onClick={() => { setShots((previous) => removeShot(previous, shot.id)); if (active === shot.id) setActive(null); }}><Trash2 /></Button></div></div><textarea aria-label={`${shotCode(shot.order)} prompt`} rows={2} value={shot.prompt} onChange={(e) => setShots((previous) => patchShot(previous, shot.id, { prompt: e.target.value }))} className="mt-2 w-full resize-y bg-transparent text-xs outline-none" /><div className="mt-1 flex items-center gap-2"><input aria-label={`${shotCode(shot.order)} motion`} value={shot.motion ?? ""} onChange={(e) => setShots((previous) => patchShot(previous, shot.id, { motion: e.target.value }))} placeholder="Motion direction…" className="min-w-0 flex-1 bg-transparent text-[10px] text-muted-foreground outline-none" /><Button variant="outline" size="sm" className="h-6 text-[10px]" disabled={!!busy || !shot.prompt.trim()} onClick={() => void render(shot.prompt, undefined, shot)}><Wand2 />{shot.dataUrl ? "Re-render" : "Render"}</Button></div></div>)}</div>
            <Button variant="ghost" size="sm" className="mt-2 text-xs" disabled={!ordered.length} onClick={() => void action("Copying shot list…", async () => { await navigator.clipboard.writeText(buildSequencePrompt(ordered, identity)); setStatus("Shot list copied"); })}><Copy />Copy shot list</Button>
          </div>
          <div className="border-t border-border pt-5"><h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Film className="size-4 text-primary" />Motion pass</h2><div className="grid grid-cols-[minmax(0,1fr)_80px] gap-2"><select aria-label="Camera movement" value={camera} onChange={(e) => setCamera(e.target.value)} className={field}>{CAMERA_MOVES.map((move) => <option key={move.id} value={move.id}>{move.label}</option>)}</select><select aria-label="Video duration" value={duration} onChange={(e) => setDuration(e.target.value)} className={field}>{["4s", "6s", "8s"].map((time) => <option key={time}>{time}</option>)}</select></div><Button variant="outline" className="mt-3 w-full" disabled={!current || !!busy} onClick={() => void action("Rendering motion…", async () => { if (!current) return; const motion = selected?.motion || CAMERA_MOVES.find((move) => move.id === camera)?.phrase || ""; const url = await generateVideo(selected?.prompt || prompt || "Animate this frame with consistent identity", videoEngine, motion, { image: await urlToBlob(current), duration, onStatus: (s) => setStatus(`Motion · ${s}`) }); setVideoUrl(url); onAsset(url, "video", `${name}_motion.mp4`, true); setStatus("Motion added to gallery and timeline"); })}><Camera />Animate frame</Button></div>
          <div className="border-t border-border pt-5"><Step number="04" title="Save & export" /><div className="mt-3 grid grid-cols-2 gap-2"><Button variant="outline" disabled={!hasRenders || !!busy} onClick={() => void save()}><Save />Save shoot</Button><Button variant="outline" disabled={!current || !!busy} onClick={() => current && void action("Downloading PNG…", async () => { await downloadLayer(current, `${name}.png`); setStatus("PNG downloaded"); })}><Download />Download PNG</Button><Button variant="outline" disabled={!hasRenders || !!busy} onClick={() => void action("Exporting frames…", async () => { for (const shot of ordered.filter((s) => s.dataUrl)) await downloadLayer(shot.dataUrl, `${shotCode(shot.order)}.png`); setStatus("Frames downloaded"); })}><Download />All frames</Button><Button variant="outline" disabled={!hasRenders || !!busy} onClick={() => void action("Composing sheet…", async () => { const url = await composeLayersSheet(ordered.filter((s) => s.dataUrl).map((s) => s.dataUrl)); await downloadLayer(url, `${name}_sheet.png`); setStatus("Contact sheet downloaded"); })}><Layers3 />Composite sheet</Button><Button disabled={!hasRenders || !!busy} onClick={() => void action("Exporting ZIP…", async () => { await exportLayersProject(project()); setStatus("Project ZIP downloaded"); })}><Download />Export ZIP</Button><Button variant="secondary" disabled={!current || !!busy} onClick={() => { if (current) { onAsset(current, "image", `${name}_layer.png`, true); setStatus("Frame added to gallery and timeline"); } }}><FolderInput />Send to timeline</Button></div></div>
        </section>
      </div>
    </div>
  );
}
function Step({ number, title }: { number: string; title: string }) {
  return <h2 className="flex items-center gap-2 text-xs font-bold"><span className="font-mono text-[10px] text-primary">{number}</span><span className="h-px w-5 bg-border" />{title}</h2>;
}
