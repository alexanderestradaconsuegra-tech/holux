import { useState, useEffect, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// HOLU KIOSCO — AUTOATENCIÓN EN BARRA
//
// The kiosk is a fixed installation, but it identifies itself the same way a
// table does: with a QR token resolved through resolve_qr(). Create a "Barra"
// table in the panel and point the kiosk at /?qr=<su token>. That way the
// restaurant, the table id and the carta all come from the database instead of
// being compiled in, and the order travels the same order-create path as every
// order from a table.
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

const getQrToken = () => {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get("qr") || url.searchParams.get("t") || "";
  } catch { return ""; }
};

const supaHeaders = () => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
});

const supaRpc = async (fn, args) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: supaHeaders(),
    body: JSON.stringify(args || {}),
  });
  if (!res.ok) throw new Error(`rpc ${fn} ${res.status}`);
  return res.json();
};

export default function HoluKiosco() {
  const [qrToken] = useState(() => getQrToken());
  const [ctx, setCtx] = useState(null);          // null while resolving
  const [menu, setMenu] = useState(null);        // null while loading
  const [loadError, setLoadError] = useState("");
  const [cat, setCat] = useState("");
  const [cart, setCart] = useState({});
  const [step, setStep] = useState("menu");      // menu | confirm | sending | done | error
  const [name, setName] = useState("");

  // Resolve which restaurant and table this kiosk belongs to.
  useEffect(() => {
    let cancelled = false;
    if (!qrToken) { setCtx({ active: false }); return; }
    supaRpc("resolve_qr", { p_token: qrToken })
      .then((rows) => {
        if (cancelled) return;
        const row = Array.isArray(rows) ? rows[0] : rows;
        setCtx(row && row.table_id
          ? {
              active: row.active !== false,
              tableId: row.table_id,
              restaurantId: row.restaurant_id,
              restaurantName: row.restaurant_name || "",
              label: row.label || "Barra",
            }
          : { active: false });
      })
      .catch((e) => { if (!cancelled) { setLoadError(e.message); setCtx({ active: false }); } });
    return () => { cancelled = true; };
  }, [qrToken]);

  // Load that restaurant's published carta.
  useEffect(() => {
    let cancelled = false;
    if (!ctx?.active || !ctx.restaurantId) return;
    fetch(
      `${SUPABASE_URL}/rest/v1/menu_items?restaurant_id=eq.${encodeURIComponent(ctx.restaurantId)}&available=eq.true&visible_client=eq.true&select=id,name,category,price,image_url&order=sort_order.asc,name.asc`,
      { headers: supaHeaders() }
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`menu ${r.status}`))))
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setMenu(list);
        setCat((c) => c || list[0]?.category || "");
      })
      .catch((e) => { if (!cancelled) { setLoadError(e.message); setMenu([]); } });
    return () => { cancelled = true; };
  }, [ctx?.active, ctx?.restaurantId]);

  const cats = useMemo(
    () => (menu ? [...new Set(menu.map((i) => i.category).filter(Boolean))] : []),
    [menu]
  );

  const addItem = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const removeItem = (id) => setCart((c) => { const n = { ...c }; if (n[id] > 1) n[id]--; else delete n[id]; return n; });

  const cartItems = Object.entries(cart)
    .map(([id, qty]) => { const m = (menu || []).find((x) => x.id === id); return m ? { ...m, qty } : null; })
    .filter(Boolean);
  const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

  const sendOrder = async () => {
    setStep("sending");
    try {
      const res = await fetch(webhookUrl("order-create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: ctx.restaurantId,
          qr_token: qrToken,
          table_id: ctx.tableId,
          channel: "kiosco-barra",
          notes: name ? `Cliente: ${name}` : null,
          items: cartItems.map((i) => ({ menu_item_id: i.id, dish_name: i.name, unit_price: i.price, qty: i.qty })),
          total,
        }),
      });
      // A 2xx is the only thing that means the kitchen actually has the order.
      if (!res.ok) throw new Error(`order-create ${res.status}`);
      setStep("done");
    } catch {
      setStep("error");
    }
  };

  const reset = () => { setCart({}); setName(""); setStep("menu"); };

  // ── Estados de carga y configuración ──────────────────────────────────────
  if (ctx === null) return (
    <div style={styles.screen}><div style={styles.card}><div style={styles.muted}>Cargando kiosco…</div></div></div>
  );

  if (!ctx.active) return (
    <div style={styles.screen}>
      <div style={styles.card}>
        <div style={{ fontSize: 64 }}>🔌</div>
        <h2 style={styles.h2}>Kiosco sin configurar</h2>
        <p style={styles.muted}>
          {qrToken
            ? "Este código no corresponde a una mesa activa. Crea una mesa \"Barra\" en el panel y apunta el kiosco a su código QR."
            : "Falta el código de la barra en la dirección. Debe terminar en ?qr=CODIGO"}
        </p>
        {loadError && <p style={{ ...styles.muted, fontSize: 12 }}>Detalle: {loadError}</p>}
      </div>
    </div>
  );

  if (step === "done") return (
    <div style={styles.screen}>
      <div style={styles.card}>
        <div style={{ fontSize: 64 }}>✅</div>
        <h2 style={styles.h2}>¡Pedido enviado!</h2>
        <p style={styles.muted}>Tu pedido fue recibido en barra. Te avisamos cuando esté listo.</p>
        <button style={styles.btnPrimary} onClick={reset}>Nuevo pedido</button>
      </div>
    </div>
  );

  if (step === "error") return (
    <div style={styles.screen}>
      <div style={styles.card}>
        <div style={{ fontSize: 64 }}>⚠️</div>
        <h2 style={styles.h2}>No se pudo enviar</h2>
        <p style={styles.muted}>El pedido no llegó a la barra. Llama a un camarero.</p>
        <button style={styles.btnPrimary} onClick={() => setStep("confirm")}>Reintentar</button>
      </div>
    </div>
  );

  if (step === "sending") return (
    <div style={styles.screen}><div style={styles.card}><div style={styles.muted}>Enviando pedido…</div></div></div>
  );

  if (step === "confirm") return (
    <div style={styles.screen}>
      <div style={{ ...styles.card, maxWidth: 480, width: "100%" }}>
        <h2 style={styles.h2}>Confirma tu pedido</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "20px 0", width: "100%" }}>
          {cartItems.map((i) => (
            <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 16 }}>
              <span>{i.name} ×{i.qty}</span>
              <span style={{ fontWeight: 700 }}>{money(i.price * i.qty)}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #333", paddingTop: 10, display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 18 }}>
            <span>Total</span><span>{money(total)}</span>
          </div>
        </div>
        <input
          placeholder="Tu nombre (opcional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
        />
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button style={styles.btnGhost} onClick={() => setStep("menu")}>Volver</button>
          <button style={styles.btnPrimary} onClick={sendOrder}>Confirmar pedido</button>
        </div>
      </div>
    </div>
  );

  const visible = (menu || []).filter((i) => i.category === cat);

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#fff", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, borderBottom: "1px solid #1e2130" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/holu-logo-128.png" alt="HOLU" style={{ height: 30, width: "auto" }} />
          <span style={{ fontWeight: 900, fontSize: 22, letterSpacing: 3 }}>{ctx.restaurantName || "HOLU"}</span>
        </div>
        <span style={{ color: "#888", fontSize: 13 }}>Kiosco · {ctx.label}</span>
        {cartCount > 0 && (
          <button style={styles.btnPrimary} onClick={() => setStep("confirm")}>
            Ver pedido ({cartCount}) · {money(total)}
          </button>
        )}
      </div>

      {menu === null && <div style={{ padding: 40, color: "#888" }}>Cargando carta…</div>}

      {menu !== null && menu.length === 0 && (
        <div style={{ padding: 40, color: "#888", textAlign: "center" }}>
          La carta todavía no está publicada. Pide en barra y con gusto te atendemos.
        </div>
      )}

      {menu !== null && menu.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 8, padding: "16px 24px", overflowX: "auto" }}>
            {cats.map((c) => (
              <button key={c} onClick={() => setCat(c)}
                style={{ ...styles.catBtn, background: cat === c ? "#6366f1" : "#1e2130", color: cat === c ? "#fff" : "#888" }}>
                {c}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, padding: "0 24px 24px" }}>
            {visible.map((item) => (
              <div key={item.id} style={styles.itemCard}>
                {item.image_url
                  ? <img src={item.image_url} alt="" style={styles.itemPhoto} />
                  : <div style={{ ...styles.itemPhoto, display: "grid", placeItems: "center", fontSize: 26, fontWeight: 900, color: "#6366f1" }}>{(item.name || "?")[0].toUpperCase()}</div>}
                <div style={{ fontWeight: 700, fontSize: 15 }}>{item.name}</div>
                <div style={{ color: "#6366f1", fontWeight: 900, fontSize: 17 }}>{money(item.price)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                  <button style={styles.qtyBtn} onClick={() => removeItem(item.id)} aria-label={`Quitar ${item.name}`}>−</button>
                  <span style={{ minWidth: 20, textAlign: "center", fontWeight: 700 }}>{cart[item.id] || 0}</span>
                  <button style={styles.qtyBtn} onClick={() => addItem(item.id)} aria-label={`Agregar ${item.name}`}>+</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  screen: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1117", color: "#fff", padding: 20 },
  card: { display: "flex", flexDirection: "column", alignItems: "center", gap: 16, background: "#1e2130", padding: 40, borderRadius: 24, textAlign: "center", maxWidth: 460 },
  h2: { margin: 0, fontSize: 24, fontWeight: 900 },
  muted: { color: "#888", margin: 0, fontSize: 14, lineHeight: 1.6 },
  btnPrimary: { background: "#6366f1", color: "#fff", border: "none", padding: "14px 28px", borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: "pointer" },
  btnGhost: { background: "#1e2130", color: "#fff", border: "1px solid #333", padding: "14px 28px", borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: "pointer" },
  catBtn: { border: "none", padding: "10px 20px", borderRadius: 20, fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" },
  itemCard: { background: "#1e2130", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" },
  itemPhoto: { width: 72, height: 72, borderRadius: 16, objectFit: "cover", background: "#0f1117", border: "1px solid #333" },
  qtyBtn: { width: 44, height: 44, borderRadius: 10, border: "1px solid #333", background: "#0f1117", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  input: { width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid #333", background: "#0f1117", color: "#fff", fontSize: 15, boxSizing: "border-box" },
};
