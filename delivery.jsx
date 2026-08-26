import { useState, useEffect, useMemo } from "react";

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
const SUPABASE_ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sd3JrdW1scnVkZmdzZG5oZmh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODc3NTgsImV4cCI6MjA5NDE2MzU1OH0.Bi0v-temjfU-BDFVuyJTyc_19ZRx-T_we3MfeEkcsfg");

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
              background: i <= idx ? "#6366f1" : "#1e2130", color: "#fff",
            }}>{i < idx || done ? "✓" : i + 1}</div>
            <span style={{ fontWeight: i === idx ? 800 : 500 }}>{s.label}</span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid #2a2d3d", paddingTop: 14, textAlign: "left" }}>
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
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
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
        <Field label="Dirección" value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} placeholder="Calle, número, depto" />
        <Field label="Referencias (opcional)" value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} placeholder="Portón, timbre, piso…" />
      </div>

      <div style={{ borderTop: "1px solid #2a2d3d", marginTop: 18, paddingTop: 14, textAlign: "left" }}>
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

  return <div style={{ minHeight: "100vh", background: "#0f1117", color: "#fff", paddingBottom: count ? 96 : 24 }}>
    <div style={{ padding: "20px 20px 12px", borderBottom: "1px solid #1e2130" }}>
      <div style={{ fontWeight: 900, fontSize: 22 }}>{rest.name}</div>
      <div style={{ color: "#888", fontSize: 13, marginTop: 4 }}>
        Delivery{cfg.eta_minutes ? ` · ${cfg.eta_minutes} min aprox` : ""}{fee ? ` · Envío ${money(fee)}` : " · Envío gratis"}
      </div>
      {minOrder > 0 && <div style={{ color: "#888", fontSize: 12, marginTop: 2 }}>Pedido mínimo {money(minOrder)}</div>}
    </div>

    {menu === null && <p style={{ padding: 40, color: "#888" }}>Cargando la carta…</p>}
    {menu !== null && menu.length === 0 && (
      <p style={{ padding: 40, color: "#888", textAlign: "center" }}>La carta todavía no está publicada.</p>
    )}

    {menu !== null && menu.length > 0 && <>
      <div style={{ display: "flex", gap: 8, padding: "14px 20px", overflowX: "auto" }}>
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} style={{
            ...S.chip, background: cat === c ? "#6366f1" : "#1e2130", color: cat === c ? "#fff" : "#888",
          }}>{c}</button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 12, padding: "0 20px" }}>
        {visible.map((d) => (
          <div key={d.id} style={S.dish}>
            {d.image_url
              ? <img src={d.image_url} alt="" style={S.photo} />
              : <div style={{ ...S.photo, display: "grid", placeItems: "center", fontSize: 24, fontWeight: 900, color: "#6366f1" }}>{(d.name || "?")[0]}</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{d.name}</div>
              {d.subtitle && <div style={{ color: "#888", fontSize: 12, marginTop: 3, lineHeight: 1.4 }}>{d.subtitle}</div>}
              <div style={{ color: "#6366f1", fontWeight: 900, marginTop: 6 }}>{money(d.price)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {cart[d.id] ? <>
                <button style={S.qty} onClick={() => sub(d.id)} aria-label={`Quitar ${d.name}`}>−</button>
                <span style={{ minWidth: 18, textAlign: "center", fontWeight: 800 }}>{cart[d.id]}</span>
              </> : null}
              <button style={S.qty} onClick={() => add(d.id)} aria-label={`Agregar ${d.name}`}>+</button>
            </div>
          </div>
        ))}
      </div>
    </>}

    {count > 0 && (
      <div style={S.bar}>
        {belowMin
          ? <span style={{ fontWeight: 700 }}>Faltan {money(minOrder - subtotal)} para el mínimo</span>
          : <>
            <span>{count} item{count > 1 ? "s" : ""} · {money(total)}</span>
            <button style={{ ...S.btnPrimary, width: "auto", padding: "12px 22px" }} onClick={() => { setErr(""); setStep("datos"); }}>Continuar</button>
          </>}
      </div>
    )}
  </div>;
}

// ── Piezas compartidas ───────────────────────────────────────────────────────
const Shell = ({ children }) => <div style={S.screen}>{children}</div>;
const Card = ({ children, wide }) => <div style={{ ...S.card, maxWidth: wide ? 460 : 380 }}>{children}</div>;
const Line = ({ label, value, strong }) => (
  <div style={{ display: "flex", justifyContent: "space-between", margin: "7px 0", fontSize: strong ? 17 : 14, fontWeight: strong ? 900 : 400 }}>
    <span style={{ color: strong ? "#fff" : "#888" }}>{label}</span><span>{value}</span>
  </div>
);
const Field = ({ label, value, onChange, placeholder, type = "text" }) => (
  <label style={{ display: "block" }}>
    <span style={{ display: "block", color: "#888", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</span>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={S.input} />
  </label>
);

const S = {
  screen: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1117", color: "#fff", padding: 20 },
  card: { width: "100%", background: "#1e2130", padding: 32, borderRadius: 24, textAlign: "center" },
  h2: { margin: "0 0 8px", fontSize: 23, fontWeight: 900 },
  muted: { color: "#888", margin: 0, fontSize: 14, lineHeight: 1.6 },
  btnPrimary: { flex: 1, background: "#6366f1", color: "#fff", border: "none", padding: "14px 20px", borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: "pointer" },
  btnGhost: { flex: 1, background: "#0f1117", color: "#fff", border: "1px solid #333", padding: "14px 20px", borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: "pointer" },
  chip: { border: "none", padding: "10px 18px", borderRadius: 20, fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" },
  dish: { display: "flex", gap: 12, alignItems: "center", background: "#1e2130", borderRadius: 16, padding: 12 },
  photo: { width: 64, height: 64, borderRadius: 14, objectFit: "cover", background: "#0f1117", border: "1px solid #2a2d3d", flexShrink: 0 },
  qty: { width: 40, height: 40, borderRadius: 12, border: "1px solid #333", background: "#0f1117", color: "#fff", fontSize: 20, cursor: "pointer", display: "grid", placeItems: "center" },
  bar: { position: "fixed", left: 16, right: 16, bottom: 16, maxWidth: 560, margin: "0 auto", background: "#6366f1", borderRadius: 16, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontWeight: 800, boxShadow: "0 16px 40px rgba(99,102,241,.35)" },
  input: { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #333", background: "#0f1117", color: "#fff", fontSize: 16, boxSizing: "border-box" },
};
