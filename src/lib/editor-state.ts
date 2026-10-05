import type { TrackId } from "@/lib/agents";

export type MediaKind = "video" | "image" | "audio";
export type EditorAsset = { id: string; name: string; kind: MediaKind; url: string; dur: number; generated?: boolean };
export type EditorClip = {
  id: string; assetId: string; track: TrackId; start: number; dur: number; inPoint: number;
  name: string; volume: number; opacity: number; speed: number; filter: string;
};

export type SavedSession = {
  id: string;
  name: string;
  updatedAt: string;
  assets: EditorAsset[];
  clips: EditorClip[];
  messages: { role: "user" | "assistant"; text: string; steps?: string[]; agent?: string }[];
  agent: string;
  imageEngine: string;
  videoEngine: string;
};

export const REQUIRED_ORCHESTRATOR_SPECIALISTS = ["astra", "codex", "fable"] as const;

export function nextTrackStart(clips: EditorClip[], track: TrackId) {
  return clips.filter((clip) => clip.track === track).reduce((end, clip) => Math.max(end, clip.start + clip.dur), 0);
}

export function clipForAsset(asset: EditorAsset, clips: EditorClip[], id: string): EditorClip {
  const track: TrackId = asset.kind === "audio" ? "A2" : "V1";
  return {
    id,
    assetId: asset.id,
    track,
    start: nextTrackStart(clips, track),
    dur: asset.dur,
    inPoint: 0,
    name: asset.name.replace(/\.[^.]+$/, ""),
    volume: 1,
    opacity: 1,
    speed: 1,
    filter: "none",
  };
}

export function serializableAssets(assets: EditorAsset[]) {
  return assets.filter((asset) => !asset.url.startsWith("blob:"));
}