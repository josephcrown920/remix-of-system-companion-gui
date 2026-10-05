import { describe, expect, test } from "vitest";
import { clipForAsset, nextTrackStart, REQUIRED_ORCHESTRATOR_SPECIALISTS, serializableAssets, type EditorClip } from "./editor-state";

const clips: EditorClip[] = [
  { id: "one", assetId: "a", track: "V1", start: 0, dur: 4, inPoint: 0, name: "one", volume: 1, opacity: 1, speed: 1, filter: "none" },
  { id: "two", assetId: "b", track: "V1", start: 6, dur: 3, inPoint: 0, name: "two", volume: 1, opacity: 1, speed: 1, filter: "none" },
];

describe("editor session rules", () => {
  test("new visual generations are placed after the final V1 clip", () => {
    expect(nextTrackStart(clips, "V1")).toBe(9);
    expect(clipForAsset({ id: "g", name: "generated.png", kind: "image", url: "data:image/png;base64,x", dur: 4 }, clips, "new").start).toBe(9);
  });

  test("temporary uploaded files are not written into saved sessions", () => {
    expect(serializableAssets([
      { id: "local", name: "local.mov", kind: "video", url: "blob:test", dur: 6 },
      { id: "generated", name: "generated.png", kind: "image", url: "data:image/png;base64,x", dur: 4 },
    ]).map((asset) => asset.id)).toEqual(["generated"]);
  });

  test("orchestrator always routes to Astra, Codex, and Fable", () => {
    expect(REQUIRED_ORCHESTRATOR_SPECIALISTS).toEqual(["astra", "codex", "fable"]);
  });
});