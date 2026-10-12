const KEY = "reel-creative-context";

export function readCreativeContext(): string {
  if (typeof window === "undefined") return "";
  try { return window.localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}

export function saveCreativeContext(value: string) {
  try { window.localStorage.setItem(KEY, value.slice(0, 6000)); } catch { /* Storage may be unavailable. */ }
}

export function withCreativeContext(prompt: string): string {
  const context = readCreativeContext().trim();
  return context ? `${prompt}\n\nCREATIVE CONTEXT (reference preferences; the current request takes priority):\n${context}` : prompt;
}