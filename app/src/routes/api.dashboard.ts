import { createFileRoute } from "@tanstack/react-router";
import { currentUser, database, json, safeHttpUrl, sameOrigin, shortSlug } from "@/lib/trafora.server";

export const Route = createFileRoute("/api/dashboard")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await currentUser(request);
          if (!user) return json({ error: "Giriş yapman gerekiyor." }, 401);
          const DB = database();
          const [links, campaigns, totals] = await Promise.all([
            DB.prepare(`SELECT l.id, l.slug, l.title, l.target_url, l.clicks_count, l.created_at, l.campaign_id, c.title AS campaign_title
              FROM trafora_links l LEFT JOIN trafora_campaigns c ON c.id = l.campaign_id
              WHERE l.owner_id = ? ORDER BY l.created_at DESC LIMIT 40`).bind(user.id).all(),
            DB.prepare(`SELECT c.id, c.title, c.destination_url, c.budget_cents, c.status, c.created_at,
              COALESCE(SUM(l.clicks_count), 0) AS clicks_count
              FROM trafora_campaigns c LEFT JOIN trafora_links l ON l.campaign_id = c.id
              WHERE c.owner_id = ? GROUP BY c.id ORDER BY c.created_at DESC LIMIT 30`).bind(user.id).all(),
            DB.prepare(`SELECT COUNT(*) AS links_count, COALESCE(SUM(clicks_count),0) AS clicks_count FROM trafora_links WHERE owner_id = ?`).bind(user.id).first(),
          ]);
          const recent = await DB.prepare(`SELECT e.clicked_at, e.referrer_host, l.title FROM trafora_click_events e
            JOIN trafora_links l ON l.id=e.link_id WHERE l.owner_id=? ORDER BY e.clicked_at DESC LIMIT 8`).bind(user.id).all();
          const campaignTotals = await DB.prepare(`SELECT COUNT(*) AS campaigns_count FROM trafora_campaigns WHERE owner_id = ?`).bind(user.id).first<{ campaigns_count: number }>();
          return json({ user, links: links.results ?? [], campaigns: campaigns.results ?? [], recent: recent.results ?? [], stats: { links: totals?.links_count ?? 0, clicks: totals?.clicks_count ?? 0, campaigns: campaignTotals?.campaigns_count ?? 0 } });
        } catch {
          return json({ error: "Panel verilerine ulaşılamadı. Veritabanı yapılandırmasını kontrol et." }, 503);
        }
      },
      POST: async ({ request }) => {
        if (!sameOrigin(request)) return json({ error: "İstek doğrulanamadı." }, 403);
        try {
          const user = await currentUser(request);
          if (!user) return json({ error: "Giriş yapman gerekiyor." }, 401);
          const body = await request.json() as Record<string, unknown>;
          const action = body.action;
          const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
          const destination = safeHttpUrl(body.url);
          if (title.length < 2) return json({ error: "Başlık en az 2 karakter olmalı." }, 400);
          if (!destination) return json({ error: "HTTP veya HTTPS ile başlayan geçerli bir hedef bağlantı gir." }, 400);
          const DB = database();
          const slug = shortSlug();
          if (action === "create_link") {
            const result = await DB.prepare("INSERT INTO trafora_links (owner_id, slug, title, target_url) VALUES (?, ?, ?, ?)")
              .bind(user.id, slug, title, destination).run();
            return json({ ok: true, id: result.meta.last_row_id, slug, title, target_url: destination, clicks_count: 0 }, 201);
          }
          if (action === "create_campaign") {
            const budget = Number(body.budget ?? 0);
            if (!Number.isFinite(budget) || budget < 0 || budget > 100000000) return json({ error: "Bütçe geçerli bir pozitif tutar olmalı." }, 400);
            const campaign = await DB.prepare("INSERT INTO trafora_campaigns (owner_id, title, destination_url, budget_cents, status) VALUES (?, ?, ?, ?, 'active')")
              .bind(user.id, title, destination, Math.round(budget * 100)).run();
            const link = await DB.prepare("INSERT INTO trafora_links (owner_id, campaign_id, slug, title, target_url) VALUES (?, ?, ?, ?, ?)")
              .bind(user.id, campaign.meta.last_row_id, slug, title, destination).run();
            return json({ ok: true, campaign_id: campaign.meta.last_row_id, link_id: link.meta.last_row_id, slug, title, destination_url: destination, budget_cents: Math.round(budget * 100) }, 201);
          }
          return json({ error: "Desteklenmeyen işlem." }, 400);
        } catch {
          return json({ error: "Kayıt oluşturulamadı. Veritabanı hazır olmayabilir." }, 503);
        }
      },
    },
  },
});
