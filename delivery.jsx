import { useState, useEffect, useMemo, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// HOLU DELIVERY — PEDIDOS A DOMICILIO
//
// The restaurant is named in the URL (?r=<restaurant_id>), the same way a table
// is named by its QR token. The carta comes from the database, so it is the one
// the restaurant actually publishes — no menu is compiled in here.
//
// Nothing on this page creates an order. Submitting the basket only records the
// intent and hands the customer to MercadoPago; the kitchen sees the order once
// the payment is confirmed. Otherwise anyone could make a kitchen cook for free.
// ═══════════════════════════════════════════════════════════════════════════════

const getEnv = (key, fallback = "") => {
  try { if (typeof import.meta !== "undefined" && import.meta.env?.[key] != null) return String(import.meta.env[key]); } catch {}
  return fallback;
};

const N8N_BASE = getEnv("VITE_N8N_WEBHOOK_BASE", "");
const SUPABASE_URL = getEnv("VITE_SUPABASE_URL", "https://nlwrkumlrudfgsdnhfhw.supabase.co");
const SUPABASE_ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sd3JrdW1scnVkZmdzZG5oZmh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODc1NTgsImV4cCI6MjA5NDE2MzU1OH0.Bi0v-temjfU-BDFVuyJTyc_19ZRx-T_we3MfeEkcsfg");
const GOOGLE_MAPS_API_KEY = getEnv("VITE_GOOGLE_MAPS_API_KEY", "");

const webhookUrl = (path) => {
  const base = N8N_BASE.replace(/\/+$/, "");
  return base ? `${base}/webhook/${path}` : `/webhook/${path}`;
};

const money = (n) => `$${Number(n || 0).toLocaleString("es-CL")}`;

const params = () => {
  try { return new URL(window.location.href).searchParams; } catch { return new URLSearchParams(); }
};

const supaHeaders = () => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
});

const supaRpc = async (fn, args) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST", headers: supaHeaders(), body: JSON.stringify(args || {}),
  });
  if (!res.ok) throw new Error(`rpc ${fn} ${res.status}`);
  return res.json();
};

// The same gold-on-black identity as mesa.jsx and admin.jsx, so a diner who
// ordered from the table QR recognizes the brand when they order delivery too.
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box}
body{margin:0}
.dv{min-height:100dvh;background:#080705;color:#fff7ed;font-family:Inter,system-ui,sans-serif}
.dv a,.dv button{font-family:inherit}
.dv-hero{position:relative;padding:20px 20px 26px;display:flex;flex-direction:column;justify-content:flex-end;min-height:200px;background-size:cover;background-position:center}
.dv-hero::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,7,5,.55),rgba(8,7,5,.92)),radial-gradient(circle at 15% 0%,rgba(217,164,65,.22),transparent 55%)}
.dv-hero-in{position:relative;z-index:1}
.dv-hero-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.dv-brand{display:flex;align-items:center;gap:9px}
.dv-brand img{height:26px;width:auto}
.dv-brand span{font-weight:900;font-size:13px;letter-spacing:.14em;color:#bfae9d}
.dv-hero h1{font-family:'Playfair Display',serif;font-size:32px;line-height:1.05;margin:16px 0 8px;letter-spacing:-.02em}
.dv-hero-meta{display:flex;gap:8px;flex-wrap:wrap}
.dv-badge{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(6px);border-radius:999px;padding:6px 13px;font-weight:700;font-size:12px;color:#f3e7d6}
.dv-badge.warn{background:rgba(217,164,65,.16);border-color:rgba(217,164,65,.35);color:#f7d37b}
.dv-body{max-width:980px;margin:0 auto;padding:0 16px 110px}
.dv-cats{display:flex;gap:8px;overflow-x:auto;padding:16px 0;position:sticky;top:0;background:#080705;z-index:6;-ms-overflow-style:none;scrollbar-width:none}
.dv-cats::-webkit-scrollbar{display:none}
.dv-cat{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#bfae9d;border-radius:999px;padding:9px 16px;font-weight:800;font-size:13px;white-space:nowrap;cursor:pointer;flex-shrink:0}
.dv-cat.on{background:linear-gradient(135deg,#d9a441,#f7d37b);color:#171006;border-color:transparent}
.dv-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
@media(min-width:600px){.dv-grid{grid-template-columns:repeat(3,1fr)}}
@media(min-width:860px){.dv-grid{grid-template-columns:repeat(4,1fr)}}
.dv-card{background:linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.08);border-radius:18px;overflow:hidden;display:flex;flex-direction:column}
.dv-card-photo{aspect-ratio:1/1;background:#15120f;display:grid;place-items:center;font-size:28px;font-weight:900;color:#f7d37b;overflow:hidden}
.dv-card-photo img{width:100%;height:100%;object-fit:cover;display:block}
.dv-card-body{padding:10px 11px 12px;display:flex;flex-direction:column;gap:3px;flex:1}
.dv-card h3{margin:0;font-size:13.5px;font-weight:700;line-height:1.3}
.dv-card p{margin:0;font-size:11px;color:#8a7c6d;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dv-card-foot{display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:7px}
.dv-price{color:#f7d37b;font-weight:900;font-size:13.5px}
.dv-add{width:30px;height:30px;border-radius:10px;border:0;background:linear-gradient(135deg,#d9a441,#f7d37b);color:#171006;font-size:18px;font-weight:900;cursor:pointer;display:grid;place-items:center;line-height:1}
.dv-qty{display:flex;align-items:center;gap:6px}
.dv-qty button{width:26px;height:26px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff7ed;font-size:15px;cursor:pointer;display:grid;place-items:center;line-height:1}
.dv-qty span{min-width:14px;text-align:center;font-weight:800;font-size:13px}
.dv-empty{padding:60px 20px;text-align:center;color:#8a7c6d}
.dv-bar{position:fixed;left:16px;right:16px;bottom:16px;max-width:640px;margin:0 auto;background:linear-gradient(135deg,#d9a441,#f7d37b);color:#171006;border-radius:16px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-weight:900;box-shadow:0 18px 44px rgba(217,164,65,.32);z-index:10}
.dv-bar button{background:#171006;color:#f7d37b;border:0;border-radius:12px;padding:10px 18px;font-weight:900;font-size:14px;cursor:pointer}
.dv-promos{display:flex;gap:12px;overflow-x:auto;padding:18px 0 4px;-ms-overflow-style:none;scrollbar-width:none}
.dv-promos::-webkit-scrollbar{display:none}
.dv-promo{flex:0 0 auto;width:220px;background:linear-gradient(150deg,rgba(217,164,65,.16),rgba(255,255,255,.02));border:1px solid rgba(217,164,65,.28);border-radius:18px;padding:16px}
.dv-promo b{display:block;color:#f7d37b;font-size:10px;letter-spacing:.14em;font-weight:800;margin-bottom:6px}
.dv-promo h4{margin:0 0 4px;font-family:'Playfair Display',serif;font-size:19px;line-height:1.2}
.dv-promo p{margin:0;color:#bfae9d;font-size:12px;line-height:1.4}
.dv-promo strong{display:block;margin-top:10px;color:#fff7ed;font-size:17px;font-weight:900}
.dv-foot{margin-top:36px;padding-top:20px;border-top:1px solid rgba(255,255,255,.08);display:grid;gap:6px;color:#8a7c6d;font-size:13px}
.dv-foot a{color:#f7d37b;text-decoration:none}
a:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid #f7d37b;outline-offset:2px;border-radius:6px}
`;

// ── Seguimiento ──────────────────────────────────────────────────────────────
// The token is the customer's only credential, and track_delivery() runs as
// definer so it returns their progress without anon needing to read orders.
const STEPS = [
  { key: "received", label: "Recibido" },
  { key: "cooking", label: "En preparación" },
  { key: "en_route", label: "En camino" },
  { key: "delivered", label: "Entregado" },
];

function stepIndex(d) {
  if (d.status === "delivered") return 3;
  if (d.status === "en_route") return 2;
  if (["prep", "plating"].includes(d.kitchen_status)) return 1;
  return 0;
}

function Tracking({ token }) {
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await supaRpc("track_delivery", { p_token: token });
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (cancelled) return;
        if (!row) { setNotFound(true); return; }
        setData(row);
      } catch { if (!cancelled) setNotFound(true); }
    };
    load();
    const t = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(t); };
  }, [token]);

  if (notFound) return <Shell><Card>
    <h2 style={S.h2}>Pedido no encontrado</h2>
    <p style={S.muted}>Revisa el enlace que te enviamos. Si acabas de pagar, espera unos segundos y recarga.</p>
  </Card></Shell>;

  if (!data) return <Shell><Card><p style={S.muted}>Cargando tu pedido…</p></Card></Shell>;

  const idx = stepIndex(data);
  const done = data.status === "delivered";

  return <Shell>
    <Card wide>
      <div style={{ fontSize: 46, marginBottom: 4 }}>{done ? "🎉" : "🛵"}</div>
      <h2 style={S.h2}>{done ? "¡Entregado!" : "Tu pedido va en camino"}</h2>
      <p style={{ ...S.muted, marginBottom: 22 }}>{data.restaurant_name}</p>

      <div style={{ display: "grid", gap: 10, textAlign: "left", marginBottom: 22 }}>
        {STEPS.map((s, i) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 12, opacity: i <= idx ? 1 : .35 }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
              display: "grid", placeItems: "center", fontSize: 14, fontWeight: 900,
              background: i <= idx ? "linear-gradient(135deg,#d9a441,#f7d37b)" : "#211b14",
              color: i <= idx ? "#171006" : "#8a7c6d",
            }}>{i < idx || done ? "✓" : i + 1}</div>
            <span style={{ fontWeight: i === idx ? 800 : 500 }}>{s.label}</span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 14, textAlign: "left" }}>
        {(data.items || []).map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, margin: "6px 0" }}>
            <span>{it.qty}× {it.dish_name}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, marginTop: 12, fontSize: 16 }}>
          <span>Total</span><span>{money(data.total)}</span>
        </div>
        {!done && <p style={{ ...S.muted, marginTop: 12, fontSize: 13 }}>Tiempo estimado: {data.eta_minutes} min</p>}
      </div>
    </Card>
  </Shell>;
}

// ── Pedido ───────────────────────────────────────────────────────────────────
export default function HoluDelivery() {
  const track = params().get("seguimiento");
  if (track) return <Tracking token={track} />;
  return <Ordering />;
}

function Ordering() {
  const [restaurantId] = useState(() => params().get("r") || "");
  const [rest, setRest] = useState(null);        // null = cargando
  const [menu, setMenu] = useState(null);
  const [cat, setCat] = useState("");
  const [cart, setCart] = useState({});
  const [step, setStep] = useState("menu");      // menu | datos | enviando
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "", lat: null, lng: null });
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!restaurantId) { setRest({ missing: true }); return; }
    supaRpc("restaurant_public", { p_id: restaurantId })
      .then((rows) => {
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (cancelled) return;
        setRest(row?.id ? row : { missing: true });
      })
      .catch(() => { if (!cancelled) setRest({ missing: true }); });
    return () => { cancelled = true; };
  }, [restaurantId]);

  useEffect(() => {
    let cancelled = false;
    if (!rest?.id) return;
    fetch(`${SUPABASE_URL}/rest/v1/menu_items?restaurant_id=eq.${encodeURIComponent(rest.id)}&available=eq.true&visible_client=eq.true&select=id,name,subtitle,category,price,image_url&order=sort_order.asc,name.asc`,
      { headers: supaHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("menu"))))
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setMenu(list);
        setCat((c) => c || list[0]?.category || "");
      })
      .catch(() => { if (!cancelled) setMenu([]); });
    return () => { cancelled = true; };
  }, [rest?.id]);

  const cfg = rest?.settings?.delivery || {};
  const fee = Number(cfg.fee || 0);
  const minOrder = Number(cfg.min_order || 0);
  const coverUrl = rest?.settings?.coverUrl || "";
  const promos = Array.isArray(rest?.settings?.promos) ? rest.settings.promos.filter((p) => p.title?.trim()) : [];

  const cats = useMemo(() => (menu ? [...new Set(menu.map((i) => i.category).filter(Boolean))] : []), [menu]);
  const items = Object.entries(cart)
    .map(([id, qty]) => { const m = (menu || []).find((x) => x.id === id); return m ? { ...m, qty } : null; })
    .filter(Boolean);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const total = subtotal > 0 ? subtotal + fee : 0;
  const count = items.reduce((s, i) => s + i.qty, 0);
  const belowMin = subtotal > 0 && subtotal < minOrder;

  const add = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const sub = (id) => setCart((c) => { const n = { ...c }; if (n[id] > 1) n[id]--; else delete n[id]; return n; });

  const checkout = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      return setErr("Necesitamos tu nombre, teléfono y dirección.");
    }
    if (GOOGLE_MAPS_API_KEY && (form.lat == null || form.lng == null)) {
      return setErr("Elige tu dirección de la lista de sugerencias para que podamos confirmar que estás dentro de la zona de reparto.");
    }
    setStep("enviando"); setErr("");
    try {
      const res = await fetch(webhookUrl("delivery-checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: rest.id,
          customer_name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          address_notes: form.notes.trim() || null,
          lat: form.lat,
          lng: form.lng,
          // Only ids and quantities travel: the price is looked up server-side
          // so an edited page cannot buy a $20.000 dish for $1.
          items: items.map((i) => ({ menu_item_id: i.id, qty: i.qty })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.init_point) throw new Error("checkout");
      window.location.href = data.init_point;
    } catch {
      setErr("No pudimos abrir el pago. Inténtalo de nuevo en un momento.");
      setStep("datos");
    }
  };

  if (rest === null) return <Shell><Card><p style={S.muted}>Cargando…</p></Card></Shell>;

  if (rest.missing) return <Shell><Card>
    <div style={{ fontSize: 56 }}>🔗</div>
    <h2 style={S.h2}>Enlace incompleto</h2>
    <p style={S.muted}>Falta identificar el restaurante. La dirección debe terminar en <b>?r=CODIGO</b>.</p>
  </Card></Shell>;

  if (cfg.enabled === false) return <Shell><Card>
    <div style={{ fontSize: 56 }}>🚧</div>
    <h2 style={S.h2}>Delivery no disponible</h2>
    <p style={S.muted}>{rest.name} no está tomando pedidos a domicilio en este momento.</p>
  </Card></Shell>;

  if (step === "enviando") return <Shell><Card><p style={S.muted}>Llevándote a MercadoPago…</p></Card></Shell>;

  if (step === "datos") return <Shell>
    <Card wide>
      <h2 style={{ ...S.h2, marginBottom: 4 }}>¿Dónde lo llevamos?</h2>
      <p style={{ ...S.muted, marginBottom: 20 }}>{cfg.zones ? `Repartimos en ${cfg.zones}` : "Completa tus datos de entrega"}</p>

      <div style={{ display: "grid", gap: 12, textAlign: "left" }}>
        <Field label="Nombre" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Tu nombre" />
        <Field label="Teléfono" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="+56 9 1234 5678" type="tel" />
        <AddressField
          value={form.address}
          onChange={(v) => setForm((f) => ({ ...f, address: v, lat: null, lng: null }))}
          onPlace={({ address, lat, lng }) => setForm((f) => ({ ...f, address, lat, lng }))}
          placeholder="Calle, número, depto"
        />
        <Field label="Referencias (opcional)" value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} placeholder="Portón, timbre, piso…" />
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", marginTop: 18, paddingTop: 14, textAlign: "left" }}>
        <Line label="Subtotal" value={money(subtotal)} />
        <Line label="Envío" value={fee ? money(fee) : "Gratis"} />
        <Line label="Total" value={money(total)} strong />
      </div>

      {err && <p style={{ color: "#fca5a5", fontSize: 13, marginTop: 12 }}>{err}</p>}

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button style={S.btnGhost} onClick={() => setStep("menu")}>Volver</button>
        <button style={S.btnPrimary} onClick={checkout}>Ir a pagar</button>
      </div>
      <p style={{ ...S.muted, fontSize: 12, marginTop: 12 }}>El pedido entra a cocina una vez confirmado el pago.</p>
    </Card>
  </Shell>;

  const visible = (menu || []).filter((i) => i.category === cat);

  return <div className="dv">
    <style>{CSS}</style>

    <div className="dv-hero" style={coverUrl ? { backgroundImage: `url('${coverUrl}')` } : undefined}>
      <div className="dv-hero-in">
        <div className="dv-hero-top">
          <div className="dv-brand"><img src="/holu-logo-128.png" alt="HOLU" /><span>DELIVERY</span></div>
        </div>
        <h1>{rest.name}</h1>
        {rest.concept && <p style={{ margin: "0 0 12px", color: "#e7dbce", fontSize: 14 }}>{rest.concept}</p>}
        <div className="dv-hero-meta">
          <span className="dv-badge">{cfg.eta_minutes ? `⏱ ${cfg.eta_minutes} min aprox` : "⏱ Delivery"}</span>
          <span className="dv-badge">{fee ? `🛵 Envío ${money(fee)}` : "🛵 Envío gratis"}</span>
          {minOrder > 0 && <span className="dv-badge warn">Mínimo {money(minOrder)}</span>}
        </div>
      </div>
    </div>

    <div className="dv-body">
      {promos.length > 0 && (
        <div className="dv-promos">
          {promos.map((p, i) => (
            <div className="dv-promo" key={p.title || i}>
              {p.eyebrow && <b>{p.eyebrow}</b>}
              <h4>{p.title}</h4>
              {p.body && <p>{p.body}</p>}
              {p.price && <strong>{p.price}</strong>}
            </div>
          ))}
        </div>
      )}

      {menu === null && <p className="dv-empty">Cargando la carta…</p>}
      {menu !== null && menu.length === 0 && <p className="dv-empty">La carta todavía no está publicada.</p>}

      {menu !== null && menu.length > 0 && <>
        <div className="dv-cats">
          {cats.map((c) => (
            <button key={c} className={`dv-cat${cat === c ? " on" : ""}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>

        <div className="dv-grid">
          {visible.map((d) => (
            <div key={d.id} className="dv-card">
              <div className="dv-card-photo">
                {d.image_url ? <img src={d.image_url} alt="" /> : (d.name || "?")[0]}
              </div>
              <div className="dv-card-body">
                <h3>{d.name}</h3>
                {d.subtitle && <p>{d.subtitle}</p>}
                <div className="dv-card-foot">
                  <span className="dv-price">{money(d.price)}</span>
                  {cart[d.id] ? (
                    <div className="dv-qty">
                      <button onClick={() => sub(d.id)} aria-label={`Quitar ${d.name}`}>−</button>
                      <span>{cart[d.id]}</span>
                      <button onClick={() => add(d.id)} aria-label={`Agregar ${d.name}`}>+</button>
                    </div>
                  ) : (
                    <button className="dv-add" onClick={() => add(d.id)} aria-label={`Agregar ${d.name}`}>+</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </>}

      {(rest.address || rest.phone || rest.website || rest.google_review_url) && (
        <div className="dv-foot">
          {rest.address && <span>📍 {rest.address}</span>}
          {rest.phone && <span>📞 {rest.phone}</span>}
          {rest.website && <span>🌐 {rest.website}</span>}
          {rest.google_review_url && <a href={rest.google_review_url} target="_blank" rel="noreferrer">⭐ Déjanos una reseña →</a>}
        </div>
      )}
    </div>

    {count > 0 && (
      <div className="dv-bar">
        {belowMin
          ? <span>Faltan {money(minOrder - subtotal)} para el mínimo</span>
          : <>
            <span>{count} item{count > 1 ? "s" : ""} · {money(total)}</span>
            <button onClick={() => { setErr(""); setStep("datos"); }}>Continuar</button>
          </>}
      </div>
    )}
  </div>;
}

// ── Piezas compartidas ───────────────────────────────────────────────────────
const Shell = ({ children }) => <div style={S.screen}><div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, width: "100%" }}><img src="/holu-logo-128.png" alt="HOLU" style={{ height: 40, width: "auto" }} />{children}</div></div>;
const Card = ({ children, wide }) => <div style={{ ...S.card, maxWidth: wide ? 460 : 380 }}>{children}</div>;
const Line = ({ label, value, strong }) => (
  <div style={{ display: "flex", justifyContent: "space-between", margin: "7px 0", fontSize: strong ? 17 : 14, fontWeight: strong ? 900 : 400 }}>
    <span style={{ color: strong ? "#fff7ed" : "#8a7c6d" }}>{label}</span><span>{value}</span>
  </div>
);
const Field = ({ label, value, onChange, placeholder, type = "text" }) => (
  <label style={{ display: "block" }}>
    <span style={{ display: "block", color: "#8a7c6d", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</span>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={S.input} />
  </label>
);

// Loaded once, on demand: a bad or missing key just means the address field
// stays a plain text input instead of the page breaking.
let GOOGLE_MAPS_PROMISE = null;
function loadGoogleMaps() {
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error("no api key"));
  if (GOOGLE_MAPS_PROMISE) return GOOGLE_MAPS_PROMISE;
  GOOGLE_MAPS_PROMISE = new Promise((resolve, reject) => {
    if (window.google?.maps?.places) return resolve(window.google);
    const existing = document.getElementById("google-maps-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=places&language=es&region=CL`;
    script.async = true;
    script.onload = () => resolve(window.google);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return GOOGLE_MAPS_PROMISE;
}

// onPlace only fires once a suggestion is actually picked — typing alone
// never yields coordinates, which is what makes the radius check on the
// server trustworthy instead of decorative.
function AddressField({ value, onChange, onPlace, placeholder }) {
  const inputRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(() => { if (!cancelled) setReady(true); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || !inputRef.current || !window.google) return;
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "cl" },
      fields: ["formatted_address", "geometry"],
    });
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const loc = place.geometry?.location;
      if (!loc) return;
      onPlace({ address: place.formatted_address || inputRef.current.value, lat: loc.lat(), lng: loc.lng() });
    });
    return () => { window.google.maps.event.removeListener(listener); };
  }, [ready]);

  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", color: "#8a7c6d", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Dirección</span>
      <input ref={inputRef} type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={S.input} autoComplete="off" />
    </label>
  );
}

const S = {
  screen: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080705", color: "#fff7ed", padding: 20, fontFamily: "Inter,system-ui,sans-serif" },
  card: { width: "100%", background: "#15120f", border: "1px solid rgba(255,255,255,.08)", padding: 32, borderRadius: 24, textAlign: "center" },
  h2: { margin: "0 0 8px", fontSize: 23, fontWeight: 900, fontFamily: "'Playfair Display',serif" },
  muted: { color: "#8a7c6d", margin: 0, fontSize: 14, lineHeight: 1.6 },
  btnPrimary: { flex: 1, background: "linear-gradient(135deg,#d9a441,#f7d37b)", color: "#171006", border: "none", padding: "14px 20px", borderRadius: 12, fontWeight: 900, fontSize: 15, cursor: "pointer" },
  btnGhost: { flex: 1, background: "rgba(255,255,255,.05)", color: "#fff7ed", border: "1px solid rgba(255,255,255,.12)", padding: "14px 20px", borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: "pointer" },
  input: { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.05)", color: "#fff7ed", fontSize: 16, boxSizing: "border-box" },
};
