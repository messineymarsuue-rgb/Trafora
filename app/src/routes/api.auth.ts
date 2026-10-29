import { createFileRoute } from "@tanstack/react-router";
import { createUser, currentUser, database, endSession, json, sameOrigin, startSession, verifyUser } from "@/lib/trafora.server";

export const Route = createFileRoute("/api/auth")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try { return json({ user: await currentUser(request) }); }
        catch { return json({ error: "Hesap servisi şu anda hazır değil." }, 503); }
      },
      POST: async ({ request }) => {
        if (!sameOrigin(request)) return json({ error: "İstek doğrulanamadı." }, 403);
        let body: Record<string, unknown>;
        try { body = await request.json() as Record<string, unknown>; } catch { return json({ error: "Geçersiz istek." }, 400); }
        try {
          const action = body.action;
          if (action === "logout") {
            await endSession(request);
            return json({ ok: true }, 200, { "set-cookie": "tf_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" });
          }
          if (action === "register") {
            const name = typeof body.name === "string" ? body.name.trim() : "";
            const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
            const password = typeof body.password === "string" ? body.password : "";
            if (name.length < 2 || name.length > 60) return json({ error: "Ad en az 2 karakter olmalı." }, 400);
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180) return json({ error: "Geçerli bir e-posta adresi gir." }, 400);
            if (password.length < 8 || password.length > 128) return json({ error: "Şifre 8 ile 128 karakter arasında olmalı." }, 400);
            try {
              const user = await createUser(name, email, password);
              const session = await startSession(user.id);
              return json({ user }, 201, { "set-cookie": session.cookie });
            } catch (error) {
              const message = error instanceof Error ? error.message : "";
              if (message.includes("UNIQUE") || message.includes("constraint")) return json({ error: "Bu e-posta ile bir hesap zaten var." }, 409);
              throw error;
            }
          }
          if (action === "login") {
            const email = typeof body.email === "string" ? body.email.trim() : "";
            const password = typeof body.password === "string" ? body.password : "";
            if (!email || !password) return json({ error: "E-posta ve şifre gerekli." }, 400);
            const user = await verifyUser(email, password);
            if (!user) return json({ error: "E-posta veya şifre hatalı." }, 401);
            const session = await startSession(user.id);
            return json({ user }, 200, { "set-cookie": session.cookie });
          }
          return json({ error: "Desteklenmeyen işlem." }, 400);
        } catch {
          try { database(); } catch { return json({ error: "Veritabanı henüz yapılandırılmadı." }, 503); }
          return json({ error: "İşlem tamamlanamadı. Biraz sonra tekrar dene." }, 500);
        }
      },
    },
  },
});
