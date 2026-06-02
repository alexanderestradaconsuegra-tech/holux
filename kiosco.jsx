import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// HOLU KIOSCO — AUTOATENCIÓN EN BARRA
// ═══════════════════════════════════════════════════════════════════════════════

const getEnv = (key, fallback = "") => {
  try { if (typeof import.meta !== "undefined" && import.meta.env?.[key] != null) return String(import.meta.env[key]); } catch {}
  return fallback;
};

const N8N_BASE = getEnv("VITE_N8N_WEBHOOK_BASE", "");
const webhookUrl = (path) => {
  const base = N8N_BASE.replace(/\/+$/, "");
  return base ? `${base}/webhook/${path}` : `/webhook/${path}`;
};

const money = (n) => `$${Number(n || 0).toLocaleString("es-CL")}`;

const MENU = [
  { id: "m1", cat: "Bebidas", name: "Agua mineral", price: 2500, emoji: "💧" },
  { id: "m2", cat: "Bebidas", name: "Jugo natural", price: 4500, emoji: "🥤" },
  { id: "m3", cat: "Bebidas", name: "Cerveza artesanal", price: 6900, emoji: "🍺" },
  { id: "m4", cat: "Bebidas", name: "Vino copa", price: 7500, emoji: "🍷" },
  { id: "m5", cat: "Aperitivos", name: "Tabla de quesos", price: 12900, emoji: "🧀" },
  { id: "m6", cat: "Aperitivos", name: "Bruschetta x3", price: 8900, emoji: "🍞" },
  { id: "m7", cat: "Aperitivos", name: "Olivas marinadas", price: 5900, emoji: "🫒" },
  { id: "m8", cat: "Platos", name: "Pasta del día", price: 14900, emoji: "🍝" },
  { id: "m9", cat: "Platos", name: "Risotto hongos", price: 16900, emoji: "🍚" },
  { id: "m10", cat: "Postres", name: "Tiramisú", price: 7500, emoji: "🍮" },
  { id: "m11", cat: "Postres", name: "Panna cotta", price: 6500, emoji: "🍨" },
];

const CATS = [...new Set(MENU.map((i) => i.cat))];

export default function HoluKiosco() {
  const [cat, setCat] = useState(CATS[0]);
  const [cart, setCart] = useState({});
  const [step, setStep] = useState("menu"); // menu | confirm | sending | done | error
  const [name, setName] = useState("");

  const addItem = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const removeItem = (id) => setCart((c) => { const n = { ...c }; if (n[id] > 1) n[id]--; else delete n[id]; return n; });

  const cartItems = Object.entries(cart).map(([id, qty]) => ({ ...MENU.find((m) => m.id === id), qty }));
  const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);

  const sendOrder = async () => {
    setStep("sending");
    try {
      await fetch(webhookUrl("order-create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: "holu",
          qr_token: "BARRA",
          channel: "kiosco-barra",
          notes: name ? `Cliente: ${name}` : null,
          items: cartItems.map((i) => ({ menu_item_id: i.id, dish_name: i.name, unit_price: i.price, qty: i.qty })),
          total,
        }),
      });
      setStep("done");
    } catch {
      setStep("error");
    }
  };

  const reset = () => { setCart({}); setName(""); setStep("menu"); };

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
        <h2 style={styles.h2}>Error de conexión</h2>
        <p style={styles.muted}>No pudimos enviar el pedido. Llama a un camarero.</p>
        <button style={styles.btnPrimary} onClick={reset}>Volver</button>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "20px 0" }}>
          {cartItems.map((i) => (
            <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 16 }}>
              <span>{i.emoji} {i.name} ×{i.qty}</span>
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

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#fff", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e2130" }}>
        <span style={{ fontWeight: 900, fontSize: 22, letterSpacing: 3 }}>HOLU</span>
        <span style={{ color: "#888", fontSize: 13 }}>Kiosco · Barra</span>
        {cartCount > 0 && (
          <button style={styles.btnPrimary} onClick={() => setStep("confirm")}>
            Ver pedido ({cartCount}) · {money(total)}
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div style={{ display: "flex", gap: 8, padding: "16px 24px", overflowX: "auto" }}>
        {CATS.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            style={{ ...styles.catBtn, background: cat === c ? "#6366f1" : "#1e2130", color: cat === c ? "#fff" : "#888" }}>
            {c}
          </button>
        ))}
      </div>

      {/* Items */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, padding: "0 24px 24px" }}>
        {MENU.filter((i) => i.cat === cat).map((item) => (
          <div key={item.id} style={styles.itemCard}>
            <div style={{ fontSize: 48 }}>{item.emoji}</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{item.name}</div>
            <div style={{ color: "#6366f1", fontWeight: 900, fontSize: 17 }}>{money(item.price)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <button style={styles.qtyBtn} onClick={() => removeItem(item.id)}>−</button>
              <span style={{ minWidth: 20, textAlign: "center", fontWeight: 700 }}>{cart[item.id] || 0}</span>
              <button style={styles.qtyBtn} onClick={() => addItem(item.id)}>+</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  screen: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1117", color: "#fff" },
  card: { display: "flex", flexDirection: "column", alignItems: "center", gap: 16, background: "#1e2130", padding: 40, borderRadius: 24, textAlign: "center" },
  h2: { margin: 0, fontSize: 24, fontWeight: 900 },
  muted: { color: "#888", margin: 0, fontSize: 14 },
  btnPrimary: { background: "#6366f1", color: "#fff", border: "none", padding: "14px 28px", borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: "pointer" },
  btnGhost: { background: "#1e2130", color: "#fff", border: "1px solid #333", padding: "14px 28px", borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: "pointer" },
  catBtn: { border: "none", padding: "10px 20px", borderRadius: 20, fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" },
  itemCard: { background: "#1e2130", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" },
  qtyBtn: { width: 36, height: 36, borderRadius: 10, border: "1px solid #333", background: "#0f1117", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  input: { width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid #333", background: "#0f1117", color: "#fff", fontSize: 15, boxSizing: "border-box" },
};
