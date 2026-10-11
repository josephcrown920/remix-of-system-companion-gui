import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clapperboard,
  Send,
  Loader2,
  Play,
  Pause,
  Scissors,
  MousePointer2,
  Upload,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Volume2,
  Eye,
  Gauge,
  Wand2,
  SkipBack,
  Download,
  Film,
  Images,
  Save,
  FolderOpen,
  Bot,
  Layers3,
  CheckCircle2,
  CircleDashed,
  AlertCircle,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import {
  AGENTS,
  TRACKS,
  TRACK_LABEL,
  agentById,
  type AgentAction,
  type TrackId,
} from "@/lib/agents";
import {
  IMAGE_ENGINES,
  VIDEO_ENGINES,
  DEFAULT_IMAGE_ENGINE,
  DEFAULT_VIDEO_ENGINE,
  CAMERA_MOVES,
  MOTION_CURVES,
  DEFAULT_MOTION,
  motionPhrase,
  FILTERS,
  PRESETS,
  type Motion,
} from "@/lib/engines";
import { generateImage, generateVideo } from "@/lib/generate";
import { renderTimeline, download } from "@/lib/export";
import { NodeCanvas } from "@/components/NodeCanvas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CreativeChat, CrewBoard, DIRECTING_STYLES, type CrewRun } from "@/components/CreativeChat";
import { StudioCover } from "@/components/StudioCover";
import { readSse } from "@/lib/agent-stream";
import {
  clipForAsset,
  serializableAssets,
  type EditorAsset,
  type EditorClip,
  type SavedSession,
} from "@/lib/editor-state";
import scene1 from "@/assets/scene1.jpg";
import scene2 from "@/assets/scene2.jpg";
import scene3 from "@/assets/scene3.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reel — AI Co-Editor Video Studio" },
      {
        name: "description",
        content:
          "Drop your footage, tell your AI co-editor what you want, and cut it together on a real multi-track timeline.",
      },
      { property: "og:title", content: "Reel — AI Co-Editor Video Studio" },
      {
        property: "og:description",
        content:
          "Drop your footage, tell your AI co-editor what you want, and cut it together on a real multi-track timeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Editor,
});

type Kind = "video" | "image" | "audio";
type Asset = EditorAsset;
type Clip = EditorClip;
type Msg = { role: "user" | "assistant"; text: string; steps?: string[]; agent?: string };

const uid = () => Math.random().toString(36).slice(2, 8);
const tc = (s: number) => {
  const f = Math.floor((s % 1) * 24);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
};

const GREETING: Msg = {
  role: "assistant",
  agent: "orchestrator",
  text: "What do you wanna create? Tell me your idea, the mood, and who it’s for. We can start from your files or create something new together.",
};

function Editor() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(46);
  const [tool, setTool] = useState<"select" | "razor">("select");
  const [agent, setAgent] = useState("orchestrator");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [directingStyle, setDirectingStyle] = useState("original");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [mode, setMode] = useState<"start" | "edit" | "canvas">("start");
  const [imgEngine, setImgEngine] = useState(DEFAULT_IMAGE_ENGINE);
  const [vidEngine, setVidEngine] = useState(DEFAULT_VIDEO_ENGINE);
  const [motion, setMotion] = useState<Motion>(DEFAULT_MOTION);
  const [exporting, setExporting] = useState(false);
  const [exportPct, setExportPct] = useState(0);
  const [mediaView, setMediaView] = useState<"media" | "generations">("media");
  const [sideView, setSideView] = useState<"director" | "adjust">("director");
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [sessionName, setSessionName] = useState("Untitled cut");
  const [crew, setCrew] = useState<CrewRun[]>([]);
  const laneRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const duration = useMemo(() => Math.max(12, ...clips.map((c) => c.start + c.dur)), [clips]);
  const assetOf = useCallback((id: string) => assets.find((a) => a.id === id), [assets]);
  const selected = clips.find((c) => c.id === sel) ?? null;

  const videoClip = useMemo(() => {
    for (const t of ["V3", "V2", "V1"] as TrackId[]) {
      const c = clips.find(
        (x) => x.track === t && playhead >= x.start && playhead < x.start + x.dur,
      );
      if (c && assetOf(c.assetId)?.kind !== "audio") return c;
    }
    return null;
  }, [clips, playhead, assetOf]);

  const audioClip = useMemo(
    () =>
      clips.find(
        (x) =>
          (x.track === "A1" || x.track === "A2") &&
          playhead >= x.start &&
          playhead < x.start + x.dur,
      ) ?? null,
    [clips, playhead],
  );

  // transport
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const d = (now - last) / 1000;
      last = now;
      setPlayhead((p) => {
        const next = p + d;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration]);

  // keep media elements in sync
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoClip) return;
    const want = videoClip.inPoint + (playhead - videoClip.start);
    if (Math.abs(v.currentTime - want) > 0.3) v.currentTime = Math.max(0, want);
    v.playbackRate = videoClip.speed;
    v.volume = videoClip.volume;
    if (playing) void v.play().catch(() => {});
    else v.pause();
  }, [playing, videoClip, playhead]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !audioClip) return;
    const want = audioClip.inPoint + (playhead - audioClip.start);
    if (Math.abs(a.currentTime - want) > 0.3) a.currentTime = Math.max(0, want);
    a.volume = audioClip.volume;
    if (playing) void a.play().catch(() => {});
    else a.pause();
  }, [playing, audioClip, playhead]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("reel-editor-sessions");
      if (stored) setSessions(JSON.parse(stored) as SavedSession[]);
    } catch {
      setSessions([]);
    }
  }, []);

  function newSession() {
    if (busy || genBusy || exporting) return;
    setAssets([]);
    setClips([]);
    setSel(null);
    setPlayhead(0);
    setPlaying(false);
    setMsgs([GREETING]);
    setBrief("");
    setCrew([]);
    setSessionName("Untitled cut");
    setAgent("orchestrator");
    setDirectingStyle("original");
    setMode("start");
  }

  function saveSession() {
    const session: SavedSession = {
      id: uid(),
      name: sessionName.trim() || "Untitled cut",
      updatedAt: new Date().toISOString(),
      assets: serializableAssets(assets),
      clips,
      messages: msgs,
      agent,
      imageEngine: imgEngine,
      videoEngine: vidEngine,
    };
    const next = [session, ...sessions].slice(0, 12);
    setSessions(next);
    window.localStorage.setItem("reel-editor-sessions", JSON.stringify(next));
  }

  function openSession(id: string) {
    const session = sessions.find((item) => item.id === id);
    if (!session) return;
    setMode("edit");
    setPlaying(false);
    setCrew([]);
    setSessionName(session.name);
    setAssets(session.assets);
    setClips(session.clips);
    setMsgs(session.messages);
    setAgent(session.agent);
    setImgEngine(session.imageEngine);
    setVidEngine(session.videoEngine);
    setSel(null);
    setPlayhead(0);
  }

  /* ---------- media bin ---------- */
  async function ingest(files: FileList | null) {
    if (!files) return;
    const added: Asset[] = [];
    for (const f of Array.from(files)) {
      const kind: Kind = f.type.startsWith("video")
        ? "video"
        : f.type.startsWith("audio")
          ? "audio"
          : "image";
      const url = URL.createObjectURL(f);
      const dur = kind === "image" ? 4 : await probe(url, kind);
      added.push({ id: uid(), name: f.name, kind, url, dur });
    }
    setAssets((a) => [...a, ...added]);
    if (added.length) {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          agent,
          text: `Logged ${added.length} new ${added.length === 1 ? "file" : "files"} in the bin. Tell me the cut you're after.`,
          steps: added.map((a) => `Ingested ${a.name} · ${a.dur.toFixed(1)}s`),
        },
      ]);
    }
  }

  function probe(url: string, kind: Kind) {
    return new Promise<number>((res) => {
      const el = document.createElement(kind === "audio" ? "audio" : "video");
      el.preload = "metadata";
      el.onloadedmetadata = () => res(Number.isFinite(el.duration) ? el.duration : 5);
      el.onerror = () => res(5);
      el.src = url;
    });
  }

  function addToTimeline(asset: Asset, track?: TrackId) {
    setClips((cs) => {
      const clip = clipForAsset(asset, cs, uid());
      return [
        ...cs,
        track
          ? {
              ...clip,
              track,
              start: cs
                .filter((c) => c.track === track)
                .reduce((end, c) => Math.max(end, c.start + c.dur), 0),
            }
          : clip,
      ];
    });
  }

  async function generateBroll() {
    const p = brief.trim();
    if (!p || genBusy) return;
    setGenBusy(true);
    try {
      const url = await generateImage(p, imgEngine);
      const a: Asset = {
        id: uid(),
        name: `gen_${uid()}.png`,
        kind: "image",
        url,
        dur: 4,
        generated: true,
      };
      setAssets((x) => [...x, a]);
      addToTimeline(a, "V2");
      setMediaView("generations");
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          agent,
          text: "Generated a b-roll plate and placed it in your gallery and V2.",
          steps: [`Generated "${p.slice(0, 48)}"`],
        },
      ]);
    } catch (e) {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          agent,
          text: `Couldn't generate that plate — ${e instanceof Error ? e.message : "the AI service didn't return an image."}`,
        },
      ]);
    } finally {
      setGenBusy(false);
    }
  }

  async function generateClip() {
    const p = brief.trim();
    if (!p || genBusy) return;
    setGenBusy(true);
    try {
      const url = await generateVideo(p, vidEngine, motionPhrase(motion), {
        onStatus: (s) =>
          setMsgs((m) => [
            ...m.slice(0, -1),
            { role: "assistant", agent, text: `Rendering video… ${s}` },
          ]),
      });
      const a: Asset = {
        id: uid(),
        name: `clip_${uid()}.mp4`,
        kind: "video",
        url,
        dur: 6,
        generated: true,
      };
      setAssets((x) => [...x, a]);
      addToTimeline(a, "V1");
      setMediaView("generations");
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          agent,
          text: "Rendered a video clip and placed it in your gallery and timeline.",
          steps: [`Motion: ${motionPhrase(motion)}`],
        },
      ]);
    } catch (e) {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          agent,
          text: `Video render failed — ${e instanceof Error ? e.message : "unknown error"}`,
        },
      ]);
    } finally {
      setGenBusy(false);
    }
  }

  function addAsset(url: string, kind: "image" | "video", name: string, place = false) {
    const asset: Asset = {
      id: uid(),
      name,
      kind,
      url,
      dur: kind === "video" ? 6 : 4,
      generated: true,
    };
    setAssets((x) => [...x, asset]);
    if (place) addToTimeline(asset, kind === "image" ? "V2" : "V1");
    setMediaView("generations");
    setMsgs((m) => [
      ...m,
      {
        role: "assistant",
        agent,
        text: `${name} is now in Generations${place ? " and on the timeline" : ""}.`,
      },
    ]);
  }

  async function exportVideo() {
    if (!clips.length || exporting) return;
    setPlaying(false);
    setExporting(true);
    setExportPct(0);
    try {
      const blob = await renderTimeline(
        clips.map((c) => ({
          assetId: c.assetId,
          track: c.track,
          start: c.start,
          dur: c.dur,
          inPoint: c.inPoint,
          opacity: c.opacity,
          speed: c.speed,
          volume: c.volume,
          filterCss: FILTERS[c.filter] ?? "none",
        })),
        assets.map((a) => ({ id: a.id, kind: a.kind, url: a.url })),
        duration,
        setExportPct,
      );
      download(blob, "reel-edit.webm");
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          agent,
          text: "Exported your cut as a WebM file — check your downloads.",
        },
      ]);
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          agent,
          text: "Export failed — your browser may not support recording. Try Chrome or Edge.",
        },
      ]);
    } finally {
      setExporting(false);
    }
  }

  /* ---------- timeline editing ---------- */
  function applyActions(actions: AgentAction[]) {
    setClips((cs) => {
      let next = [...cs];
      for (const a of actions) {
        if (a.op === "add") {
          const asset = assets.find((x) => x.id === a.assetId);
          if (!asset) continue;
          next.push({
            id: uid(),
            assetId: asset.id,
            track: a.track ?? "V1",
            start: Math.max(0, a.start ?? 0),
            dur: Math.max(0.3, a.dur ?? asset.dur),
            inPoint: 0,
            name: a.name ?? asset.name.replace(/\.[^.]+$/, ""),
            volume: 1,
            opacity: 1,
            speed: 1,
            filter: "none",
          });
        } else if (a.op === "remove") {
          next = next.filter((c) => c.id !== a.clipId);
        } else if (a.op === "trim") {
          next = next.map((c) => (c.id === a.clipId ? { ...c, dur: Math.max(0.3, a.dur) } : c));
        } else if (a.op === "move") {
          next = next.map((c) =>
            c.id === a.clipId
              ? { ...c, track: a.track ?? c.track, start: Math.max(0, a.start ?? c.start) }
              : c,
          );
        } else if (a.op === "split") {
          const c = next.find((x) => x.id === a.clipId);
          if (!c) continue;
          const off = Math.min(Math.max(0.2, a.at), c.dur - 0.2);
          next = next.flatMap((x) =>
            x.id !== c.id
              ? [x]
              : [
                  { ...x, dur: off },
                  {
                    ...x,
                    id: uid(),
                    start: x.start + off,
                    dur: x.dur - off,
                    inPoint: x.inPoint + off,
                  },
                ],
          );
        } else if (a.op === "set") {
          next = next.map((c) =>
            c.id === a.clipId
              ? {
                  ...c,
                  volume: a.volume ?? c.volume,
                  opacity: a.opacity ?? c.opacity,
                  speed: a.speed ?? c.speed,
                  filter: a.filter ?? c.filter,
                }
              : c,
          );
        }
      }
      return next;
    });
  }

  function splitAt(clip: Clip, at: number) {
    const off = at - clip.start;
    if (off <= 0.2 || off >= clip.dur - 0.2) return;
    setClips((cs) =>
      cs.flatMap((x) =>
        x.id !== clip.id
          ? [x]
          : [
              { ...x, dur: off },
              { ...x, id: uid(), start: x.start + off, dur: x.dur - off, inPoint: x.inPoint + off },
            ],
      ),
    );
  }

  function onClipPointerDown(e: React.PointerEvent, clip: Clip) {
    e.stopPropagation();
    const lane = laneRef.current;
    if (!lane) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offX = e.clientX - rect.left;
    if (tool === "razor") {
      splitAt(clip, clip.start + offX / zoom);
      return;
    }
    setSel(clip.id);
    const mode = offX < 10 ? "left" : offX > rect.width - 10 ? "right" : "move";
    const startClip = { ...clip };
    const originX = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const d = (ev.clientX - originX) / zoom;
      setClips((cs) =>
        cs.map((c) => {
          if (c.id !== clip.id) return c;
          if (mode === "move") return { ...c, start: Math.max(0, startClip.start + d) };
          if (mode === "left") {
            const delta = Math.min(Math.max(d, -startClip.start), startClip.dur - 0.3);
            return {
              ...c,
              start: startClip.start + delta,
              dur: startClip.dur - delta,
              inPoint: Math.max(0, startClip.inPoint + delta),
            };
          }
          return { ...c, dur: Math.max(0.3, startClip.dur + d) };
        }),
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function scrub(e: React.PointerEvent) {
    const lane = laneRef.current;
    if (!lane) return;
    const seek = (clientX: number) => {
      const x = clientX - lane.getBoundingClientRect().left + lane.scrollLeft;
      setPlayhead(Math.min(duration, Math.max(0, x / zoom)));
    };
    seek(e.clientX);
    const move = (ev: PointerEvent) => seek(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /* ---------- agent ---------- */
  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setBrief("");
    setMsgs((m) => [...m, { role: "user", text: t }]);
    setBusy(true);
    const isOrchestrator = agent === "orchestrator";
    if (isOrchestrator) {
      setCrew([]);
    }
    try {
      const r = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent,
          brief: `${t}\n\nDIRECTING STYLE: ${DIRECTING_STYLES.find((style) => style.id === directingStyle)?.brief ?? "Follow the user’s vision."}`,
          history: msgs.slice(-8).map((m) => ({ role: m.role, text: m.text })),
          assets: assets.map((a) => ({ id: a.id, name: a.name, kind: a.kind, dur: a.dur })),
          clips: clips.map((c) => ({
            id: c.id,
            assetId: c.assetId,
            track: c.track,
            start: c.start,
            dur: c.dur,
          })),
        }),
      });
      type Done = { reply: string; steps?: string[]; actions?: AgentAction[]; crew?: CrewRun[] };
      if (!r.ok || !r.body) {
        const e = (await r.json().catch(() => null)) as Done | null;
        throw new Error(e?.reply || "The creative crew could not respond.");
      }
      setMsgs((m) => [...m, { role: "assistant", agent, text: "" }]);
      const setLast = (patch: Partial<Msg>) =>
        setMsgs((m) => [...m.slice(0, -1), { ...m[m.length - 1]!, ...patch }]);
      let final: Done | null = null;
      let failed = false;
      await readSse(r.body, (event, data) => {
        if (event === "ping") return;
        const d = JSON.parse(data) as Done & { text?: string };
        if (event === "reply") {
          if (d.text) setLast({ text: d.text });
        } else if (event === "done" || event === "error") {
          final = d;
          failed = event === "error";
        }
      });
      const done = final as Done | null;
      if (!done) throw new Error("The creative crew lost connection. Please try again.");
      if (!failed && done.actions?.length) applyActions(done.actions);
      setLast({ text: done.reply, steps: done.steps ?? [] });
      if (isOrchestrator) setCrew(failed ? [] : (done.crew ?? []));
      if (!failed && voiceOn && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(done.reply));
      }
    } catch (error) {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          agent,
          text:
            error instanceof Error
              ? error.message
              : "I lost connection to the editing brain. Try that again.",
        },
      ]);
      if (isOrchestrator) setCrew((runs) => runs.map((run) => ({ ...run, status: "failed" })));
    } finally {
      setBusy(false);
    }
  }

  const active = agentById(agent);
  const previewAsset = videoClip ? assetOf(videoClip.assetId) : null;
  const audioAsset = audioClip ? assetOf(audioClip.assetId) : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col overflow-hidden border-border bg-background/65 font-sans text-foreground backdrop-blur-2xl sm:min-h-[calc(100vh-32px)] sm:rounded-xl sm:border sm:studio-frame lg:my-4">
      {/* top bar */}
      <header className="sticky top-0 z-50 flex h-12 items-center justify-between gap-2 border-b border-border bg-card/75 px-3 backdrop-blur-2xl sm:px-4">
        <div className="flex items-center gap-2">
          <input
            aria-label="Session name"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            className="hidden w-32 rounded-md border border-border bg-transparent px-2 py-1 text-xs font-semibold outline-none focus:border-primary md:block"
          />
          <select
            aria-label="Open session"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) openSession(e.target.value);
              e.target.value = "";
            }}
            className="hidden max-w-36 rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-muted-foreground sm:block"
          >
            <option value="">Sessions · {sessions.length}</option>
            {sessions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="icon"
            onClick={newSession}
            disabled={busy || genBusy || exporting}
            title="New session"
            aria-label="New session"
          >
            <Plus className="size-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={saveSession}
            title="Save session"
            aria-label="Save session"
            className="grid size-8 place-items-center rounded-md border border-border glass-control text-muted-foreground transition hover:text-foreground"
          >
            <Save className="size-3.5" />
          </Button>
          <span className="flex items-center gap-1.5" aria-hidden="true">
            <i className="size-2.5 rounded-full bg-destructive" />
            <i className="size-2.5 rounded-full bg-chart-5" />
            <i className="size-2.5 rounded-full bg-chart-3" />
          </span>
          <div className="ml-1 grid size-6 place-items-center rounded-md glass-control text-primary">
            <Clapperboard className="size-3.5" />
          </div>
          <span className="font-display text-sm font-bold">REEL</span>
          <span className="hidden font-mono text-[9px] uppercase text-muted-foreground md:inline">
            AI creative studio
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border glass-control p-0.5 text-[11px]">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMode("start")}
              className={cn("h-6 px-2", mode === "start" && "bg-primary/20 text-primary")}
            >
              <MessageSquare className="size-3" />
              <span className="hidden sm:inline">Chat</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => setMode("edit")}
              className={cn(
                "rounded-md px-2.5 py-1 transition",
                mode === "edit"
                  ? "bg-primary/20 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Editor
            </Button>
            <Button
              variant="ghost"
              onClick={() => setMode("canvas")}
              className={cn(
                "rounded-md px-2.5 py-1 transition",
                mode === "canvas"
                  ? "bg-primary/20 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Canvas
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={() => void exportVideo()}
            disabled={exporting || !clips.length}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition hover:bg-accent disabled:opacity-40"
          >
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            {exporting ? `${Math.round(exportPct * 100)}%` : "Export"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setPickerOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md border border-border glass-control px-2.5 py-1.5 text-xs transition hover:border-primary"
          >
            <span
              className="grid size-5 place-items-center rounded-full font-mono text-[9px] font-bold text-primary-foreground"
              style={{ background: active.accent }}
            >
              {active.short}
            </span>
            <span className="hidden font-medium sm:inline">{active.name}</span>
            <Sparkles className="size-3 text-muted-foreground" />
          </Button>
        </div>
      </header>

      {pickerOpen && (
        <div className="animate-rise border-b border-border glass-panel p-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Choose your co-editor
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {AGENTS.map((a) => (
              <Button
                variant="ghost"
                key={a.id}
                disabled={!a.available}
                onClick={() => {
                  setAgent(a.id);
                  setPickerOpen(false);
                  setMsgs((m) => [
                    ...m,
                    {
                      role: "assistant",
                      agent: a.id,
                      text: `${a.name} here — ${a.role.toLowerCase()}. Where do you want to take this cut?`,
                    },
                  ]);
                }}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition",
                  a.id === agent
                    ? "border-primary bg-primary/10"
                    : "border-border glass-control hover:border-muted-foreground",
                  !a.available && "opacity-40",
                )}
              >
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-lg font-mono text-[10px] font-bold text-primary-foreground"
                  style={{ background: a.accent }}
                >
                  {a.short}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">{a.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {a.available ? a.role : "Not available here yet"}
                  </span>
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {mode === "start" ? (
        <StudioCover
          onWorkspace={() => setMode("edit")}
          onNew={newSession}
          onIdea={(idea) => {
            setBrief(idea);
            document.getElementById("creative-start")?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <CreativeChat messages={msgs} brief={brief} setBrief={setBrief} busy={busy} send={send} spacious />
          <div className="my-5 flex flex-wrap items-center gap-2">
            <label htmlFor="directing-style" className="mr-1 text-xs text-muted-foreground">Direction</label>
            <select
              id="directing-style"
              aria-label="Directing style"
              value={directingStyle}
              onChange={(e) => setDirectingStyle(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-2 text-xs"
            >
              {DIRECTING_STYLES.map((style) => (
                <option key={style.id} value={style.id}>{style.label}</option>
              ))}
            </select>
          </div>
          <CrewBoard crew={crew} busy={busy} />
        </StudioCover>
      ) : mode === "canvas" ? (
        <main className="flex-1 p-2 sm:p-3">
          <NodeCanvas motion={motion} onAsset={addAsset} />
        </main>
      ) : (
        <main className="grid flex-1 gap-2 p-2 sm:gap-3 sm:p-3 lg:grid-cols-[290px_minmax(0,1fr)_260px] lg:grid-rows-[minmax(320px,1fr)_minmax(260px,0.8fr)]">
          {/* visual media library */}
          <section className="flex flex-col gap-2 rounded-lg border border-border glass-panel p-3 lg:col-start-3 lg:row-start-1 lg:row-span-2">
            <div className="flex items-center justify-between">
              <div className="flex rounded-md border border-border glass-control p-0.5">
                <Button
                  variant="ghost"
                  onClick={() => setMediaView("media")}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold",
                    mediaView === "media" ? "bg-primary/20 text-primary" : "text-muted-foreground",
                  )}
                >
                  <FolderOpen className="size-3" /> Media
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setMediaView("generations")}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold",
                    mediaView === "generations"
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  <Images className="size-3" /> Generations
                </Button>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {mediaView === "media"
                  ? assets.length
                  : assets.filter((item) => item.generated).length}
              </span>
            </div>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void ingest(e.dataTransfer.files);
              }}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border glass-control py-4 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
            >
              <Upload className="size-3.5" /> Import from gallery
              <input
                type="file"
                multiple
                accept="video/*,audio/*,image/*"
                className="hidden"
                onChange={(e) => void ingest(e.target.files)}
              />
            </label>
            <div className="space-y-2 rounded-md border border-border glass-control p-2">
              <label className="block text-[10px] text-muted-foreground">
                Image model
                <select
                  aria-label="Image model"
                  value={imgEngine}
                  onChange={(e) => setImgEngine(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-[11px]"
                >
                  {IMAGE_ENGINES.map((en) => (
                    <option key={en.id} value={en.id} disabled={!en.available}>
                      {en.name}
                      {!en.available ? " · Not connected" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[10px] text-muted-foreground">
                Video model
                <select
                  aria-label="Video model"
                  value={vidEngine}
                  onChange={(e) => setVidEngine(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-[11px]"
                >
                  {VIDEO_ENGINES.map((en) => (
                    <option key={en.id} value={en.id} disabled={!en.available}>
                      {en.name}
                      {!en.available ? " · Not connected" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <p className="pt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Motion control
              </p>
              <select
                value={motion.move}
                onChange={(e) => setMotion((m) => ({ ...m, move: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px]"
              >
                {CAMERA_MOVES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <Slider
                icon={<Gauge className="size-3" />}
                label="Intensity"
                value={motion.intensity}
                min={1}
                max={10}
                step={1}
                onChange={(v) => setMotion((m) => ({ ...m, intensity: v }))}
              />
              <div className="flex gap-1.5">
                <select
                  value={motion.curve}
                  onChange={(e) => setMotion((m) => ({ ...m, curve: e.target.value }))}
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-[11px]"
                >
                  {MOTION_CURVES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <select
                  value={motion.fps}
                  onChange={(e) => setMotion((m) => ({ ...m, fps: Number(e.target.value) }))}
                  className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-[11px]"
                >
                  {[24, 30, 60].map((f) => (
                    <option key={f} value={f}>
                      {f}fps
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="ghost"
                  onClick={() => void generateBroll()}
                  disabled={genBusy || !brief.trim()}
                  className="flex items-center justify-center gap-1 rounded-md glass-control py-2 text-[10px] font-bold disabled:opacity-50"
                >
                  <Wand2 className="size-3" /> Image
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => void generateClip()}
                  disabled={genBusy || !brief.trim()}
                  className="flex items-center justify-center gap-1 rounded-md bg-primary py-2 text-[10px] font-bold text-primary-foreground disabled:opacity-50"
                >
                  {genBusy ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Film className="size-3" />
                  )}{" "}
                  Video
                </Button>
              </div>
            </div>
            <div className="grid max-h-[300px] grid-cols-2 gap-2 overflow-y-auto lg:max-h-none">
              {assets
                .filter((item) => mediaView === "media" || item.generated)
                .map((a) => (
                  <div
                    key={a.id}
                    className="group overflow-hidden rounded-md border border-border glass-control transition hover:border-primary/50"
                  >
                    <div className="grid aspect-video w-full place-items-center overflow-hidden bg-muted">
                      {a.kind === "audio" ? (
                        <Volume2 className="size-4 text-muted-foreground" />
                      ) : a.kind === "video" ? (
                        <video src={a.url} muted className="h-full w-full object-cover" />
                      ) : (
                        <img src={a.url} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 p-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-medium">{a.name}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {a.dur.toFixed(1)}s · {a.kind}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => addToTimeline(a)}
                        title="Add to timeline"
                        className="grid size-6 shrink-0 place-items-center rounded bg-secondary text-muted-foreground transition hover:bg-primary hover:text-primary-foreground"
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              {mediaView === "media" && !assets.length && (
                <p className="col-span-2 py-8 text-center text-[11px] text-muted-foreground">
                  No media yet.
                </p>
              )}
              {mediaView === "generations" && !assets.some((item) => item.generated) && (
                <p className="col-span-2 py-8 text-center text-[11px] text-muted-foreground">
                  Your generated images and videos will appear here.
                </p>
              )}
            </div>
          </section>

          {/* monitor + timeline */}
          <section className="flex min-w-0 flex-col gap-3 lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <div className="overflow-hidden rounded-lg border border-border glass-panel">
              <div className="relative grid aspect-video place-items-center bg-background">
                {previewAsset && videoClip ? (
                  previewAsset.kind === "video" ? (
                    <video
                      ref={videoRef}
                      key={videoClip.id}
                      src={previewAsset.url}
                      playsInline
                      className="h-full w-full object-contain"
                      style={{
                        filter: FILTERS[videoClip.filter] ?? "none",
                        opacity: videoClip.opacity,
                      }}
                    />
                  ) : (
                    <img
                      src={previewAsset.url}
                      alt=""
                      className="h-full w-full object-contain"
                      style={{
                        filter: FILTERS[videoClip.filter] ?? "none",
                        opacity: videoClip.opacity,
                      }}
                    />
                  )
                ) : (
                  <p className="font-mono text-xs text-muted-foreground">
                    {clips.length ? "No clip under the playhead" : "Your canvas is empty"}
                  </p>
                )}
                {audioAsset && (
                  <audio
                    ref={audioRef}
                    key={audioClip?.id}
                    src={audioAsset.url}
                    className="hidden"
                  />
                )}
              </div>
              <div className="flex items-center gap-3 border-t border-border px-3 py-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPlaying(false);
                    setPlayhead(0);
                  }}
                  className="text-muted-foreground transition hover:text-foreground"
                >
                  <SkipBack className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setPlaying((p) => !p)}
                  className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground"
                >
                  {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                </Button>
                <span className="font-mono text-xs text-primary">{tc(playhead)}</span>
                <span className="font-mono text-xs text-muted-foreground">/ {tc(duration)}</span>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    onClick={() => setTool("select")}
                    className={cn(
                      "grid size-7 place-items-center rounded transition",
                      tool === "select"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    <MousePointer2 className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setTool("razor")}
                    className={cn(
                      "grid size-7 place-items-center rounded transition",
                      tool === "razor"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    <Scissors className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setZoom((z) => Math.max(18, z - 10))}
                    className="grid size-7 place-items-center rounded text-muted-foreground transition hover:bg-secondary"
                  >
                    <ZoomOut className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setZoom((z) => Math.min(160, z + 10))}
                    className="grid size-7 place-items-center rounded text-muted-foreground transition hover:bg-secondary"
                  >
                    <ZoomIn className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* timeline */}
            <div className="flex min-h-[240px] flex-1 overflow-hidden rounded-lg border border-border glass-panel">
              <div className="w-16 shrink-0 border-r border-border">
                <div className="h-6 border-b border-border" />
                {TRACKS.map((t) => (
                  <div
                    key={t}
                    title={TRACK_LABEL[t]}
                    className="flex h-11 items-center justify-center border-b border-border font-mono text-[10px] text-muted-foreground"
                  >
                    {t}
                  </div>
                ))}
              </div>
              <div className="relative flex-1 overflow-x-auto" ref={laneRef}>
                <div style={{ width: Math.max(duration + 6, 20) * zoom }} className="relative">
                  <div
                    onPointerDown={scrub}
                    className="sticky top-0 z-20 h-6 cursor-col-resize border-b border-border bg-card"
                  >
                    {Array.from({ length: Math.ceil(duration) + 6 }).map((_, i) => (
                      <span
                        key={i}
                        className="absolute top-0 h-full border-l border-border/60 pl-1 font-mono text-[9px] leading-6 text-muted-foreground"
                        style={{ left: i * zoom }}
                      >
                        {i % 2 === 0 ? `${i}s` : ""}
                      </span>
                    ))}
                  </div>
                  {TRACKS.map((t) => (
                    <div
                      key={t}
                      className="relative h-11 border-b border-border"
                      onPointerDown={() => setSel(null)}
                    >
                      {clips
                        .filter((c) => c.track === t)
                        .map((c) => {
                          const a = assetOf(c.assetId);
                          const isAudio = t === "A1" || t === "A2";
                          return (
                            <div
                              key={c.id}
                              onPointerDown={(e) => onClipPointerDown(e, c)}
                              className={cn(
                                "absolute top-1 flex h-9 items-center overflow-hidden rounded-md border text-[10px] select-none",
                                sel === c.id
                                  ? "border-primary ring-1 ring-primary"
                                  : "border-border",
                                tool === "razor" ? "cursor-crosshair" : "cursor-grab",
                              )}
                              style={{
                                left: c.start * zoom,
                                width: Math.max(12, c.dur * zoom),
                                background: isAudio
                                  ? "color-mix(in oklab, var(--chart-4) 28%, var(--card))"
                                  : "color-mix(in oklab, var(--chart-2) 26%, var(--card))",
                              }}
                            >
                              <span className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-foreground/10" />
                              {a && !isAudio && a.kind === "image" && (
                                <img
                                  src={a.url}
                                  alt=""
                                  className="h-full w-10 shrink-0 object-cover opacity-70"
                                />
                              )}
                              <span className="truncate px-1.5 font-mono">{c.name}</span>
                              <span className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-foreground/10" />
                            </div>
                          );
                        })}
                    </div>
                  ))}
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-primary"
                    style={{ left: playhead * zoom }}
                  >
                    <span className="absolute -top-0 -left-1 size-2 rotate-45 bg-primary" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* director + inspector */}
          <section className="flex flex-col gap-3 rounded-lg border border-border glass-panel p-3 order-first lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:min-h-0 lg:overflow-y-auto">
            <div className="flex rounded-md border border-border glass-control p-0.5">
              <Button
                variant="ghost"
                onClick={() => setSideView("director")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-[10px] font-bold",
                  sideView === "director" ? "bg-primary/20 text-primary" : "text-muted-foreground",
                )}
              >
                <Bot className="size-3" /> Director
              </Button>
              <Button
                variant="ghost"
                onClick={() => setSideView("adjust")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-[10px] font-bold",
                  sideView === "adjust" ? "bg-primary/20 text-primary" : "text-muted-foreground",
                )}
              >
                <Layers3 className="size-3" /> Adjust
              </Button>
            </div>
            {sideView === "director" ? (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className="grid size-6 place-items-center rounded-full font-mono text-[9px] font-bold text-primary-foreground"
                    style={{ background: active.accent }}
                  >
                    {active.short}
                  </span>
                  <div>
                    <p className="text-xs font-bold">{active.name}</p>
                    <p className="text-[9px] text-muted-foreground">{active.role}</p>
                  </div>
                </div>
                <CreativeChat
                  messages={msgs}
                  brief={brief}
                  setBrief={setBrief}
                  busy={busy}
                  send={send}
                />
                <select
                  aria-label="Directing style"
                  value={directingStyle}
                  onChange={(e) => setDirectingStyle(e.target.value)}
                  className="rounded-md border border-border bg-card px-2 py-2 text-xs"
                >
                  {DIRECTING_STYLES.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.label}
                    </option>
                  ))}
                </select>
                {agent === "orchestrator" && <CrewBoard crew={crew} busy={busy} />}
              </>
            ) : selected ? (
              <div className="space-y-3 text-xs">
                <p className="truncate font-semibold">{selected.name}</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {selected.track} · {tc(selected.start)} → {tc(selected.start + selected.dur)}
                </p>
                <Slider
                  icon={<Volume2 className="size-3" />}
                  label="Volume"
                  value={selected.volume}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) =>
                    setClips((cs) =>
                      cs.map((c) => (c.id === selected.id ? { ...c, volume: v } : c)),
                    )
                  }
                />
                <Slider
                  icon={<Eye className="size-3" />}
                  label="Opacity"
                  value={selected.opacity}
                  min={0.1}
                  max={1}
                  step={0.05}
                  onChange={(v) =>
                    setClips((cs) =>
                      cs.map((c) => (c.id === selected.id ? { ...c, opacity: v } : c)),
                    )
                  }
                />
                <Slider
                  icon={<Gauge className="size-3" />}
                  label="Speed"
                  value={selected.speed}
                  min={0.25}
                  max={2}
                  step={0.05}
                  onChange={(v) =>
                    setClips((cs) => cs.map((c) => (c.id === selected.id ? { ...c, speed: v } : c)))
                  }
                />
                <div>
                  <p className="mb-1 text-[10px] text-muted-foreground">Look</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(FILTERS).map((f) => (
                      <Button
                        variant="ghost"
                        key={f}
                        onClick={() =>
                          setClips((cs) =>
                            cs.map((c) => (c.id === selected.id ? { ...c, filter: f } : c)),
                          )
                        }
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] capitalize transition",
                          selected.filter === f
                            ? "border-primary text-primary"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {f}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-[10px] text-muted-foreground">Effect presets</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESETS.map((p) => (
                      <Button
                        variant="ghost"
                        key={p.id}
                        title={p.hint}
                        onClick={() =>
                          setClips((cs) =>
                            cs.map((c) =>
                              c.id === selected.id
                                ? {
                                    ...c,
                                    filter: p.filter ?? c.filter,
                                    speed: p.speed ?? c.speed,
                                    opacity: p.opacity ?? c.opacity,
                                  }
                                : c,
                            ),
                          )
                        }
                        className="group overflow-hidden rounded-md border border-border text-left text-[10px] text-muted-foreground transition hover:border-primary hover:text-foreground"
                      >
                        <img
                          src={scene2}
                          alt=""
                          className="h-12 w-full object-cover"
                          style={{
                            filter: FILTERS[p.filter ?? "none"] ?? "none",
                            opacity: p.opacity ?? 1,
                          }}
                        />
                        <span className="block px-1.5 py-1 font-bold">{p.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => splitAt(selected, playhead)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-secondary py-1.5 text-[11px] transition hover:bg-muted"
                  >
                    <Scissors className="size-3" /> Split
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setClips((cs) => cs.filter((c) => c.id !== selected.id));
                      setSel(null);
                    }}
                    className="flex items-center justify-center gap-1 rounded-lg bg-secondary px-2 py-1.5 text-[11px] text-destructive transition hover:bg-muted"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Select a clip on the timeline to adjust it.
              </p>
            )}
          </section>
        </main>
      )}
    </div>
  );
}

function Slider({
  icon,
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {icon}
        {label}
        <span className="ml-auto font-mono">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--primary)]"
      />
    </label>
  );
}
