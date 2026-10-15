import { useState } from "react";
import { Button } from "@/components/ui/button";
import { generateVideo } from "@/lib/generate";
import { DEFAULT_VIDEO_ENGINE, VIDEO_ENGINES } from "@/lib/engines";
import type { EditorAsset, EditorClip } from "@/lib/editor-state";

type Props = {
  assets: EditorAsset[];
  clips: EditorClip[];
  onAsset: (url: string, kind: "image" | "video", name: string, place?: boolean) => void;
};

/** Genjutsu subject swap (draft → approve) and Blender render handoff. */
export function WorkflowStudio({ assets, clips, onAsset }: Props) {
  const [tab, setTab] = useState<"genjutsu" | "blender">("genjutsu");
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-border glass-panel p-3">
      <div className="flex gap-1 rounded-md border border-border glass-control p-0.5 self-start text-xs">
        {(["genjutsu", "blender"] as const).map((t) => (
          <Button key={t} variant="ghost" size="sm" onClick={() => setTab(t)}
            className={tab === t ? "bg-primary/20 text-primary" : "text-muted-foreground"}>
            {t === "genjutsu" ? "Genjutsu subject swap" : "Blender render"}
          </Button>
        ))}
      </div>
      {tab === "genjutsu" ? <Genjutsu onAsset={onAsset} /> : <Blender assets={assets} clips={clips} />}
    </div>
  );
}

function Genjutsu({ onAsset }: { onAsset: Props["onAsset"] }) {
  const [source, setSource] = useState<File | null>(null);
  const [refImg, setRefImg] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("Replace the main subject with the reference character. Keep the original camera move, framing, background and timing.");
  const [engine, setEngine] = useState(DEFAULT_VIDEO_ENGINE);
  const [approved, setApproved] = useState(false);
  const [status, setStatus] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(hd: boolean) {
    if (!refImg) return setStatus("Add a character reference first.");
    setBusy(true); setStatus(hd ? "Rendering approved HD…" : "Rendering draft…");
    try {
      const url = await generateVideo(`${prompt}${hd ? " Final 1080p quality." : ""}`, engine, "", {
        image: refImg, duration: "5s", onStatus: (s) => setStatus(`${hd ? "HD" : "Draft"}: ${s}`),
      });
      if (!hd) setDraftUrl(url);
      onAsset(url, "video", hd ? "genjutsu-hd.mp4" : "genjutsu-draft.mp4", hd);
      setStatus(hd ? "HD added to the timeline." : "Draft ready — review it, then approve HD.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Generation failed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="grid flex-1 gap-3 md:grid-cols-2">
      <div className="flex flex-col gap-2 text-xs">
        <p className="text-muted-foreground">Your scene, new characters. Draft first, approve before HD. The original audio is kept on the timeline.</p>
        <label className="font-bold">1. Source video
          <input type="file" accept="video/*" className="mt-1 block w-full" onChange={(e) => { setSource(e.target.files?.[0] ?? null); setApproved(false); }} />
        </label>
        {source && <video src={URL.createObjectURL(source)} controls className="max-h-40 rounded-md" />}
        <label className="font-bold">2. Character reference
          <input type="file" accept="image/*" className="mt-1 block w-full" onChange={(e) => setRefImg(e.target.files?.[0] ?? null)} />
        </label>
        <label className="font-bold">3. Prompt
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-border bg-background/40 p-2" />
        </label>
        <label className="font-bold">Engine
          <select value={engine} onChange={(e) => setEngine(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background/40 p-1">
            {VIDEO_ENGINES.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />I reviewed the full clip and subject area</label>
        <div className="flex gap-2">
          <Button size="sm" disabled={busy || !approved} onClick={() => run(false)}>Create draft</Button>
          <Button size="sm" variant="outline" disabled={busy || !draftUrl} onClick={() => run(true)}>Approve HD</Button>
        </div>
        {status && <p className="text-muted-foreground">{status}</p>}
      </div>
      <div className="flex items-center justify-center rounded-md border border-border bg-background/30 p-2">
        {draftUrl ? <video src={draftUrl} controls className="max-h-full w-full rounded-md" /> : <span className="text-xs text-muted-foreground">Draft preview appears here</span>}
      </div>
    </div>
  );
}

function Blender({ assets, clips }: { assets: EditorAsset[]; clips: EditorClip[] }) {
  const [res, setRes] = useState("1920x1080");
  const [fps, setFps] = useState(24);
  const [engine, setEngine] = useState("BLENDER_EEVEE_NEXT");

  function download() {
    const [w, h] = res.split("x");
    const strips = clips.map((c) => {
      const a = assets.find((x) => x.id === c.assetId);
      return { name: c.name, kind: a?.kind ?? "video", file: a?.name ?? c.name, url: a?.url.startsWith("http") ? a.url : "", channel: ["A2", "A1", "V1", "V2", "V3"].indexOf(c.track) + 1, start: c.start, dur: c.dur, opacity: c.opacity, volume: c.volume };
    });
    const py = `# Blender render script exported from the editor. Run: blender -b -P render_timeline.py
# Put your media files next to this script (names below), or they will download from their URLs.
import bpy, os, json, urllib.request
STRIPS = json.loads(r'''${JSON.stringify(strips)}''')
FPS = ${fps}
base = os.path.dirname(os.path.abspath(__file__))
scn = bpy.context.scene
scn.render.engine = "${engine}"
scn.render.resolution_x, scn.render.resolution_y = ${w}, ${h}
scn.render.fps = FPS
scn.render.image_settings.file_format = "FFMPEG"
scn.render.ffmpeg.format = "MPEG4"
scn.render.ffmpeg.codec = "H264"
scn.render.ffmpeg.audio_codec = "AAC"
scn.render.filepath = os.path.join(base, "render.mp4")
if not scn.sequence_editor: scn.sequence_editor_create()
seq = scn.sequence_editor.sequences
end = 1
for s in STRIPS:
    path = os.path.join(base, s["file"])
    if not os.path.exists(path) and s["url"]:
        urllib.request.urlretrieve(s["url"], path)
    if not os.path.exists(path):
        print("missing", path); continue
    f = int(s["start"] * FPS) + 1
    if s["kind"] == "audio":
        st = seq.new_sound(s["name"], path, s["channel"], f); st.volume = s["volume"]
    elif s["kind"] == "image":
        st = seq.new_image(s["name"], path, s["channel"], f); st.frame_final_duration = int(s["dur"] * FPS)
    else:
        st = seq.new_movie(s["name"], path, s["channel"], f)
    if s["kind"] != "audio":
        st.blend_alpha = s["opacity"]
    st.frame_final_end = f + int(s["dur"] * FPS)
    end = max(end, st.frame_final_end)
scn.frame_start, scn.frame_end = 1, end
bpy.ops.render.render(animation=True)
`;
    const blob = new Blob([py], { type: "text/x-python" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "render_timeline.py"; a.click();
  }

  return (
    <div className="flex max-w-md flex-col gap-2 text-xs">
      <p className="text-muted-foreground">Send your timeline to Blender on your computer for a full-quality render. Download the script, then run it with Blender ({clips.length} clips ready).</p>
      <label className="font-bold">Resolution
        <select value={res} onChange={(e) => setRes(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background/40 p-1">
          {["1280x720", "1920x1080", "2560x1440", "3840x2160", "1080x1920"].map((r) => <option key={r}>{r}</option>)}
        </select>
      </label>
      <label className="font-bold">Frame rate
        <select value={fps} onChange={(e) => setFps(Number(e.target.value))} className="mt-1 w-full rounded-md border border-border bg-background/40 p-1">
          {[24, 25, 30, 60].map((r) => <option key={r} value={r}>{r} fps</option>)}
        </select>
      </label>
      <label className="font-bold">Render engine
        <select value={engine} onChange={(e) => setEngine(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background/40 p-1">
          <option value="BLENDER_EEVEE_NEXT">Eevee (fast)</option>
          <option value="CYCLES">Cycles (quality)</option>
          <option value="BLENDER_WORKBENCH">Workbench (preview)</option>
        </select>
      </label>
      <Button size="sm" disabled={!clips.length} onClick={download}>Download Blender render script</Button>
      <code className="rounded bg-background/40 p-2">blender -b -P render_timeline.py</code>
    </div>
  );
}
