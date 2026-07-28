import { useEffect, useMemo, useRef, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// HOLU MESA — CUSTOMER TABLE EXPERIENCE
// Producción: QR -> n8n -> Supabase
// ═══════════════════════════════════════════════════════════════════════════════

const getEnv = (key, fallback = "") => {
  try { if (typeof import.meta !== "undefined" && import.meta.env?.[key] != null) return String(import.meta.env[key]); } catch {}
  try { if (typeof process !== "undefined" && process.env?.[key] != null) return String(process.env[key]); } catch {}
  return fallback;
};

const N8N_BASE = getEnv("VITE_N8N_WEBHOOK_BASE", "https://n8n-n8n.fa2cjf.easypanel.host").replace(/\/+$/, "");
const SUPABASE_URL = getEnv("VITE_SUPABASE_URL", "https://nlwrkumlrudfgsdnhfhw.supabase.co");
const SUPABASE_ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sd3JrdW1scnVkZmdzZG5oZmh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODc3NTgsImV4cCI6MjA5NDE2MzU1OH0.Bi0v-temjfU-BDFVuyJTyc_19ZRx-T_we3MfeEkcsfg");

const QR_FALLBACK = "A7K92";
const FALLBACK_RESTAURANT_ID = "holu";
const getQrToken = () => {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get("qr") || url.searchParams.get("t") || url.pathname.split("/").filter(Boolean).pop() || QR_FALLBACK;
  } catch { return QR_FALLBACK; }
};

const QR_TABLES = {
  A7K92: { tableId: 7, tableLabel: "Mesa 7", zone: "Salón", restaurantId: FALLBACK_RESTAURANT_ID, active: true },
  B2M18: { tableId: 2, tableLabel: "Mesa 2", zone: "Terraza", restaurantId: FALLBACK_RESTAURANT_ID, active: true },
  VIP09: { tableId: 9, tableLabel: "Mesa VIP 9", zone: "Privado", restaurantId: FALLBACK_RESTAURANT_ID, active: true },
};

const FALLBACK_CONTEXT = { ...QR_TABLES[QR_FALLBACK], qrToken: QR_FALLBACK };

const supaRpc = async (fn, args) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args || {}),
  });
  if (!res.ok) throw new Error(`rpc ${fn} ${res.status}`);
  return res.json();
};

// The QR token is the only credential the table app has: one RPC turns it into
// the table plus its restaurant's public data, without exposing either table.
const resolveQrContext = async (qrToken) => {
  try {
    const rows = await supaRpc("resolve_qr", { p_token: qrToken });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (row && row.table_id) {
      return {
        tableId: row.table_id,
        tableNumber: row.table_number,
        tableLabel: row.label || `Mesa ${row.table_number}`,
        zone: row.zone || "",
        restaurantId: row.restaurant_id,
        active: row.active !== false,
        qrToken,
        restaurant: {
          name: row.restaurant_name || RESTAURANT.name,
          concept: row.concept || RESTAURANT.concept,
          googleReviewUrl: row.google_review_url || "",
        },
      };
    }
  } catch (e) {
    console.warn("[holu mesa] QR lookup failed, using fallback:", e.message);
  }
  await wait(450);
  return { ...(QR_TABLES[qrToken] || { tableId: 0, tableLabel: "QR no registrado", zone: "", restaurantId: FALLBACK_RESTAURANT_ID, active: false }), qrToken };
};

const RESTAURANT = {
  name: "HOLU",
  concept: "Cocina italiana de autor",
  city: "Santiago",
  service: "Cena",
  avgPrep: "18–32 min",
  googleReviewUrl: "https://g.page/r/CODIGO-DE-RESTAURANTE/review",
};

const buildSessionId = (qrToken, tableId) => `holu-${qrToken}-table-${tableId}-${new Date().toISOString().slice(0, 10)}`;
const buildStorageKey = (sessionId) => `holu:session:${sessionId}`;
const money = (n) => `$${Number(n || 0).toLocaleString("es-CL")}`;

const WEBHOOKS = {
  camarero: N8N_BASE ? `${N8N_BASE}/webhook/camarero-call` : "",
  order:    N8N_BASE ? `${N8N_BASE}/webhook/order-create`  : "",
  bill:     N8N_BASE ? `${N8N_BASE}/webhook/bill-request`  : "",
  feedback: N8N_BASE ? `${N8N_BASE}/webhook/feedback`      : "",
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const postWebhook = async (event, payload, restaurantId = FALLBACK_RESTAURANT_ID) => {
  const url = WEBHOOKS[event];
  if (!url) {
    await wait(650);
    console.log(`[holu demo] ${event}`, payload);
    return { ok: true };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, restaurant_id: restaurantId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (err) {
    console.error(`[holu] webhook ${event} failed:`, err);
    throw err;
  }
};

const loadSession = (storageKey) => {
  try { const raw = localStorage.getItem(storageKey); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
const saveSession = (storageKey, state) => {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
};

const MENU = [
  { id: "burrata", category: "Entradas", name: "Burrata di Bufala", subtitle: "Tomate heirloom · albahaca · AOVE", detail: "Cremosa, fresca y perfecta para compartir.", price: 14500, minutes: 8, kcal: 420, tags: ["TOP", "Vegetariano"], allergens: ["Lácteos"], pair: "Prosecco brut" },
  { id: "carpaccio", category: "Entradas", name: "Carpaccio di Manzo", subtitle: "Filete · rúcula · parmesano 36m", detail: "Corte fino, cítrico y salino, terminado con aceite de oliva.", price: 16800, minutes: 10, kcal: 360, tags: ["Nuevo"], allergens: ["Lácteos"], pair: "Chianti clásico" },
  { id: "arancini", category: "Entradas", name: "Arancini al Tartufo", subtitle: "Risotto frito · fontina · trufa negra", detail: "Crujiente por fuera, cremoso por dentro. Especial de la casa.", price: 12900, minutes: 12, kcal: 510, tags: ["CHEF", "Vegetariano"], allergens: ["Gluten", "Lácteos", "Huevo"], pair: "Pinot Grigio" },
  { id: "tagliatelle", category: "Principales", name: "Tagliatelle al Ragù", subtitle: "Pasta fresca · ternera 6h · parmesano", detail: "Nuestra pasta más pedida: ragù profundo, cocción lenta y pasta al dente.", price: 21500, minutes: 18, kcal: 690, tags: ["TOP"], allergens: ["Gluten", "Lácteos", "Huevo"], pair: "Sangiovese" },
  { id: "branzino", category: "Principales", name: "Branzino al Forno", subtitle: "Lubina · limone · olive · hinojo", detail: "Pescado de horno, ligero y aromático, con terminación cítrica.", price: 28900, minutes: 25, kcal: 540, tags: ["Sin gluten"], allergens: ["Pescado"], pair: "Vermentino" },
  { id: "ossobuco", category: "Principales", name: "Osso Buco Milanese", subtitle: "Jarrete de ternera · gremolata · risotto", detail: "Plato lento, intenso y elegante. Ideal si quieres algo memorable.", price: 32500, minutes: 32, kcal: 820, tags: ["CHEF"], allergens: ["Lácteos"], pair: "Barolo" },
  { id: "risotto", category: "Principales", name: "Risotto ai Funghi", subtitle: "Carnaroli · porcini · grana padano", detail: "Textura cremosa, perfume de bosque y umami elegante.", price: 19800, minutes: 21, kcal: 620, tags: ["Vegetariano"], allergens: ["Lácteos"], pair: "Nebbiolo joven" },
  { id: "tiramisu", category: "Postres", name: "Tiramisù Classico", subtitle: "Mascarpone · espresso · savoiardi", detail: "Capas suaves, café intenso y cacao amargo.", price: 9500, minutes: 7, kcal: 410, tags: ["TOP"], allergens: ["Gluten", "Lácteos", "Huevo", "Cafeína"], pair: "Vin Santo" },
  { id: "panna", category: "Postres", name: "Panna Cotta", subtitle: "Vainilla bourbon · frutti rossi", detail: "Fina, fría y sedosa, con acidez de frutos rojos.", price: 8200, minutes: 6, kcal: 330, tags: ["Sin gluten"], allergens: ["Lácteos"], pair: "Moscato d'Asti" },
  { id: "spritz", category: "Bebidas", name: "Spritz Aperol", subtitle: "Aperol · Prosecco · soda", detail: "Aperitivo fresco, cítrico y amargo suave.", price: 9800, minutes: 5, kcal: 180, tags: ["2x1 18–20"], allergens: [], pair: "Arancini" },
  { id: "vino", category: "Bebidas", name: "Vino de la Casa", subtitle: "Tinto o blanco · copa", detail: "Selección rotativa por temporada.", price: 7500, minutes: 3, kcal: 125, tags: [], allergens: ["Sulfitos"], pair: "Pasta fresca" },
  { id: "agua", category: "Bebidas", name: "San Pellegrino", subtitle: "Acqua frizzante 750ml", detail: "Agua mineral con gas.", price: 4500, minutes: 2, kcal: 0, tags: [], allergens: [], pair: "Toda la carta" },
];

const PROMOS = [
  { eyebrow: "LUN–VIE", title: "Menú del Día", body: "Entrada + principal + postre + bebida", price: "$32.000" },
  { eyebrow: "18–20 H", title: "Aperitivo", body: "Spritz y cócteles seleccionados", price: "2×1" },
  { eyebrow: "CHEF", title: "Maridaje", body: "3 copas recomendadas por plato", price: "$18.900" },
];

const KITCHEN_STEPS = [
  { key: "received", label: "Recibido", detail: "Orden confirmada" },
  { key: "prep", label: "Preparando", detail: "Cocina trabajando" },
  { key: "plating", label: "Emplatando", detail: "Últimos detalles" },
  { key: "served", label: "Servido", detail: "En mesa" },
];

const initialOrders = [];

const icons = {
  home: <svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></svg>,
  menu: <svg viewBox="0 0 24 24"><path d="M4 5h16M4 12h16M4 19h16" /></svg>,
  order: <svg viewBox="0 0 24 24"><path d="M7 4h10l1 18-6-3-6 3Z" /></svg>,
  bell: <svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10 21h4" /></svg>,
  bill: <svg viewBox="0 0 24 24"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2ZM9 7h6M9 11h6M9 15h4" /></svg>,
  spark: <svg viewBox="0 0 24 24"><path d="M12 2l2.6 6.8L22 12l-7.4 3.2L12 22l-2.6-6.8L2 12l7.4-3.2Z" /></svg>,
  plus: <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>,
  minus: <svg viewBox="0 0 24 24"><path d="M5 12h14" /></svg>,
  x: <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>,
  send: <svg viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4Z" /></svg>,
  search: <svg viewBox="0 0 24 24"><path d="m21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" /></svg>,
  chef: <svg viewBox="0 0 24 24"><path d="M6 14h12v7H6zM7 14c-2-1-3-3-2-5 1-2 3-2 4-1 1-3 6-3 7 0 2-1 4 0 5 2 1 3-2 5-4 4" /></svg>,
  star: <svg viewBox="0 0 24 24"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21 7 14.2 2 9.3l6.9-1Z" /></svg>,
};

const photos = {
  burrata: "https://images.unsplash.com/photo-1608897013039-887f21d8c804?q=80&w=600&auto=format&fit=crop",
  carpaccio: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?q=80&w=600&auto=format&fit=crop",
  arancini: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?q=80&w=600&auto=format&fit=crop",
  tagliatelle: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?q=80&w=600&auto=format&fit=crop",
  branzino: "https://images.unsplash.com/photo-1535400255456-984241443b29?q=80&w=600&auto=format&fit=crop",
  ossobuco: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=600&auto=format&fit=crop",
  risotto: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?q=80&w=600&auto=format&fit=crop",
  tiramisu: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?q=80&w=600&auto=format&fit=crop",
  panna: "https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=600&auto=format&fit=crop",
  spritz: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?q=80&w=600&auto=format&fit=crop",
  vino: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?q=80&w=600&auto=format&fit=crop",
  agua: "https://images.unsplash.com/photo-1523362628745-0c100150b504?q=80&w=600&auto=format&fit=crop",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
:root{--bg:#080705;--panel:#15120f;--panel2:#201a15;--line:rgba(255,255,255,.09);--text:#fff7ed;--muted:#bfae9d;--dim:#776a5d;--gold:#d9a441;--gold2:#f7d37b;--red:#ef4444;--green:#34d399;--r:22px;--shadow:0 26px 70px rgba(0,0,0,.45)}
*{box-sizing:border-box} body{margin:0;background:radial-gradient(circle at 20% -10%,rgba(217,164,65,.22),transparent 32%),radial-gradient(circle at 110% 15%,rgba(126,58,242,.18),transparent 32%),#060504;color:var(--text);font-family:Inter,system-ui,sans-serif;overscroll-behavior:none}.app{max-width:430px;margin:0 auto;min-height:100dvh;position:relative;background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01));box-shadow:0 0 0 1px rgba(255,255,255,.05),0 40px 110px rgba(0,0,0,.75);overflow:hidden}.screen{min-height:100dvh;padding:16px 16px 110px;overflow:auto}.fade{animation:fade .24s ease both}@keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.glass{background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025));border:1px solid var(--line);box-shadow:var(--shadow);backdrop-filter:blur(18px)}.hero{min-height:360px;border-radius:30px;overflow:hidden;position:relative;padding:22px;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.72)),url('https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=1400&auto=format&fit=crop') center/cover}.topbar{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center}.brand{font-family:'Playfair Display',serif;text-align:center;letter-spacing:.16em;color:var(--gold2);font-size:25px;line-height:.8}.brand small{display:block;font-family:Inter;font-size:8px;letter-spacing:.55em;color:#e9d2a0;margin-top:8px}.pill{border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.28);padding:9px 13px;border-radius:999px;color:#fff;font-weight:700;font-size:12px}.hero-copy{position:relative;z-index:1}.eyebrow{color:var(--gold2);font-weight:700;font-size:13px}.hero h1{font-family:'Playfair Display',serif;font-size:46px;line-height:.95;margin:10px 0 12px;letter-spacing:-.05em}.hero p{color:#e7dbce;margin:0;font-size:14px}.action-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.action{border:1px solid var(--line);background:linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.035));border-radius:19px;min-height:104px;padding:16px;text-align:left;color:var(--text);cursor:pointer;transition:.18s transform,.18s border-color}.action:active{transform:scale(.98);border-color:rgba(217,164,65,.55)}.action svg,.nav svg,.icon svg,.btn svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.action svg{color:var(--gold2)}.action h3{margin:13px 0 5px;font-size:15px}.action p{margin:0;color:var(--muted);font-size:12px;line-height:1.45}.promo-row{display:grid;grid-template-columns:1fr;gap:10px;margin:16px 0 0}.promo{border-radius:20px;padding:14px 15px;display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center}.promo b{grid-column:1/-1;color:var(--gold2);font-size:10px;letter-spacing:.12em}.promo h3{margin:0;font-size:15px}.promo p{margin:0;color:var(--muted);font-size:12px;line-height:1.35}.promo strong{display:block;margin:0;color:var(--gold2);font-size:20px;justify-self:end}.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}.header-title{font-family:'Playfair Display',serif;font-size:23px}.icon{width:42px;height:42px;border-radius:16px;border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--text);display:grid;place-items:center}.section-title{display:flex;justify-content:space-between;align-items:end;margin:6px 2px 14px}.section-title h2{font-family:'Playfair Display',serif;font-size:31px;margin:0;letter-spacing:-.04em}.section-title span{color:var(--muted);font-size:12px}.searchbar{display:flex;gap:10px;align-items:center;margin-bottom:12px}.searchbox{flex:1;border:0;background:rgba(255,255,255,.06);border-radius:16px;padding:14px;color:white;outline:none}.cat-row{display:flex;gap:9px;overflow:auto;margin:0 -16px 14px;padding:0 16px}.cat-row::-webkit-scrollbar{display:none}.cat{white-space:nowrap;border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--muted);border-radius:999px;padding:10px 14px;font-weight:800;font-size:12px}.cat.on{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#161006;border-color:transparent}.dish-list{display:flex;flex-direction:column;gap:12px}.dish{display:grid;grid-template-columns:88px 1fr auto;gap:12px;align-items:center;border-radius:20px;padding:10px}.photo{width:88px;height:88px;border-radius:16px;background-size:cover;background-position:center;background-image:linear-gradient(135deg,#3a2418,#0f0d0b)}.dish h3{margin:0;font-size:15px}.dish p{margin:5px 0 8px;color:var(--muted);font-size:12px;line-height:1.35}.tags{display:flex;gap:5px;flex-wrap:wrap}.tag{font-size:9px;font-weight:900;color:#201405;background:rgba(247,211,123,.92);border-radius:999px;padding:4px 7px}.price{color:var(--gold2);font-weight:900}.add{width:38px;height:38px;border-radius:14px;border:1px solid rgba(217,164,65,.5);background:rgba(217,164,65,.08);color:var(--gold2);display:grid;place-items:center}.floating-cart{position:fixed;left:16px;right:16px;bottom:84px;max-width:398px;margin:auto;z-index:25;border-radius:20px;background:linear-gradient(135deg,var(--gold),var(--gold2));color:#171006;border:0;padding:16px 18px;display:flex;justify-content:space-between;align-items:center;font-weight:900;box-shadow:0 18px 40px rgba(217,164,65,.28)}.nav{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:100%;max-width:430px;height:76px;background:rgba(7,6,5,.88);backdrop-filter:blur(22px);border-top:1px solid var(--line);display:grid;grid-template-columns:repeat(5,1fr);z-index:40;padding-bottom:env(safe-area-inset-bottom)}.nav button{position:relative;border:0;background:transparent;color:var(--dim);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;font-size:10px;font-weight:800}.nav button.on{color:var(--gold2)}.nav svg{width:20px;height:20px}.cart-badge{position:absolute;top:6px;right:22px;background:var(--red);color:white;border-radius:999px;font-size:10px;padding:2px 6px}.drawer{position:fixed;left:50%;bottom:0;transform:translate(-50%,105%);width:100%;max-width:430px;max-height:82dvh;z-index:60;background:rgba(15,12,9,.96);border:1px solid var(--line);border-radius:28px 28px 0 0;padding:18px;transition:.28s cubic-bezier(.2,.8,.2,1);box-shadow:0 -30px 80px rgba(0,0,0,.68);overflow:auto}.drawer.open{transform:translate(-50%,0)}.drawer-head{display:flex;align-items:center;justify-content:space-between}.drawer h2{font-family:'Playfair Display',serif;font-size:30px;margin:0}.cart-list{display:flex;flex-direction:column;gap:10px;margin:12px 0}.cart-item{display:flex;justify-content:space-between;align-items:center;border-radius:16px;background:rgba(255,255,255,.05);padding:12px}.cart-item h4{margin:0}.cart-item small{color:var(--muted)}.qty{display:flex;align-items:center;gap:10px}.qty button{width:32px;height:32px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.06);color:white;display:grid;place-items:center}.qty svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2}.total-row{display:flex;justify-content:space-between;color:var(--muted);margin:10px 0}.total-row.strong{color:white;font-size:20px}.btn{border:0;border-radius:18px;padding:15px 18px;font-weight:900;cursor:pointer}.btn.primary{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#171006}.btn.ghost{background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--text)}.empty{color:var(--muted);text-align:center;padding:24px}.status-card{border-radius:24px;padding:18px;margin-bottom:14px}.status-head{display:flex;justify-content:space-between;align-items:center}.status-head h3{margin:0}.status-head small{color:var(--muted)}.eta{background:rgba(52,211,153,.13);color:var(--green);padding:8px 12px;border-radius:999px;font-weight:900}.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:18px 0}.step{height:7px;border-radius:999px;background:rgba(255,255,255,.12)}.step.on{background:linear-gradient(90deg,var(--gold),var(--gold2))}.order-lines{color:var(--muted);font-size:13px;line-height:1.9}.waiter-hero{border-radius:28px;padding:26px;text-align:center}.bell-big{width:148px;height:148px;border-radius:50%;border:1px solid rgba(217,164,65,.4);background:radial-gradient(circle,rgba(217,164,65,.22),rgba(255,255,255,.03));color:var(--gold2);display:grid;place-items:center;margin:24px auto;position:relative}.bell-big svg{width:58px;height:58px;fill:none;stroke:currentColor;stroke-width:1.8}.bell-big.active{animation:pulse 1.2s infinite}@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(217,164,65,.28)}50%{box-shadow:0 0 0 20px rgba(217,164,65,0)}}.quick-list{display:grid;gap:10px;margin-top:14px}.quick{border:1px solid var(--line);background:rgba(255,255,255,.06);color:var(--text);border-radius:17px;padding:15px;display:flex;justify-content:space-between;font-weight:800}.bill-card,.review-card{border-radius:26px;padding:18px}.bill-line{display:flex;justify-content:space-between;padding:13px 0;border-bottom:1px solid var(--line)}.bill-line small{display:block;color:var(--muted);margin-top:4px}.chat{height:100dvh;padding:16px 14px 0;display:flex;flex-direction:column}.messages{flex:1;overflow:auto;padding:8px 2px 12px;display:flex;flex-direction:column;gap:10px}.msg{max-width:82%;border-radius:18px;padding:12px 14px;font-size:13px;line-height:1.55}.msg.ai{align-self:flex-start;background:rgba(255,255,255,.07);border:1px solid var(--line);border-bottom-left-radius:4px}.msg.user{align-self:flex-end;background:linear-gradient(135deg,var(--gold),var(--gold2));color:#171006;border-bottom-right-radius:4px}.chips{display:flex;gap:8px;overflow:auto;padding:0 0 10px}.chips button{white-space:nowrap;border:1px solid var(--line);background:rgba(255,255,255,.06);color:var(--muted);border-radius:999px;padding:9px 12px;font-weight:700}.composer{display:flex;gap:9px;padding:10px 0 88px;border-top:1px solid var(--line)}.composer textarea{flex:1;border:0;outline:none;resize:none;border-radius:18px;padding:14px;background:rgba(255,255,255,.07);color:white}.composer button{width:48px;height:48px;border-radius:18px;border:0;background:linear-gradient(135deg,var(--gold),var(--gold2));color:#171006;display:grid;place-items:center}.stars{display:flex;justify-content:center;gap:6px;margin:16px 0}.star-btn{width:44px;height:44px;border-radius:16px;border:1px solid var(--line);background:rgba(255,255,255,.06);color:var(--gold2);display:grid;place-items:center}.star-btn.on{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#171006}.star-btn svg{width:22px;height:22px;fill:currentColor;stroke:currentColor}@media (min-width: 760px){body{padding:22px}.app{border-radius:34px;min-height:calc(100dvh - 44px);height:880px}.screen,.chat{min-height:unset;height:880px;overflow-y:auto;-webkit-overflow-scrolling:touch}.nav{bottom:22px;border-radius:0 0 34px 34px}}
.screen{-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain}
.dish-list{padding-bottom:24px}
@media (max-width:380px){.dish{grid-template-columns:68px 1fr auto;gap:10px}.photo{width:68px;height:68px}.dish h3{font-size:14px}.hero h1{font-size:38px}.action{min-height:94px;padding:14px}}
`;

function statusIndex(status) { return Math.max(0, KITCHEN_STEPS.findIndex((s) => s.key === status)); }
function getCartCount(cart) { return Object.values(cart).reduce((s, item) => s + item.qty, 0); }

function useTableSession(qrContext, sessionId) {
  const storageKey = buildStorageKey(sessionId);
  const saved = loadSession(storageKey);
  const [cart, setCart] = useState(saved?.cart || {});
  const [orders, setOrders] = useState(saved?.orders || initialOrders);
  const [waiterState, setWaiterState] = useState("idle");
  const [billRequested, setBillRequested] = useState(saved?.billRequested || false);
  const tableId = qrContext.tableId;
  useEffect(() => saveSession(storageKey, { cart, orders, billRequested }), [storageKey, cart, orders, billRequested]);
  const addItem = (dish) => setCart((c) => ({ ...c, [dish.id]: { id: dish.id, name: dish.name, price: dish.price, qty: (c[dish.id]?.qty || 0) + 1 } }));
  const removeItem = (id) => setCart((c) => { const next = { ...c }; if (!next[id]) return next; next[id].qty -= 1; if (next[id].qty <= 0) delete next[id]; return next; });
  const submitOrder = async (note = "") => {
    const items = Object.values(cart); if (!items.length) return null;
    let realId = null;
    try {
      const resp = await postWebhook("order", { qr_token: qrContext.qrToken, table_id: qrContext.tableId, session_id: sessionId, notes: note || null, items: items.map((i) => ({ menu_item_id: i.id, dish_name: i.name, unit_price: i.price, qty: i.qty })), total: items.reduce((s, i) => s + i.price * i.qty, 0) }, qrContext.restaurantId);
      if (resp && typeof resp.json === "function") { const d = await resp.json(); realId = d?.orderId || null; }
    } catch {}
    const newOrder = { id: realId || `ORD-${Math.floor(1000 + Math.random() * 8999)}`, createdAt: Date.now(), eta: 18, status: "received", items };
    setOrders((o) => [newOrder, ...o]); setCart({});
    return newOrder;
  };
  const toCallType = (reason) => {
    if (!reason) return "Camarero";
    const r = reason.toLowerCase();
    if (r.includes("alergia")) return "Alergia";
    if (r.includes("agua")) return "Agua";
    if (r.includes("servilleta")) return "Servilletas";
    if (r.includes("cobro") || r.includes("cuenta")) return "Cuenta";
    return "Camarero";
  };
  const callWaiter = async (reason = "Atención solicitada") => {
    setWaiterState("calling");
    await postWebhook("camarero", { qr_token: qrContext.qrToken, table_id: qrContext.tableId, session_id: sessionId, call_type: toCallType(reason), message: reason }, qrContext.restaurantId);
    setWaiterState("sent"); setTimeout(() => setWaiterState("idle"), 3500);
  };
  const requestBill = async (qrCtx) => {
    await postWebhook("bill", { qr_token: qrCtx.qrToken, table_id: qrCtx.tableId, session_id: null }, qrCtx.restaurantId);
    await callWaiter("Cliente solicita cobro presencial en mesa");
    setBillRequested(true);
  };
  return { cart, orders, waiterState, billRequested, addItem, removeItem, submitOrder, callWaiter, requestBill };
}

function Header({ title = RESTAURANT.name, qrContext = FALLBACK_CONTEXT }) {
  return <div className="header"><button className="icon">{icons.menu}</button><div className="header-title">{title}</div><div className="pill">{qrContext.tableLabel}</div></div>;
}

function Home({ go, session, qrContext = FALLBACK_CONTEXT, restaurant = RESTAURANT, promos = PROMOS }) {
  const active = session.orders.find((o) => o.status !== "served");
  return <main className="screen fade"><section className="hero"><div className="topbar"><button className="icon">{icons.menu}</button><div className="brand">{restaurant.name}<small>RISTORANTE</small></div><div className="pill">{qrContext.tableLabel}</div></div><div className="hero-copy"><span className="eyebrow">Benvenuto · {qrContext.zone}</span><h1>Disfruta tu experiencia</h1><p>{restaurant.concept || RESTAURANT.concept} · {RESTAURANT.city}</p></div></section><div className="action-grid"><button className="action" onClick={() => go("menu")}>{icons.menu}<h3>Carta</h3><p>Explora el menú y agrega platos.</p></button><button className="action" onClick={() => go("order")}>{icons.order}<h3>Estado del pedido</h3><p>{active ? `${active.id} · ${active.eta} min` : "Sigue cocina en vivo."}</p></button><button className="action" onClick={() => go("waiter")}>{icons.bell}<h3>Llamar camarero</h3><p>Ayuda, bebidas o atención rápida.</p></button><button className="action" onClick={() => go("bill")}>{icons.bill}<h3>La cuenta</h3><p>Ver consumo y solicitar cobro.</p></button><button className="action" onClick={() => go("feedback")}>{icons.star}<h3>Reseña</h3><p>Valora la experiencia.</p></button></div>{promos.length > 0 && <div className="promo-row">{promos.map((p, i) => <article className="promo glass" key={p.title || i}><b>{p.eyebrow}</b><h3>{p.title}</h3><p>{p.body}</p><strong>{p.price}</strong></article>)}</div>}</main>;
}

function Menu({ session, openCart, qrContext = FALLBACK_CONTEXT, menu = MENU }) {
  const [cat, setCat] = useState("Todos"); const [q, setQ] = useState("");
  const cats = ["Todos", ...Array.from(new Set(menu.map((d) => d.category)))];
  const list = menu.filter((d) => (cat === "Todos" || d.category === cat) && (d.name + d.subtitle + (Array.isArray(d.tags) ? d.tags.join(" ") : String(d.tags || ""))).toLowerCase().includes(q.toLowerCase()));
  const subtotal = Object.values(session.cart).reduce((s, i) => s + i.price * i.qty, 0); const count = getCartCount(session.cart);
  return <main className="screen fade"><Header title="Carta" qrContext={qrContext} /><div className="searchbar"><div className="icon">{icons.search}</div><input className="searchbox" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar plato, alérgeno o categoría..." /></div><div className="cat-row">{cats.map((c) => <button key={c} className={`cat ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c}</button>)}</div><div className="dish-list">{list.map((d) => { const imgUrl = d.imageUrl || photos[d.id] || ""; const tagList = Array.isArray(d.tags) ? d.tags : String(d.tags || "").split(",").map((t) => t.trim()).filter(Boolean); return <article className="dish glass" key={d.id}><div className="photo" style={imgUrl ? { backgroundImage: `url(${imgUrl})` } : {}} /><div><h3>{d.name}</h3><p>{d.subtitle}</p><div className="tags">{tagList.slice(0, 2).map((t) => <span className="tag" key={t}>{t}</span>)}</div><div style={{ marginTop: 8, color: "#bfae9d", fontSize: 11 }}>{d.minutes || d.avgPrep || 0} min{d.kcal ? ` · ${d.kcal} kcal` : ""}</div></div><div style={{ display: "grid", gap: 10, justifyItems: "end" }}><div className="price">{money(d.price)}</div><button className="add" style={session.cart[d.id]?.qty > 0 ? { background: "linear-gradient(135deg,var(--gold),var(--gold2))", color: "#171006", borderColor: "transparent", fontWeight: 900, fontSize: 13 } : {}} onClick={() => session.addItem(d)}>{session.cart[d.id]?.qty > 0 ? session.cart[d.id].qty : icons.plus}</button></div></article>; })}</div>{count > 0 && <button className="floating-cart" onClick={openCart}><span>{count} item{count > 1 ? "s" : ""}</span><span>{money(subtotal)} · Ver pedido</span></button>}</main>;
}

function CartDrawer({ open, setOpen, session, go }) {
  const [note, setNote] = useState(""); const items = Object.values(session.cart); const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  return <aside className={`drawer ${open ? "open" : ""}`}><div className="drawer-head"><h2>Tu pedido</h2><button className="icon" onClick={() => setOpen(false)}>{icons.x}</button></div><div className="cart-list">{items.length ? items.map((item) => <div className="cart-item" key={item.id}><div><h4>{item.name}</h4><small>{item.qty} × {money(item.price)}</small></div><div className="qty"><button onClick={() => session.removeItem(item.id)}>{icons.minus}</button><strong>{item.qty}</strong><button onClick={() => session.addItem(MENU.find((d) => d.id === item.id))}>{icons.plus}</button></div></div>) : <div className="empty">Aún no agregaste platos.</div>}</div>{!!items.length && <><textarea className="searchbox glass" style={{ width: "100%", color: "white", minHeight: 72, border: "1px solid rgba(255,255,255,.12)" }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notas para cocina: sin cebolla, punto de carne, alergias..." /><div className="total-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div className="total-row"><span>Servicio sugerido 10%</span><strong>{money(subtotal * 0.1)}</strong></div><div className="total-row strong"><span>Total estimado</span><strong>{money(subtotal * 1.1)}</strong></div><button className="btn primary" style={{ width: "100%" }} onClick={async () => { await session.submitOrder(note); setNote(""); setOpen(false); go("order"); }}>Enviar a cocina</button></>}</aside>;
}

const STATUS_STEP = { received: "received", preparing: "prep", "listo para servir": "plating", ready: "plating", served: "served" };
function normalizeDbStatus(s) { return STATUS_STEP[(s || "").toLowerCase()] || s || "received"; }

// Polls the orders table directly via REST — same approach as admin.jsx.
// This bypasses the table_orders RPC so status updates from kitchen
// are always reflected, even if the RPC has stale behavior.
function useLiveOrders(qrContext) {
  const [orders, setOrders] = useState(null);
  useEffect(() => {
    const { tableId, restaurantId } = qrContext;
    if (!tableId || !restaurantId) return;
    const poll = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/orders?table_id=eq.${encodeURIComponent(tableId)}&restaurant_id=eq.${encodeURIComponent(restaurantId)}&order=created_at.desc&select=id,status,eta_minutes,created_at,order_items(dish_name,qty,unit_price)`,
          { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
        );
        if (!res.ok) return;
        const rows = await res.json();
        if (!Array.isArray(rows)) return;
        setOrders(rows.map((o) => ({
          id: o.id,
          createdAt: new Date(o.created_at).getTime(),
          eta: o.eta_minutes || 18,
          status: normalizeDbStatus(o.status),
          items: (o.order_items || []).map((i) => ({ id: i.dish_name, name: i.dish_name, qty: i.qty, price: i.unit_price })),
        })));
      } catch (e) { console.error("[holu mesa] orders poll:", e.message); }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [qrContext.tableId, qrContext.restaurantId]);
  return orders;
}

function OrderStatus({ session, qrContext = FALLBACK_CONTEXT, liveOrders }) {
  // Show only non-served orders; fall back to local session state while DB loads.
  const dbActive = liveOrders ? liveOrders.filter((o) => o.status !== "served") : null;
  const orders = dbActive !== null ? dbActive : session.orders.filter((o) => o.status !== "served");
  const allServed = liveOrders && liveOrders.length > 0 && liveOrders.every((o) => o.status === "served");
  return <main className="screen fade"><Header /><div className="section-title"><h2>Estado del pedido</h2><span>Live kitchen</span></div>
    {allServed && <div className="status-card glass" style={{ textAlign: "center", padding: 32 }}><div style={{ fontSize: 48, marginBottom: 12 }}>✓</div><h3 style={{ margin: 0, color: "var(--green)" }}>Todo en mesa</h3><p style={{ color: "var(--muted)", margin: "8px 0 0" }}>Todos los platos han sido servidos. ¡Que lo disfrutes!</p></div>}
    {!allServed && (orders.length ? orders.map((o) => <article key={o.id} className="status-card glass"><div className="status-head"><div><h3>{o.id}</h3><small>{new Date(o.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</small></div><div className="eta">{o.status === "served" ? "Listo ✓" : `${o.eta} min`}</div></div><div className="steps">{KITCHEN_STEPS.map((s, i) => <span key={s.key} className={`step ${i <= statusIndex(o.status) ? "on" : ""}`} />)}</div><div className="order-lines">{KITCHEN_STEPS.map((s, i) => <div key={s.key} style={{ opacity: i <= statusIndex(o.status) ? 1 : .38 }}>● {s.label} — {s.detail}</div>)}<br />{o.items.map((it) => <div key={it.id || it.name}>{it.qty}× {it.name}</div>)}</div></article>) : <div className="empty glass">No hay pedidos activos.</div>)}
  </main>;
}

function Waiter({ session, qrContext = FALLBACK_CONTEXT }) {
  const reasons = ["Tomar pedido presencial", "Más agua", "Más servilletas", "Retirar platos", "Tengo una alergia", "Urgente en mesa"];
  return <main className="screen fade"><Header /><section className="waiter-hero glass"><h2 style={{ margin: 0, fontSize: 28, letterSpacing: "-.06em" }}>Atención en mesa</h2><p style={{ color: "#bfae9d" }}>Notifica al camarero sin levantar la mano.</p><button className={`bell-big ${session.waiterState !== "idle" ? "active" : ""}`} onClick={() => session.callWaiter()}>{icons.bell}</button><strong>{session.waiterState === "idle" ? "Tocar para llamar" : session.waiterState === "calling" ? "Enviando aviso..." : "Camarero notificado"}</strong></section><div className="quick-list">{reasons.map((r) => <button className="quick" key={r} onClick={() => session.callWaiter(r)}><span>{r}</span><span>→</span></button>)}</div></main>;
}

function Bill({ session, qrContext = FALLBACK_CONTEXT, liveOrders }) {
  const [paying, setPaying] = useState(false);
  const sourceOrders = liveOrders !== null && liveOrders !== undefined ? liveOrders : session.orders;
  const items = sourceOrders.flatMap((o) => o.items);
  const grouped = items.reduce((acc, it) => {
    const key = it.name || it.id;
    return { ...acc, [key]: { ...it, qty: (acc[key]?.qty || 0) + it.qty } };
  }, {});
  const subtotal = Object.values(grouped).reduce((s, it) => s + it.qty * it.price, 0);
  const tip = Math.round(subtotal * 0.1); const total = subtotal + tip;
  const requestPayment = async () => {
    setPaying(true);
    try { await session.requestBill(qrContext); } finally { setPaying(false); }
  };
  if (session.billRequested) return (
    <main className="screen fade">
      <Header qrContext={qrContext} />
      <section className="bill-card glass" style={{ textAlign: "center", padding: 36 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✓</div>
        <h2 style={{ margin: "0 0 10px", fontFamily: "'Playfair Display',serif" }}>Cobro solicitado</h2>
        <p style={{ color: "#bfae9d", margin: 0 }}>El camarero viene en camino.<br />El pago siempre se realiza en la mesa.</p>
        {subtotal > 0 && <p style={{ color: "var(--gold2)", fontWeight: 900, fontSize: 22, margin: "20px 0 0" }}>Total estimado: {money(total)}</p>}
      </section>
    </main>
  );
  return <main className="screen fade"><Header qrContext={qrContext} /><div className="section-title"><h2>Cuenta</h2><span>{qrContext.tableLabel}</span></div><section className="bill-card glass">{Object.values(grouped).length ? Object.values(grouped).map((it) => <div className="bill-line" key={it.id}><div><strong>{it.name}</strong><small>{it.qty} × {money(it.price)}</small></div><strong>{money(it.qty * it.price)}</strong></div>) : <div className="empty">Sin consumo registrado todavía.</div>}<div className="total-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div className="total-row"><span>Servicio sugerido 10%</span><strong>{money(tip)}</strong></div><div className="total-row strong"><span>Total</span><strong>{money(total)}</strong></div><button disabled={!subtotal || paying} className="btn primary" style={{ width: "100%", opacity: !subtotal ? .45 : 1 }} onClick={requestPayment}>{paying ? "Notificando al camarero..." : "Solicitar cobro"}</button><p style={{ color: "#bfae9d", fontSize: 12, lineHeight: 1.5, margin: "12px 0 0" }}>El cobro siempre lo realiza el camarero en la mesa.</p></section></main>;
}

function Feedback({ qrContext = FALLBACK_CONTEXT, restaurant = RESTAURANT }) {
  const [rating, setRating] = useState(5); const [comment, setComment] = useState(""); const [sent, setSent] = useState(false);
  const submitFeedback = async () => {
    await postWebhook("feedback", { table_id: qrContext.tableId, rating: Number(rating), comment: comment || null, source: "table_qr" }, qrContext.restaurantId);
    setSent(true);
  };
  const reviewUrl = restaurant.googleReviewUrl || RESTAURANT.googleReviewUrl;
  return <main className="screen fade"><Header title="Reseña" /><section className="review-card glass"><div className="section-title" style={{ display: "block", textAlign: "center", margin: 0 }}><h2>¿Qué tal estuvo?</h2><span>Tu opinión ayuda al restaurante a mejorar.</span></div><div className="stars">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={`star-btn ${n <= rating ? "on" : ""}`} onClick={() => setRating(n)}>{icons.star}</button>)}</div><textarea className="searchbox glass" style={{ width: "100%", color: "white", minHeight: 96, border: "1px solid rgba(255,255,255,.12)" }} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentario opcional..." /><button className="btn primary" style={{ width: "100%", marginTop: 12 }} onClick={submitFeedback}>{sent ? "Reseña enviada ✓" : "Enviar valoración"}</button>{reviewUrl && <button className="btn ghost" style={{ width: "100%", marginTop: 10 }} onClick={() => window.open(reviewUrl, "_blank")}>Dejar reseña en Google</button>}</section></main>;
}


function Nav({ tab, setTab, cartCount }) {
  const items = [["home", "Inicio", icons.home], ["menu", "Carta", icons.menu], ["order", "Pedido", icons.order], ["waiter", "Camarero", icons.bell], ["bill", "Cuenta", icons.bill]];
  return <nav className="nav">{items.map(([id, label, icon]) => <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{id === "menu" && cartCount > 0 && <span className="cart-badge">{cartCount}</span>}{icon}<span>{label}</span></button>)}</nav>;
}

const dbItemToMenu = (m) => ({
  id: m.id,
  category: m.category,
  name: m.name,
  subtitle: m.subtitle || "",
  detail: m.description || "",
  price: m.price,
  minutes: m.avg_prep_minutes || 15,
  kcal: m.kcal || 0,
  tags: m.tags || [],
  allergens: m.allergens || [],
  pair: m.wine_pair || "",
  imageUrl: m.image_url || "",
});

export default function HoluMesa() {
  const [qrToken] = useState(() => getQrToken());
  const [qrContext, setQrContext] = useState(FALLBACK_CONTEXT);
  const [loadingQr, setLoadingQr] = useState(true);
  const [tab, setTab] = useState("home");
  const [cartOpen, setCartOpen] = useState(false);
  const [restaurantData, setRestaurantData] = useState(RESTAURANT);
  const [liveMenu, setLiveMenu] = useState(null);
  const [promos, setPromos] = useState(null);
  const sessionId = buildSessionId(qrToken, qrContext.tableId);
  const session = useTableSession(qrContext, sessionId);
  const liveOrders = useLiveOrders(qrContext);
  const cartCount = useMemo(() => getCartCount(session.cart), [session.cart]);

  useEffect(() => {
    let active = true;
    setLoadingQr(true);
    resolveQrContext(qrToken).then((ctx) => {
      if (!active) return;
      setQrContext(ctx);
      setLoadingQr(false);
      // Scanning the QR is what puts the table into service.
      if (ctx.active) supaRpc("open_table_session", { p_qr_token: qrToken }).catch(() => {});
      if (ctx.restaurant) {
        setRestaurantData((prev) => ({
          ...prev,
          name: ctx.restaurant.name || prev.name,
          concept: ctx.restaurant.concept || prev.concept,
          googleReviewUrl: ctx.restaurant.googleReviewUrl || "",
        }));
      }
    });
    return () => { active = false; };
  }, [qrToken]);

  useEffect(() => {
    if (!qrContext.restaurantId) return;
    supaRpc("restaurant_public", { p_id: qrContext.restaurantId })
      .then((rows) => {
        const r = Array.isArray(rows) ? rows[0] : rows;
        if (Array.isArray(r?.settings?.promos)) setPromos(r.settings.promos);
        else setPromos([]);
      })
      .catch(() => setPromos([]));
  }, [qrContext.restaurantId]);

  useEffect(() => {
    if (!qrContext.restaurantId) return;
    fetch(`${SUPABASE_URL}/rest/v1/menu_items?restaurant_id=eq.${encodeURIComponent(qrContext.restaurantId)}&available=eq.true&visible_client=eq.true&order=sort_order.asc,name.asc`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((rows) => {
        if (Array.isArray(rows) && rows.length > 0) setLiveMenu(rows.map(dbItemToMenu));
      })
      .catch(() => {});
  }, [qrContext.restaurantId]);

  if (loadingQr) return <div className="app"><style>{CSS}</style><main className="screen fade"><section className="hero"><div className="brand">{restaurantData.name}<small>RISTORANTE</small></div><div className="hero-copy"><span className="eyebrow">Validando QR</span><h1>Preparando tu mesa</h1><p>Un momento...</p></div></section></main></div>;

  if (!qrContext.active) return <div className="app"><style>{CSS}</style><main className="screen fade"><section className="hero"><div className="brand">{restaurantData.name}<small>RISTORANTE</small></div><div className="hero-copy"><span className="eyebrow">QR no disponible</span><h1>Solicita ayuda</h1><p>Este código no está activo. Por favor avisa al camarero.</p></div></section></main></div>;

  return <div className="app"><style>{CSS}</style>{tab === "home" && <Home go={setTab} session={session} qrContext={qrContext} restaurant={restaurantData} promos={promos ?? PROMOS} />}{tab === "menu" && <Menu session={session} qrContext={qrContext} openCart={() => setCartOpen(true)} menu={liveMenu || MENU} />}{tab === "order" && <OrderStatus session={session} qrContext={qrContext} liveOrders={liveOrders} />}{tab === "waiter" && <Waiter session={session} qrContext={qrContext} />}{tab === "bill" && <Bill session={session} qrContext={qrContext} liveOrders={liveOrders} />}{tab === "feedback" && <Feedback qrContext={qrContext} restaurant={restaurantData} />}<CartDrawer open={cartOpen} setOpen={setCartOpen} session={session} go={setTab} /><Nav tab={tab} setTab={setTab} cartCount={cartCount} /></div>;
}
