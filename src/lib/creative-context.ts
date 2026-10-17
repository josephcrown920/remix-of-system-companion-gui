const KEY = "reel-creative-context";
const STYLE = "reel-moodboard";

export function readCreativeContext(): string {
  if (typeof window === "undefined") return "";
  try { return window.localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}

export function saveCreativeContext(value: string) {
  try { window.localStorage.setItem(KEY, value.slice(0, 6000)); } catch { /* Storage may be unavailable. */ }
}

export function withCreativeContext(prompt: string): string {
  const context = readCreativeContext().trim();
  let style = "";
  try { style = window.localStorage.getItem(STYLE) ?? ""; } catch { /* Storage may be unavailable. */ }
  const withContext = context ? `${prompt}\n\nCREATIVE CONTEXT (reference preferences; the current request takes priority):\n${context}` : prompt;
  return style ? `${withContext}\n\n${style}` : withContext;
}