import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Check, Film, ImagePlus, Loader2, Network, Palette, Play, Plug, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { downloadJson, missingComfyNodes, normalizeComfyUrl, parseComfyWorkflow, prepareComfyWorkflow, stylePrompt, STYLE_KEY, type ComfyWorkflow, type Moodboard } from "@/lib/creative-tools";
import importedWorkflow from "@/data/krea-style-workflow.json";
import pop from "@/assets/vintage-pop-reference.asset.json";
import thermal from "@/assets/thermal-airbrush-reference.asset.json";
import motionThumb from "@/assets/thumb-motion.jpg";
import upscaleThumb from "@/assets/thumb-upscale.jpg";

const BOARDS: Moodboard[] = [
  { id: "vintage-pop", name: "Vintage Pop Graphic", profile: "Bold vintage comic-book and pop-art 2D illustration, playful dense composition, nostalgic surrealism.", keywords: ["thick black outlines", "flat saturated colors", "stippled halftone", "hard-edged shadows", "four-point stars"], images: [pop.url] },
  { id: "thermal", name: "Thermal Airbrush", profile: "Thermal imaging blended with vintage airbrush and cosmic surrealism. Stark silhouettes and prismatic light beams on deep black backgrounds.", keywords: ["glowing neon gradients", "heavy film grain", "retro-futuristic aura", "soft focus luminescence", "high contrast silhouettes"], images: [thermal.url] },
];
type Props = { onAsset: (url: string, kind: "image" | "video", name: string, place?: boolean) => void; onCanvas: () => void; onLayers: () => void; onWorkflows: () => void; onAsk: (brief: string) => void };
type Tab = "moodboards" | "motion" | "comfy" | "tools";
export function CreativeTools(props: Props) {
  const [tab, setTab] = useState<Tab>("moodboards");
  return <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="mb-1 font-mono text-[10px] uppercase text-accent">Out the Mud Records / Creative lab</p><h1 className="font-display text-2xl font-bold">Creative tools</h1></div><span className="text-xs text-muted-foreground">Krea-inspired · connected to your studio</span></div>
    <nav aria-label="Creative tool categories" className="mb-6 flex gap-1 overflow-x-auto border-b border-border pb-3">{([ ["moodboards", Palette, "Moodboards"], ["motion", Film, "Motion transfer"], ["comfy", Network, "ComfyUI router"], ["tools", Sparkles, "All tools"] ] as const).map(([id, Icon, name]) => <Button key={id} size="sm" variant={tab === id ? "secondary" : "ghost"} aria-pressed={tab === id} onClick={() => setTab(id)}><Icon />{name}</Button>)}</nav>
    {tab === "moodboards" ? <Moodboards /> : tab === "motion" ? <MotionTransfer onComfy={() => setTab("comfy")} /> : tab === "comfy" ? <ComfyRouter onAsset={props.onAsset} /> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[
        { name: "Nodes", image: motionThumb, tag: "WORKFLOW", action: props.onCanvas, label: "Open canvas" },
        { name: "Image edit & background removal", image: pop.url, tag: "LAYERS", action: props.onLayers, label: "Open Layers" },
        { name: "Enhancer", image: upscaleThumb, tag: "IMAGE", action: props.onLayers, label: "Open enhance" },
        { name: "Genjutsu & Blender", image: thermal.url, tag: "EXTERNAL RENDER", action: props.onWorkflows, label: "Open workflows" },
        { name: "Canvas Agent", image: motionThumb, tag: "ORCHESTRATOR", action: () => props.onAsk("Build an image-to-video workflow for my idea. Ask for the subject, style references and shot duration before generating."), label: "Ask crew" },
      ].map((t) => <article key={t.name} className="overflow-hidden rounded-lg border border-border bg-card"><img src={t.image} alt={t.name} className="aspect-video w-full object-cover" /><div className="p-4"><p className="font-mono text-[9px] text-accent">{t.tag}</p><h2 className="my-2 text-sm font-bold">{t.name}</h2><Button size="sm" variant="secondary" onClick={t.action}>{t.label}</Button></div></article>)}
      <article className="rounded-lg border border-border bg-card p-4"><p className="font-mono text-[9px] text-muted-foreground">KREA CONNECTION REQUIRED</p><h2 className="my-2 text-sm font-bold">Krea 2 / Turbo · LoRA · Realtime</h2><p className="mb-4 text-xs leading-relaxed text-muted-foreground">These services are not connected. The uploaded Krea 2 style workflow runs through your ComfyUI partner nodes; LoRA training and Realtime require a separate Krea setup.</p><Button size="sm" variant="outline" onClick={() => setTab("comfy")}><Plug />Connect workflow</Button></article>
    </div>}
  </main>;
}

function Moodboards() {
  const [boards, setBoards] = useState<Moodboard[]>(BOARDS);
  const [selected, setSelected] = useState("");
  const [strength, setStrength] = useState(0.65);
  const [name, setName] = useState("");
  const [profile, setProfile] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem("reel-moodboard-selection") ?? "null"); if (saved) { setSelected(saved.id ?? ""); setStrength(saved.strength ?? 0.65); } const custom = JSON.parse(localStorage.getItem("reel-custom-moodboards") ?? "[]"); if (Array.isArray(custom)) setBoards([...BOARDS, ...custom.filter((b) => b && typeof b.name === "string" && Array.isArray(b.images))]); } catch { /* unavailable */ } }, []);
  function choose(id: string, amount = strength) {
    setSelected(id); setStrength(amount);
    const board = boards.find((b) => b.id === id) ?? null;
    try { localStorage.setItem(STYLE_KEY, board ? stylePrompt("", board, amount).trim() : ""); localStorage.setItem("reel-moodboard-selection", JSON.stringify({ id, strength: amount })); } catch { setError("Browser storage is full. This style could not be saved."); }
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    try { const urls = await Promise.all(Array.from(files).filter((f) => f.type.startsWith("image/")).map((file) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); }))); setImages((old) => [...old, ...urls]); } catch { setError("Could not read that reference image."); }
  }
  function create() {
    if (!name.trim() || !profile.trim()) return;
    const board: Moodboard = { id: crypto.randomUUID(), name: name.trim(), profile: profile.trim(), keywords: [], images };
    const next = [...boards, board];
    try { localStorage.setItem("reel-custom-moodboards", JSON.stringify(next.filter((b) => !BOARDS.some((p) => p.id === b.id)))); setBoards(next); setName(""); setProfile(""); setImages([]); setError(""); } catch { setError("Browser storage is full. Try smaller reference images."); }
  }
  return <div className="grid gap-7 lg:grid-cols-[1fr_300px]">
    <section><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold">Style library</h2><Button size="sm" variant="ghost" onClick={() => choose("")}><X />No style</Button></div><div className="grid gap-4 sm:grid-cols-2">{boards.map((b) => <article key={b.id} className={cn("overflow-hidden rounded-lg border bg-card", selected === b.id ? "border-primary" : "border-border")}>
      <div className="grid aspect-[16/10] grid-cols-1 overflow-hidden bg-muted">{b.images[0] ? <img src={b.images[0]} alt={b.name} className="h-full w-full object-cover" /> : <Palette className="m-auto size-12 text-muted-foreground" />}</div><div className="p-4"><h3 className="text-sm font-bold">{b.name}</h3><p className="my-2 min-h-14 text-xs leading-relaxed text-muted-foreground">{b.profile}</p><div className="mb-3 flex flex-wrap gap-1.5">{b.keywords.map((k) => <span key={k} className="text-[10px] text-accent">{k} ·</span>)}</div><Button size="sm" variant={selected === b.id ? "default" : "secondary"} onClick={() => choose(b.id)}>{selected === b.id ? <Check /> : <Palette />}{selected === b.id ? "Style active" : "Use style"}</Button>{!BOARDS.some((p) => p.id === b.id) && <Button size="sm" variant="ghost" aria-label={`Delete ${b.name}`} onClick={() => { const next = boards.filter((p) => p.id !== b.id); setBoards(next); localStorage.setItem("reel-custom-moodboards", JSON.stringify(next.filter((p) => !BOARDS.some((s) => s.id === p.id)))); if (selected === b.id) choose(""); }}><X /></Button>}</div>
    </article>)}</div></section>
    <aside className="space-y-5"><div><label htmlFor="style-strength" className="mb-2 flex justify-between text-xs font-semibold">Style strength<span>{Math.round(strength * 100)}%</span></label><input id="style-strength" type="range" min="0" max="1" step="0.05" value={strength} onChange={(e) => choose(selected, Number(e.target.value))} className="w-full accent-primary" /></div><div className="border-t border-border pt-5"><h2 className="mb-3 text-sm font-bold">New moodboard</h2><input aria-label="Moodboard name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="mb-2 w-full rounded-md border border-input bg-background p-2 text-xs" /><textarea aria-label="Moodboard taste profile" placeholder="Visual style, textures, colors…" rows={4} value={profile} onChange={(e) => setProfile(e.target.value)} className="w-full rounded-md border border-input bg-background p-2 text-xs" /><label className="my-3 flex cursor-pointer items-center gap-2 text-xs text-primary"><ImagePlus className="size-4" />Add references<input aria-label="Moodboard reference images" type="file" accept="image/*" multiple className="hidden" onChange={(e) => void upload(e.target.files)} /></label><div className="mb-3 flex flex-wrap gap-1">{images.map((url, i) => <img key={i} src={url} alt={`Reference ${i + 1}`} className="size-12 rounded object-cover" />)}</div><Button size="sm" disabled={!name.trim() || !profile.trim()} onClick={create}>Save moodboard</Button></div>{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</aside>
  </div>;
}

function useFileUrl(file: File | null) {
  const [url, setUrl] = useState("");
  useEffect(() => { if (!file) { setUrl(""); return; } const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }, [file]);
  return url;
}
function MotionTransfer({ onComfy }: { onComfy: () => void }) {
  const [character, setCharacter] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const characterUrl = useFileUrl(character), videoUrl = useFileUrl(video);
  return <section>
    <h2 className="mb-4 text-lg font-bold">Character & motion references</h2>
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="flex aspect-video cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-input bg-card">
        {characterUrl ? <img src={characterUrl} alt="Character reference" className="h-full w-full object-contain" /> : <><ImagePlus className="mb-2 size-6 text-primary" /><span className="text-xs">Add character</span></>}
        <input aria-label="Motion character image" type="file" accept="image/*" className="hidden" onChange={(e) => setCharacter(e.target.files?.[0] ?? null)} />
      </label>
      <div className="flex aspect-video flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-input bg-card">
        {videoUrl ? <video src={videoUrl} controls playsInline className="min-h-0 w-full flex-1 object-contain" /> : <Film className="mb-2 size-6 text-accent" />}
        <label className="cursor-pointer p-2 text-xs text-primary">{video ? "Replace motion reference" : "Add expression & motion"}<input aria-label="Motion source video" type="file" accept="video/*" className="hidden" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} /></label>
      </div>
    </div>
    <p className="my-4 text-xs text-muted-foreground">Dedicated character motion transfer needs a compatible workflow on your ComfyUI server. Krea motion transfer is not connected.</p>
    <Button size="sm" variant="outline" onClick={onComfy}><Plug />Connect motion workflow</Button>
  </section>;
}

async function comfyRequest(base: string, path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, { ...init, credentials: "omit", redirect: "error" });
  if (!response.ok) throw new Error(`ComfyUI ${response.status}: ${(await response.text()).slice(0, 220)}`);
  return response.json();
}
function ComfyRouter({ onAsset }: { onAsset: Props["onAsset"] }) {
  const [address, setAddress] = useState("");
  const [base, setBase] = useState("");
  const [trusted, setTrusted] = useState(false);
  const [workflow, setWorkflow] = useState<ComfyWorkflow>(() => parseComfyWorkflow(importedWorkflow));
  const [installed, setInstalled] = useState<Record<string, unknown>>({});
  const [prompt, setPrompt] = useState(String(importedWorkflow["1"].inputs["prompt"]));
  const [files, setFiles] = useState<Record<string, File>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ url: string; kind: "image" | "video"; name: string }[]>([]);
  const active = useRef(0);
  useEffect(() => { try { setAddress(localStorage.getItem("reel-comfy-address") ?? ""); } catch { /* unavailable */ } return () => { active.current++; }; }, []);
  const missing = missingComfyNodes(workflow, installed);
  async function connect() {
    if (!trusted || busy) return;
    setBusy(true); setBase(""); setStatus("Checking server nodes…");
    try { const url = normalizeComfyUrl(address); const info = await comfyRequest(url, "/object_info"); setInstalled(info); setBase(url); localStorage.setItem("reel-comfy-address", url); const unavailable = missingComfyNodes(workflow, info); setStatus(unavailable.length ? `Missing nodes: ${unavailable.join(", ")}` : "Connected. Workflow nodes are installed."); } catch (e) { setStatus(e instanceof TypeError ? "Cannot reach ComfyUI. Check its address, browser permissions and CORS settings. HTTPS pages may block an HTTP server." : e instanceof Error ? e.message : "Connection failed."); } finally { setBusy(false); }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try { const graph = parseComfyWorkflow(JSON.parse(await file.text())); setWorkflow(graph); setFiles({}); setResults([]); const node = Object.values(graph).find((n) => typeof n.inputs["prompt"] === "string"); setPrompt(String(node?.inputs["prompt"] ?? "")); setStatus("Workflow imported. Original custom nodes preserved."); } catch (e) { setStatus(e instanceof Error ? e.message : "Invalid workflow."); }
  }
  async function run() {
    if (!base || missing.length || busy) return;
    const runId = ++active.current; setBusy(true); setResults([]); setStatus("Uploading references…");
    try {
      const names: Record<string, string> = {};
      for (const [id, file] of Object.entries(files)) { const form = new FormData(); form.set("image", file, file.name); form.set("type", "input"); form.set("overwrite", "false"); const uploaded = await comfyRequest(base, "/upload/image", { method: "POST", body: form }); if (typeof uploaded.name !== "string") throw new Error("ComfyUI did not return an uploaded filename."); names[id] = uploaded.subfolder ? `${uploaded.subfolder}/${uploaded.name}` : uploaded.name; }
      const graph = prepareComfyWorkflow(workflow, prompt, names);
      const submitted = await comfyRequest(base, "/prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph, client_id: crypto.randomUUID() }) });
      if (!submitted.prompt_id) throw new Error(JSON.stringify(submitted.error ?? submitted.node_errors ?? "ComfyUI rejected the workflow."));
      setStatus("Queued on your ComfyUI server…");
      while (active.current === runId) {
        await new Promise((r) => setTimeout(r, 2500));
        if (active.current !== runId) break;
        const history = await comfyRequest(base, `/history/${encodeURIComponent(submitted.prompt_id)}`); const job = history[submitted.prompt_id];
        if (!job) continue;
        if (job.status?.status_str === "error") throw new Error(JSON.stringify(job.status.messages ?? "Workflow failed."));
        if (!job.status?.completed) { setStatus("Rendering on your ComfyUI server…"); continue; }
        const outputs: { url: string; kind: "image" | "video"; name: string }[] = [];
        for (const output of Object.values(job.outputs ?? {}) as Record<string, unknown>[]) for (const key of ["images", "gifs", "videos"]) { const items = output[key]; if (!Array.isArray(items)) continue; for (const item of items) { if (typeof item.filename !== "string") continue; const query = new URLSearchParams({ filename: item.filename, subfolder: item.subfolder ?? "", type: item.type ?? "output" }); const response = await fetch(`${base}/view?${query}`, { credentials: "omit", redirect: "error" }); if (!response.ok) throw new Error(`Could not download output: ${response.status}`); const blob = await response.blob(); const kind = /\.(mp4|webm|mov)$/i.test(item.filename) ? "video" : "image"; const url = kind === "image" ? await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); }) : URL.createObjectURL(blob); outputs.push({ url, kind, name: item.filename }); onAsset(url, kind, item.filename, true); } }
        setResults(outputs); setStatus(outputs.length ? `${outputs.length} output(s) added to gallery and timeline.` : "Completed, but no image/video outputs were returned."); break;
      }
    } catch (e) { if (active.current === runId) setStatus(e instanceof Error ? e.message : "Workflow failed."); } finally { if (active.current === runId) setBusy(false); }
  }
  return <section><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-bold">Krea style references / ComfyUI</h2><div className="flex gap-2"><Button asChild size="sm" variant="outline"><label><ArrowUpFromLine />Import API JSON<input aria-label="Import ComfyUI workflow" type="file" accept="application/json,.json" className="hidden" onChange={(e) => void importFile(e.target.files?.[0])} /></label></Button><Button size="sm" variant="outline" onClick={() => downloadJson(workflow, "comfy-workflow.json")}><ArrowDownToLine />Export</Button></div></div><div className="mb-5 flex flex-wrap gap-2"><input aria-label="ComfyUI server address" placeholder="https://your-comfy-server" value={address} onChange={(e) => { setAddress(e.target.value); setBase(""); setTrusted(false); }} className="min-w-0 flex-1 rounded-md border border-input bg-background p-2 text-xs" /><Button size="sm" disabled={busy || !address.trim() || !trusted} onClick={() => void connect()}><Plug />{base ? "Recheck" : "Connect"}</Button></div><label className="mb-3 flex items-center gap-2 text-xs"><input type="checkbox" aria-label="Trust this ComfyUI server" checked={trusted} disabled={busy} onChange={(e) => { setTrusted(e.target.checked); setBase(""); }} />I trust this server with my prompts and reference files.</label><p className="mb-5 text-xs leading-relaxed text-muted-foreground">Your ComfyUI server runs these nodes and handles its own Krea account. Allow this studio's origin in CORS. No provider keys are stored in this browser.</p><div className="grid gap-5 lg:grid-cols-[1fr_300px]"><div className="grid gap-3 sm:grid-cols-2">{Object.entries(workflow).map(([id, node]) => <article key={id} className="rounded-lg border border-border bg-card p-4"><div className="mb-2 flex items-center gap-2"><Network className="size-4 text-primary" /><h3 className="min-w-0 flex-1 truncate text-xs font-bold">{node._meta?.title ?? node.class_type}</h3><span className="font-mono text-[9px] text-muted-foreground">#{id}</span></div><p className="mb-3 break-all font-mono text-[10px] text-muted-foreground">{node.class_type}</p>{Object.entries(node.inputs).filter(([, v]) => Array.isArray(v)).map(([key, v]) => <p key={key} className="text-[10px] text-accent">{key} ← #{String((v as unknown[])[0])}</p>)}{node.class_type === "LoadImage" && <label className="mt-2 block text-xs text-primary">{files[id]?.name ?? String(node.inputs["image"])}<input aria-label={`Reference for node ${id}`} type="file" accept="image/*" className="mt-2 block w-full text-[10px]" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) setFiles((old) => ({ ...old, [id]: f })); }} /></label>}{base && <p className={cn("mt-3 text-[10px]", node.class_type in installed ? "text-accent" : "text-destructive")}>{node.class_type in installed ? "Installed" : "Not installed"}</p>}</article>)}</div><aside><textarea aria-label="ComfyUI prompt" rows={8} value={prompt} disabled={busy} onChange={(e) => setPrompt(e.target.value)} className="mb-3 w-full rounded-md border border-input bg-background p-3 text-xs" /><Button size="sm" disabled={!base || !!missing.length || busy} onClick={() => void run()}>{busy ? <Loader2 className="animate-spin" /> : <Play />}Run workflow</Button>{busy && <Button size="sm" variant="ghost" onClick={() => { active.current++; setBusy(false); setStatus("Stopped watching. The job may continue on your ComfyUI server."); }}>Stop watching</Button>}<p role="status" className="mt-3 break-words text-xs text-muted-foreground">{status || "Connect a server to check and run this graph."}</p></aside></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{results.map((r, i) => <div key={i} className="overflow-hidden rounded-md border border-border">{r.kind === "video" ? <video controls src={r.url} className="aspect-video w-full object-contain" /> : <img src={r.url} alt={r.name} className="aspect-video w-full object-contain" />}</div>)}</div></section>;
}