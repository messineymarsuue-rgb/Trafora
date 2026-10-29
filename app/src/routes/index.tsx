import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  Activity, ArrowRight, ArrowUpRight, BarChart3, Check, ChevronRight,
  CircleHelp, Copy, ExternalLink, Globe, Link2, LogOut, Menu, MousePointer2,
  Plus, ShieldCheck, Sparkles, Target, TrendingUp, X, Zap,
} from "lucide-react";

type User = { id: number; name: string; email: string };
type LinkItem = { id: number; slug: string; title: string; target_url: string; clicks_count: number; created_at: string; campaign_id?: number | null; campaign_title?: string | null };
type Campaign = { id: number; title: string; destination_url: string; budget_cents: number; status: string; created_at: string; clicks_count: number };
type Dashboard = { user: User; links: LinkItem[]; campaigns: Campaign[]; recent: { clicked_at: string; referrer_host: string | null; title: string }[]; stats: { links: number; clicks: number; campaigns: number } };
type ApiResult = Record<string, any>;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trafora | Link ve Kampanya Analitiği" },
      { name: "description", content: "Trafora ile bağlantılarını kısalt, gerçek tıklamaları takip et ve reklam kampanyalarını tek panelden düzenle." },
      { property: "og:title", content: "Trafora | Link ve Kampanya Analitiği" },
      { property: "og:description", content: "Gerçek tıklamalar. Açık istatistikler. Daha düzenli kampanyalar." },
    ],
  }),
  component: HomePage,
});

async function api(path: string, init?: RequestInit): Promise<ApiResult> {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Bir şeyler ters gitti.");
  return data;
}

function Mark({ small = false }: { small?: boolean }) {
  return <span className={`brand-mark${small ? " brand-mark-small" : ""}`} aria-hidden="true"><span /><i /></span>;
}

function HomePage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [user, setUser] = useState<User | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [origin, setOrigin] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [dashBusy, setDashBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [dashError, setDashError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignUrl, setCampaignUrl] = useState("");
  const [campaignBudget, setCampaignBudget] = useState("0");
  const [activeTab, setActiveTab] = useState<"links" | "campaigns">("links");

  async function refreshDashboard() {
    if (!user) return;
    setDashBusy(true);
    setDashError("");
    try { setDashboard(await api("/api/dashboard") as Dashboard); }
    catch (error) { setDashError(error instanceof Error ? error.message : "Panel yüklenemedi."); }
    finally { setDashBusy(false); }
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    api("/api/auth").then((result) => {
      if (result.user) setUser(result.user as User);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (user) void refreshDashboard();
    else setDashboard(null);
  }, [user?.id]);

  function openAuth(mode: "login" | "register") {
    setAuthMode(mode); setAuthError(""); setAuthOpen(true); setMobileMenu(false);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthBusy(true); setAuthError("");
    const form = new FormData(event.currentTarget);
    const payload: Record<string, string> = {
      action: authMode,
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    if (authMode === "register") payload.name = String(form.get("name") ?? "");
    try {
      const result = await api("/api/auth", { method: "POST", body: JSON.stringify(payload) });
      setUser(result.user as User); setAuthOpen(false); setNotice(authMode === "register" ? "Hesabın oluşturuldu. Hoş geldin!" : "Tekrar hoş geldin!");
      window.setTimeout(() => setNotice(""), 3800);
      document.getElementById("panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) { setAuthError(error instanceof Error ? error.message : "Giriş yapılamadı."); }
    finally { setAuthBusy(false); }
  }

  async function logout() {
    try { await api("/api/auth", { method: "POST", body: JSON.stringify({ action: "logout" }) }); }
    finally { setUser(null); setDashboard(null); setNotice("Güvenli çıkış yapıldı."); window.setTimeout(() => setNotice(""), 3000); }
  }

  async function createLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setDashBusy(true); setDashError("");
    try {
      const result = await api("/api/dashboard", { method: "POST", body: JSON.stringify({ action: "create_link", title: linkTitle, url: linkUrl }) });
      setLinkTitle(""); setLinkUrl(""); await refreshDashboard();
      setNotice("Bağlantın hazır. Kısa linki kopyalayıp paylaşabilirsin."); window.setTimeout(() => setNotice(""), 4000);
      setActiveTab("links");
      if (result.slug) void copyLink(result.slug, false);
    } catch (error) { setDashError(error instanceof Error ? error.message : "Link oluşturulamadı."); }
    finally { setDashBusy(false); }
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setDashBusy(true); setDashError("");
    try {
      const result = await api("/api/dashboard", { method: "POST", body: JSON.stringify({ action: "create_campaign", title: campaignTitle, url: campaignUrl, budget: Number(campaignBudget) }) });
      setCampaignTitle(""); setCampaignUrl(""); setCampaignBudget("0"); await refreshDashboard(); setActiveTab("campaigns");
      if (result.slug) await copyLink(result.slug, false);
      setNotice("Kampanya oluşturuldu ve takip bağlantısı hazır."); window.setTimeout(() => setNotice(""), 4000);
    } catch (error) { setDashError(error instanceof Error ? error.message : "Kampanya oluşturulamadı."); }
    finally { setDashBusy(false); }
  }

  async function copyLink(slug: string, showNotice = true) {
    const value = `${origin || window.location.origin}/go/${slug}`;
    try { await navigator.clipboard.writeText(value); if (showNotice) { setNotice("Kısa bağlantı kopyalandı."); window.setTimeout(() => setNotice(""), 3000); } }
    catch { setNotice(value); window.setTimeout(() => setNotice(""), 5000); }
  }

  function goToPanel() {
    setMobileMenu(false);
    if (!user) { openAuth("register"); return; }
    document.getElementById("panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const totalClicks = dashboard?.stats.clicks ?? 0;

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Trafora ana sayfa"><Mark /><span>trafora<span className="brand-period">.</span></span></a>
        <nav className={`nav-links${mobileMenu ? " nav-open" : ""}`} aria-label="Ana menü">
          <a href="#ozellikler" onClick={() => setMobileMenu(false)}>Özellikler</a>
          <a href="#nasil-calisir" onClick={() => setMobileMenu(false)}>Nasıl çalışır?</a>
          <a href="#guven" onClick={() => setMobileMenu(false)}>Güven</a>
          {user ? <button className="nav-mobile-cta" onClick={goToPanel}>Panelim <ArrowUpRight size={15} /></button> : <button className="nav-mobile-cta" onClick={() => openAuth("login")}>Giriş yap</button>}
        </nav>
        <div className="top-actions">
          {user ? <button className="nav-user" onClick={goToPanel}><span className="user-dot">{user.name.slice(0, 1).toUpperCase()}</span><span>Panelim</span><ArrowUpRight size={15} /></button> : <><button className="nav-login" onClick={() => openAuth("login")}>Giriş yap</button><button className="button button-primary button-nav" onClick={() => openAuth("register")}>Ücretsiz başla <ArrowUpRight size={16} /></button></>}
        </div>
        <button className="mobile-menu-toggle" aria-label={mobileMenu ? "Menüyü kapat" : "Menüyü aç"} onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X /> : <Menu />}</button>
      </header>

      <main id="top">
        <section className="hero section-wrap">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-spark"><Sparkles size={13} /></span> GERÇEK TRAFİK. NET VERİ.</div>
            <h1>Her tıklama<br />bir <span>içgörü.</span></h1>
            <p className="hero-description">Bağlantılarını paylaş, kampanyalarını düzenle ve gerçek ziyaretlerini tek bir sade panelden takip et.</p>
            <div className="hero-actions"><button className="button button-primary button-large" onClick={() => openAuth("register")}>Ücretsiz başla <ArrowRight size={17} /></button><a className="button button-quiet button-large" href="#ozellikler">Özellikleri gör <ChevronRight size={17} /></a></div>
            <div className="hero-proof"><span className="proof-icon"><ShieldCheck size={16} /></span><span>Bot trafiği yok. Uydurma istatistik yok.</span></div>
          </div>
          <div className="hero-visual" aria-label="Trafora panelinin örnek görünümü">
            <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" /><div className="visual-cross cross-a" /><div className="visual-cross cross-b" />
            <div className="signal-node node-one"><Link2 size={17} /></div><div className="signal-node node-two"><MousePointer2 size={17} /></div><div className="signal-node node-three"><BarChart3 size={17} /></div>
            <div className="signal-line line-one" /><div className="signal-line line-two" />
            <div className="preview-window">
              <div className="preview-top"><div className="preview-brand"><Mark small /> <span>trafora</span></div><span className="preview-live"><i /> ÖRNEK PANEL</span></div>
              <div className="preview-heading"><div><span className="preview-overline">GENEL BAKIŞ</span><h3>Performansın</h3></div><span className="preview-date">Son 7 gün <ChevronRight size={12} /></span></div>
              <div className="preview-metrics"><div className="preview-metric"><span>Toplam tıklama</span><strong>2.486</strong><small><TrendingUp size={12} /> Örnek veri</small></div><div className="preview-metric"><span>Aktif link</span><strong>18</strong><small className="muted-small">Bağlantıların</small></div></div>
              <div className="preview-chart"><div className="chart-grid"><i /><i /><i /><i /></div><svg viewBox="0 0 420 100" preserveAspectRatio="none" role="img" aria-label="Örnek tıklama grafiği"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--tf-accent)" stopOpacity=".25"/><stop offset="100%" stopColor="var(--tf-accent)" stopOpacity="0"/></linearGradient></defs><path d="M0,79 C25,72 30,82 55,64 S95,72 115,49 S152,62 175,40 S215,51 240,30 S280,45 305,22 S345,40 365,18 S400,25 420,8 L420,100 L0,100 Z" fill="url(#chart-fill)"/><path d="M0,79 C25,72 30,82 55,64 S95,72 115,49 S152,62 175,40 S215,51 240,30 S280,45 305,22 S345,40 365,18 S400,25 420,8" fill="none" stroke="var(--tf-accent)" strokeWidth="2.5" strokeLinecap="round"/></svg></div>
              <div className="preview-link"><span className="preview-link-icon"><Link2 size={14} /></span><div><strong>yeni-kampanya</strong><small>trafora / go / a8f2c1</small></div><div className="preview-link-clicks"><b>642</b><small>tıklama</small></div><ArrowUpRight size={15} /></div>
            </div>
            <div className="floating-stat"><span className="floating-stat-icon"><Activity size={15} /></span><span><strong>Canlı takip</strong><small>Her tıklama kayıt altında</small></span><span className="live-dot" /></div>
            <div className="visual-caption">Arayüz önizlemesi · Sayılar örnektir</div>
          </div>
        </section>

        <section className="trust-strip"><div className="trust-inner"><span><Check size={15} /> Gerçek tıklama takibi</span><span><Check size={15} /> Basit kampanya yönetimi</span><span><Check size={15} /> Gizliliğe saygılı ölçüm</span><span><Check size={15} /> Mobil uyumlu panel</span></div></section>

        <section className="features section-wrap" id="ozellikler">
          <div className="section-intro"><div className="eyebrow">KONTROL SENDE</div><h2>İhtiyacın olan her şey.<br /><span>Gereksiz karmaşa yok.</span></h2><p>Linklerini yönetmek ve kampanya performansını anlamak için ihtiyacın olan araçlar tek yerde.</p></div>
          <div className="feature-grid">
            <article className="feature-card feature-card-large"><div className="feature-icon icon-blue"><Link2 size={21} /></div><div className="feature-number">01 / BAĞLANTILAR</div><h3>Akıllı kısa linkler</h3><p>Uzun bağlantılarını düzenli kısa linklere dönüştür. Paylaş, kopyala ve hangi linkin kaç gerçek tıklama aldığını gör.</p><div className="mini-link-demo"><span className="mini-link-symbol"><Link2 size={15} /></span><span>trafora.app/go/...</span><span className="mini-copy"><Check size={14} /> Hazır</span></div></article>
            <article className="feature-card feature-card-dark"><div className="feature-icon icon-dark"><BarChart3 size={21} /></div><div className="feature-number">02 / ANALİTİK</div><h3>Gerçek veriler</h3><p>Her bağlantının tıklama sayısını ve yönlendiren kaynağı incele. Örnek sayı yerine kendi verini gör.</p><div className="feature-sparkline"><svg viewBox="0 0 240 62" preserveAspectRatio="none" aria-hidden="true"><path d="M0 52 C22 48 22 32 45 39 S70 52 88 27 S120 36 139 21 S167 34 188 15 S220 22 240 3" fill="none" stroke="var(--tf-accent)" strokeWidth="2.5" strokeLinecap="round"/><path d="M0 52 C22 48 22 32 45 39 S70 52 88 27 S120 36 139 21 S167 34 188 15 S220 22 240 3 L240 62 L0 62Z" fill="var(--tf-accent)" opacity=".12"/></svg></div></article>
            <article className="feature-card feature-card-wide"><div className="feature-icon icon-green"><Target size={21} /></div><div className="feature-number">03 / KAMPANYALAR</div><h3>Bir hedef, tek panel</h3><p>Kampanyalarını isimlendir, hedef bağlantını ekle ve bütçe planını kaydet. Her kampanya için ayrı takip linki oluştur.</p><div className="campaign-mini"><div><span className="campaign-mini-dot" /><span>Yaz kampanyası</span><b>Aktif</b></div><div><span className="campaign-mini-dot" /><span>Yeni ürün duyurusu</span><b>Aktif</b></div><div><span className="campaign-mini-dot muted-dot" /><span>Hafta sonu</span><b className="paused-label">Taslak</b></div></div></article>
          </div>
        </section>

        <section className="how-section" id="nasil-calisir"><div className="section-wrap how-inner"><div className="how-copy"><div className="eyebrow">ÜÇ ADIMDA BAŞLA</div><h2>Paylaş. Ölç.<br /><span>Daha iyi karar ver.</span></h2><p>Trafora'nın mantığı basit. Önce bağlantını oluştur, sonra onu paylaş ve sonuçları panelinde takip et.</p><button className="button button-primary button-large" onClick={goToPanel}>Paneli aç <ArrowUpRight size={16} /></button></div><div className="steps-list"><article className="step-item"><span className="step-index">01</span><div className="step-icon"><Link2 size={19} /></div><div><h3>Bağlantını ekle</h3><p>Başlık ve hedef URL gir. Paylaşmaya hazır kısa bağlantın oluşturulsun.</p></div><ChevronRight size={18} className="step-arrow" /></article><article className="step-item"><span className="step-index">02</span><div className="step-icon"><Globe size={19} /></div><div><h3>Gerçek kişilerle paylaş</h3><p>Bağlantını sosyal medya, mesaj veya kampanya materyallerinde kullan.</p></div><ChevronRight size={18} className="step-arrow" /></article><article className="step-item"><span className="step-index">03</span><div className="step-icon"><BarChart3 size={19} /></div><div><h3>Sonuçları takip et</h3><p>İnsan ziyaretleri geldikçe sayaç ve son tıklama kayıtların güncellensin.</p></div><ChevronRight size={18} className="step-arrow" /></article></div></div></section>

        <section className="integrity-section section-wrap" id="guven"><div className="integrity-panel"><div className="integrity-symbol"><ShieldCheck size={29} /></div><div className="integrity-copy"><div className="eyebrow">ŞEFFAF ÖLÇÜM</div><h2>Rakamlar gerçek olmalı.</h2><p>Trafora sahte trafik üretmez. Bilinen bot ve önizleme tarayıcılarının istekleri tıklama sayacına eklenmez. Ziyaretçilerin IP adreslerini saklamayız.</p></div><div className="integrity-list"><span><Check size={16} /> Bot gönderimi yok</span><span><Check size={16} /> Uydurma istatistik yok</span><span><Check size={16} /> Zorunlu yönlendirme yok</span></div></div></section>

        <section className="faq-section section-wrap"><div className="section-intro faq-intro"><div className="eyebrow">MERAK EDİLENLER</div><h2>Başlamadan önce.</h2><p>Trafora'nın nasıl çalıştığına dair kısa cevaplar.</p></div><div className="faq-list"><details><summary>Trafora gerçekten ücretsiz mi? <CircleHelp size={17} /></summary><p>Bu sürümde hesap açma, kısa bağlantı oluşturma ve tıklama takibi için ödeme akışı yoktur. Yayınlama altyapısı veya özel alan adı için hizmet sağlayıcının şartları ayrıca geçerlidir.</p></details><details><summary>Trafora bana ziyaretçi gönderir mi? <CircleHelp size={17} /></summary><p>Hayır. Trafora bağlantılarını yönetir ve gelen tıklamaları ölçer. Ziyaretçi satın almaz, bot göndermez ve belirli sayıda tıklama garantisi vermez.</p></details><details><summary>Kampanya bütçesi ödeme yapar mı? <CircleHelp size={17} /></summary><p>Hayır. Bütçe alanı planlama ve kayıt içindir. Bu sürüm reklam ağına bağlanmaz ve kartından para çekmez.</p></details><details><summary>Hangi tıklamalar sayılır? <CircleHelp size={17} /></summary><p>Takip bağlantısı açıldığında, bilinen bot ve önizleme tarayıcıları dışındaki istekler sayılır. Hiçbir otomatik filtre tüm botları kusursuz tanıyamaz; bu yüzden istatistikler ölçüm amaçlıdır.</p></details></div></section>

        <section className="final-cta section-wrap"><div className="cta-decoration"><span /><span /><span /></div><div className="eyebrow">BAŞLAMAYA HAZIR MISIN?</div><h2>Bağlantılarını kontrol altına al.</h2><p>Ücretsiz hesabını oluştur ve ilk takip linkini hazırla.</p><button className="button button-light button-large" onClick={() => openAuth("register")}>Hesap oluştur <ArrowRight size={17} /></button></section>

        {user && <section className="dashboard-section section-wrap" id="panel"><div className="dashboard-header"><div><div className="eyebrow">ÇALIŞMA ALANIN</div><h2>Tekrar hoş geldin, {user.name.split(" ")[0]}.</h2><p>Gerçek tıklamaların ve kampanyaların burada.</p></div><div className="dashboard-header-actions"><button className="button button-outline" onClick={() => void refreshDashboard()} disabled={dashBusy}><Activity size={16} /> Yenile</button><button className="button button-quiet" onClick={() => void logout()}><LogOut size={16} /> Çıkış</button></div></div>
          {dashError && <div className="inline-error" role="alert">{dashError}</div>}
          <div className="stats-grid"><div className="stat-card"><span className="stat-icon"><MousePointer2 size={18} /></span><span className="stat-label">Toplam tıklama</span><strong>{totalClicks.toLocaleString("tr-TR")}</strong><small>Gerçek takip kayıtları</small></div><div className="stat-card"><span className="stat-icon"><Link2 size={18} /></span><span className="stat-label">Kısa link</span><strong>{(dashboard?.stats.links ?? 0).toLocaleString("tr-TR")}</strong><small>Oluşturduğun bağlantılar</small></div><div className="stat-card"><span className="stat-icon"><Target size={18} /></span><span className="stat-label">Kampanyalar</span><strong>{(dashboard?.stats.campaigns ?? 0).toLocaleString("tr-TR")}</strong><small>Kaydedilen kampanyalar</small></div></div>
          <div className="workspace-grid"><div className="workspace-main"><div className="workspace-card"><div className="workspace-card-head"><div><h3>Hızlı bağlantı oluştur</h3><p>Hedef adresini kısa linke dönüştür.</p></div><span className="head-icon"><Link2 size={18} /></span></div><form className="app-form" onSubmit={createLink}><label>Bağlantı adı<input value={linkTitle} onChange={e => setLinkTitle(e.target.value)} minLength={2} maxLength={100} placeholder="Örn. Instagram biyografi" required /></label><label>Hedef URL<input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://ornek.com/sayfa" required /></label><button className="button button-primary" type="submit" disabled={dashBusy}><Plus size={16} /> Link oluştur</button></form></div>
            <div className="workspace-card link-list-card"><div className="list-head"><div><h3>Bağlantıların</h3><p>Paylaşım linkleri ve performansları.</p></div><div className="list-tabs"><button className={activeTab === "links" ? "tab-active" : ""} onClick={() => setActiveTab("links")}>Linkler</button><button className={activeTab === "campaigns" ? "tab-active" : ""} onClick={() => setActiveTab("campaigns")}>Kampanyalar</button></div></div>
              {activeTab === "links" ? (dashboard?.links.length ? <div className="data-list">{dashboard.links.map(link => <div className="data-row" key={link.id}><span className="data-icon"><Link2 size={16} /></span><div className="data-main"><strong>{link.title}</strong><span>{link.target_url}</span><small>{origin}/go/{link.slug}</small></div><div className="data-clicks"><b>{Number(link.clicks_count).toLocaleString("tr-TR")}</b><span>tıklama</span></div><button className="icon-button" aria-label={`${link.title} bağlantısını kopyala`} onClick={() => void copyLink(link.slug)}><Copy size={16} /></button><a className="icon-button" href={`/go/${link.slug}`} target="_blank" rel="noreferrer" aria-label={`${link.title} bağlantısını aç`}><ExternalLink size={16} /></a></div>)}</div> : <div className="empty-state"><span><Link2 size={22} /></span><strong>Henüz bağlantı yok</strong><p>İlk linkini oluşturduğunda burada görünecek.</p></div>) : (dashboard?.campaigns.length ? <div className="data-list">{dashboard.campaigns.map(campaign => <div className="data-row" key={campaign.id}><span className="data-icon campaign-data-icon"><Target size={16} /></span><div className="data-main"><strong>{campaign.title}</strong><span>{campaign.destination_url}</span><small>{campaign.status === "active" ? "Aktif kampanya" : "Duraklatıldı"} · Bütçe planı: {(campaign.budget_cents / 100).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}</small></div><div className="data-clicks"><b>{Number(campaign.clicks_count).toLocaleString("tr-TR")}</b><span>tıklama</span></div></div>)}</div> : <div className="empty-state"><span><Target size={22} /></span><strong>Henüz kampanya yok</strong><p>İlk kampanyanı oluşturmak için yanındaki formu kullan.</p></div>)}</div>
          </div><aside className="workspace-side"><div className="workspace-card"><div className="workspace-card-head"><div><h3>Kampanya oluştur</h3><p>Hedef ve bütçe planını belirle.</p></div><span className="head-icon head-icon-green"><Target size={18} /></span></div><form className="app-form" onSubmit={createCampaign}><label>Kampanya adı<input value={campaignTitle} onChange={e => setCampaignTitle(e.target.value)} minLength={2} maxLength={100} placeholder="Örn. Bahar duyurusu" required /></label><label>Hedef URL<input type="url" value={campaignUrl} onChange={e => setCampaignUrl(e.target.value)} placeholder="https://ornek.com" required /></label><label>Bütçe planı (₺)<input type="number" min="0" max="100000000" step="0.01" value={campaignBudget} onChange={e => setCampaignBudget(e.target.value)} required /></label><button className="button button-dark" type="submit" disabled={dashBusy}><Plus size={16} /> Kampanya oluştur</button><p className="form-note">Bütçe yalnızca planlama içindir. Bu sürüm ödeme almaz veya reklam satın almaz.</p></form></div>
            <div className="workspace-card recent-card"><div className="workspace-card-head"><div><h3>Son tıklamalar</h3><p>Takip bağlantılarından gelen kayıtlar.</p></div><span className="head-icon"><Activity size={18} /></span></div>{dashboard?.recent.length ? <div className="recent-list">{dashboard.recent.map((item, i) => <div className="recent-row" key={`${item.clicked_at}-${i}`}><span className="recent-pulse" /><div><strong>{item.title}</strong><small>{item.referrer_host || "Kaynak belirtilmedi"}</small></div><time>{new Date(`${item.clicked_at.replace(" ", "T")}Z`).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</time></div>)}</div> : <div className="recent-empty">Henüz tıklama kaydı yok. Linkini paylaştığında gerçek ziyaretler burada görünür.</div>}</div></aside></div>
          <p className="dashboard-footnote"><ShieldCheck size={14} /> Sayaçlar veritabanındaki gerçek yönlendirme kayıtlarından gelir. Bot filtreleri bilinen otomatik istemcileri dışarıda tutar, ancak kusursuz değildir.</p>
        </section>}
      </main>

      <footer className="footer"><a className="brand footer-brand" href="#top"><Mark /><span>trafora<span className="brand-period">.</span></span></a><p>Gerçek tıklamalar. Daha net kararlar.</p><div className="footer-links"><a href="#ozellikler">Özellikler</a><a href="#nasil-calisir">Nasıl çalışır?</a><a href="#guven">Güven</a><a href="/privacy">Gizlilik</a><a href="/terms">Koşullar</a></div><span className="footer-copy">© {new Date().getFullYear()} Trafora</span></footer>

      {notice && <div className="toast" role="status"><span><Check size={16} /></span>{notice}<button aria-label="Bildirimi kapat" onClick={() => setNotice("")}><X size={15} /></button></div>}
      {authOpen && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAuthOpen(false); }}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="modal-close" aria-label="Kapat" onClick={() => setAuthOpen(false)}><X size={19} /></button><div className="auth-brand"><Mark /><span>trafora<span className="brand-period">.</span></span></div><div className="auth-heading"><span className="auth-icon"><Zap size={19} /></span><h2 id="auth-title">{authMode === "register" ? "Kendi panelini oluştur." : "Tekrar hoş geldin."}</h2><p>{authMode === "register" ? "İlk linkini birkaç adımda hazırla." : "Bağlantıların seni bekliyor."}</p></div><form className="app-form auth-form" onSubmit={submitAuth}>{authMode === "register" && <label>Adın<input name="name" autoComplete="name" minLength={2} maxLength={60} placeholder="Adın soyadın" required /></label>}<label>E-posta adresi<input name="email" type="email" autoComplete="email" maxLength={180} placeholder="sen@ornek.com" required /></label><label>Şifre<input name="password" type="password" autoComplete={authMode === "register" ? "new-password" : "current-password"} minLength={8} maxLength={128} placeholder="En az 8 karakter" required /></label>{authError && <p className="inline-error" role="alert">{authError}</p>}<button className="button button-primary auth-submit" type="submit" disabled={authBusy}>{authBusy ? "İşleniyor..." : authMode === "register" ? "Hesabımı oluştur" : "Giriş yap"} <ArrowRight size={16} /></button></form><p className="auth-switch">{authMode === "register" ? "Zaten hesabın var mı?" : "İlk kez mi geliyorsun?"} <button onClick={() => { setAuthMode(authMode === "register" ? "login" : "register"); setAuthError(""); }}>{authMode === "register" ? "Giriş yap" : "Hesap oluştur"}</button></p><p className="auth-security"><ShieldCheck size={14} /> Şifren güvenli biçimde özetlenerek saklanır.</p><p className="auth-legal">Hesap oluşturarak <a href="/privacy">Gizlilik Politikası</a> ve <a href="/terms">Kullanım Koşulları</a> hakkında bilgi sahibi olursun.</p></section></div>}
    </div>
  );
}
