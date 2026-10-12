import { ARK_BASE, arkKey } from "@/lib/gateway.server";

/** Calls ModelArk with the server-held key; returns a JSON error Response when not configured. */
export async function arkFetch(path: string, init: RequestInit = {}) {
  const key = arkKey();
  if (!key) return Response.json({ error: { message: "ModelArk isn't connected. Add your ModelArk API key." } }, { status: 401 });
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${key}`);
  if (init.body) headers.set("Content-Type", "application/json");
  return fetch(`${ARK_BASE}${path}`, { ...init, headers });
}

/** Turn a ModelArk error body into a friendly `{error:{message}}` response. */
export async function arkError(r: Response) {
  const text = await r.text();
  let msg = text.slice(0, 200);
  try {
    const e = (JSON.parse(text) as { error?: { code?: string; message?: string } }).error;
    if (e?.code === "AccountOverdueError") msg = "Your ModelArk account has an overdue balance. Top it up in the BytePlus console, then try again.";
    else if (e?.message) msg = e.message.split(" Request id")[0]!;
  } catch { /* keep raw */ }
  return Response.json({ error: { message: msg } }, { status: r.status });
}
