import { createParser } from "eventsource-parser";

/** Consume complete SSE frames, including CRLF and split UTF-8 chunks. */
export async function readSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: string) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createParser({ onEvent: ({ event, data }) => onEvent(event ?? "message", data) });
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      parser.feed(decoder.decode(chunk.value, { stream: true }));
    }
    parser.feed(decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

/** Read only the conversational JSON field while the structured edit plan arrives. */
export function partialReply(json: string): string {
  const match = /"reply"\s*:\s*"/.exec(json);
  if (!match) return "";
  let text = "";
  for (let i = match.index + match[0].length; i < json.length; i++) {
    const char = json[i];
    if (char === '"') break;
    if (char !== "\\") { text += char; continue; }
    const escaped = json[++i];
    if (escaped === undefined) break;
    if (escaped === "u") {
      const hex = json.slice(i + 1, i + 5);
      if (!/^[0-9a-f]{4}$/i.test(hex)) break;
      text += String.fromCharCode(parseInt(hex, 16));
      i += 4;
    } else {
      text += ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" } as Record<string, string>)[escaped] ?? escaped;
    }
  }
  return text;
}