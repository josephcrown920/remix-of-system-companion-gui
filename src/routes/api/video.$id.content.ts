import { createFileRoute } from "@tanstack/react-router";
import { GATEWAY, apiKey } from "@/lib/gateway.server";
import { arkFetch } from "@/lib/ark.server";

export const Route = createFileRoute("/api/video/$id/content")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (params.id.startsWith("ark_")) {
          const t = (await (await arkFetch(`/contents/generations/tasks/${encodeURIComponent(params.id.slice(4))}`)).json()) as { content?: { video_url?: string } };
          if (!t.content?.video_url) return new Response("Video not ready", { status: 404 });
          const v = await fetch(t.content.video_url);
          return new Response(v.body, { status: v.status, headers: { "Content-Type": "video/mp4" } });
        }
        const r = await fetch(`${GATEWAY}/v1/videos/${encodeURIComponent(params.id)}/content`, { headers: { Authorization: `Bearer ${apiKey()}` } });
        return new Response(r.body, { status: r.status, headers: { "Content-Type": r.headers.get("Content-Type") ?? "video/mp4" } });
      },
    },
  },
});
