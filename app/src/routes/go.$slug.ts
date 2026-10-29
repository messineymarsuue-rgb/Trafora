import { createFileRoute } from "@tanstack/react-router";
import { database } from "@/lib/trafora.server";

const automatedAgent = /bot|crawler|spider|headless|preview|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|monitoring|uptime|curl\/|wget\//i;

export const Route = createFileRoute("/go/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const DB = database();
          const link = await DB.prepare("SELECT id, target_url FROM trafora_links WHERE slug = ? LIMIT 1").bind(params.slug).first<{ id: number; target_url: string }>();
          if (!link) return new Response("Bu kısa bağlantı bulunamadı.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
          const ua = request.headers.get("user-agent") ?? "";
          if (ua && !automatedAgent.test(ua)) {
            const referrer = request.headers.get("referer");
            let referrerHost: string | null = null;
            try { referrerHost = referrer ? new URL(referrer).hostname.slice(0, 190) : null; } catch { referrerHost = null; }
            await DB.batch([
              DB.prepare("UPDATE trafora_links SET clicks_count = clicks_count + 1 WHERE id = ?").bind(link.id),
              DB.prepare("INSERT INTO trafora_click_events (link_id, referrer_host, user_agent) VALUES (?, ?, ?)").bind(link.id, referrerHost, ua.slice(0, 500)),
            ]);
          }
          return Response.redirect(link.target_url, 302);
        } catch {
          return new Response("Bağlantı şu anda kullanılamıyor.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
        }
      },
    },
  },
});
