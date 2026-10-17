export type Moodboard = { id: string; name: string; profile: string; keywords: string[]; images: string[] };
export const STYLE_KEY = "reel-moodboard";
export function stylePrompt(prompt: string, board: Pick<Moodboard, "profile" | "keywords"> | null, strength = 0.65) {
  return board ? `${prompt}\n\nSTYLE REFERENCE (strength ${Math.round(strength * 100)}%; current instructions take priority): ${board.profile}\nVisual language: ${board.keywords.join(", ")}` : prompt;
}
export type ComfyNode = { class_type: string; inputs: Record<string, unknown>; _meta?: { title?: string } };
export type ComfyWorkflow = Record<string, ComfyNode>;
export function parseComfyWorkflow(value: unknown): ComfyWorkflow {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Choose a ComfyUI API-format workflow, not a canvas-format export.");
  const entries = Object.entries(value);
  if (!entries.length || entries.some(([, n]) => !n || typeof n !== "object" || typeof n.class_type !== "string" || Array.isArray(n) || !n.inputs || typeof n.inputs !== "object" || Array.isArray(n.inputs))) throw new Error("Export the workflow in API format from ComfyUI.");
  return value as ComfyWorkflow;
}
export function normalizeComfyUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("Enter an HTTP or HTTPS server address without credentials or query parameters.");
  return url.href.replace(/\/$/, "");
}
export function missingComfyNodes(workflow: ComfyWorkflow, installed: Record<string, unknown>) {
  return [...new Set(Object.values(workflow).map((n) => n.class_type).filter((name) => !(name in installed)))];
}
export function prepareComfyWorkflow(workflow: ComfyWorkflow, prompt: string, files: Record<string, string>) {
  const copy = structuredClone(workflow);
  for (const [id, n] of Object.entries(copy)) {
    if (typeof n.inputs["prompt"] === "string") n.inputs["prompt"] = prompt;
    if (files[id]) {
      const key = n.class_type === "LoadImage" ? "image" : Object.keys(n.inputs).find((k) => /video|file|image/.test(k));
      if (key) n.inputs[key] = files[id];
    }
  }
  return copy;
}
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}