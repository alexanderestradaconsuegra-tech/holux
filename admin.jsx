import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

// ═══════════════════════════════════════════════════════════════════════════════
// HOLU ADMIN — ADMIN + CAMARERO
// Producción: admin -> n8n -> Supabase
// ═══════════════════════════════════════════════════════════════════════════════

const getEnv = (key, fallback = "") => {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key] != null) return String(import.meta.env[key]);
  } catch {}
  try {
    if (typeof process !== "undefined" && process.env && process.env[key] != null) return String(process.env[key]);
  } catch {}
  try {
    if (typeof window !== "undefined" && window.__ENV__ && window.__ENV__[key] != null) return String(window.__ENV__[key]);
  } catch {}
  return fallback;
};

const N8N_WEBHOOK_BASE = getEnv("VITE_N8N_WEBHOOK_BASE", getEnv("N8N_WEBHOOK_BASE", "https://n8n-n8n.fa2cjf.easypanel.host"));
const buildWebhookUrl = (path) => {
  const base = String(N8N_WEBHOOK_BASE || "").replace(/\/+$/, "");
  const clean = String(path || "").replace(/^\/+/, "");
  return base ? `${base}/webhook/${clean}` : `/webhook/${clean}`;
};

const SUPABASE_URL = getEnv("VITE_SUPABASE_URL", "https://nlwrkumlrudfgsdnhfhw.supabase.co");
const SUPABASE_ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sd3JrdW1scnVkZmdzZG5oZmh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODc1NTgsImV4cCI6MjA5NDE2MzU1OH0.Bi0v-temjfU-BDFVuyJTyc_19ZRx-T_we3MfeEkcsfg");
const MESA_URL = getEnv("VITE_MESA_URL", "").replace(/\/+$/, "");

// ── Tenant ────────────────────────────────────────────────────────────────────
// Each restaurant gets its own admin deployment with VITE_RESTAURANT_ID set.
// After an admin signs in, the restaurant_id in their JWT overrides this and is
// the authoritative value (RLS enforces it server-side either way).
const DEFAULT_RESTAURANT_ID = getEnv("VITE_RESTAURANT_ID", "holu");
let CURRENT_RESTAURANT_ID = DEFAULT_RESTAURANT_ID;
try {
  const stored = sessionStorage.getItem("holu:restaurant");
  if (stored) CURRENT_RESTAURANT_ID = stored;
} catch {}
const getRestaurantId = () => CURRENT_RESTAURANT_ID;
const setRestaurantId = (id) => {
  if (!id) return;
  CURRENT_RESTAURANT_ID = id;
  try { sessionStorage.setItem("holu:restaurant", id); } catch {}
};

const supaRpc = (fn, args, token = null) =>
  supaFetch(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args || {}) }, token);

// Employee PIN login. The staff-login edge function checks the PIN with the
// service role and hands back a real Supabase session, so employees stop
// operating on the anon key and the per-restaurant RLS policies apply to them.
// Until that function is deployed we fall back to the staff_login RPC, which
// still keeps pin_hash inside the database but leaves the caller anonymous.
const staffPinLogin = async (restaurantId, pin) => {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/staff-login`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ restaurant_id: restaurantId, pin }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.staff?.id) return { staff: data.staff, session: data.session || null };
      return null;
    }
    if (res.status === 401) return null;
    if (res.status === 429) throw new Error("too_many_attempts");
    // 404/5xx: function not deployed yet or failing — fall through to the RPC.
    console.warn("[holu auth] staff-login unavailable:", res.status);
  } catch (e) {
    if (e.message === "too_many_attempts") throw e;
    console.warn("[holu auth] staff-login error:", e.message);
  }

  const rows = await supaRpc("staff_login", { p_restaurant_id: restaurantId, p_pin: pin }, null);
  const found = Array.isArray(rows) ? rows[0] : rows;
  return found?.id ? { staff: found, session: null } : null;
};

const supaFetch = (path, opts = {}, authToken = null) => {
  const token = authToken || SUPABASE_ANON_KEY;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: opts.prefer || "return=representation",
  };
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...opts, headers }).then((r) => {
    if (!r.ok) return r.text().then((t) => Promise.reject(new Error(`Supabase ${r.status}: ${t.slice(0, 120)}`)));
    const ct = r.headers.get("content-type") || "";
    if (r.status === 204 || !ct.includes("json")) return null;
    return r.json();
  });
};

const supaGet = (path, token = null) => supaFetch(path, {}, token);
const supaPatch = (path, body, token = null) =>
  supaFetch(path, { method: "PATCH", body: JSON.stringify(body) }, token);
const supaPost = (path, body, token = null) =>
  supaFetch(path, { method: "POST", body: JSON.stringify(body) }, token);
const supaDelete = (path, token = null) =>
  supaFetch(path, { method: "DELETE" }, token);

const supaUploadImage = async (file, token) => {
  const ext = file.name.split(".").pop().toLowerCase();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/menu-images/${name}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Upload failed: ${t.slice(0, 100)}`); }
  return `${SUPABASE_URL}/storage/v1/object/public/menu-images/${name}`;
};

const supaSignIn = async (email, password) => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.message || "Credenciales incorrectas");
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    restaurant_id: data.user?.user_metadata?.restaurant_id || null,
    email: data.user?.email,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };
};

const STATUS_UI = { received: "Recibido", prep: "Preparando", preparing: "Preparando", plating: "Listo para servir", ready: "Listo para servir", served: "Servido", pending: "Pendiente" };
const STATUS_DB = { "Recibido": "received", "Preparando": "prep", "Listo para servir": "plating", "Servido": "served" };

const timeAgo = (iso) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return diff < 1 ? "Ahora" : diff === 1 ? "1 min" : `${diff} min`;
};

const dbOrderToUI = (o) => ({
  id: o.id,
  table: o.table_id,
  waiterId: o.waiter_id || "w1",
  status: STATUS_UI[o.status] || o.status || "Recibido",
  priority: o.priority || "Normal",
  eta: o.eta_minutes || o.eta || 0,
  channel: o.channel || "QR Mesa",
  items: (o.order_items || []).map((i) => ({
    dish: i.dish_name,
    qty: i.qty,
    status: STATUS_UI[i.status] || i.status || "Recibido",
    price: i.unit_price,
  })),
  notes: o.notes || "",
});

const dbCallToUI = (c) => ({
  id: c.id,
  source: c.call_type === "Confirmar plato" ? "cocina" : "mesa",
  table: c.table_id,
  waiterId: c.waiter_id || "w1",
  type: c.call_type || "Llamado",
  priority: c.priority || "Normal",
  status: c.status || "Pendiente",
  age: c.created_at ? timeAgo(c.created_at) : "Ahora",
  text: c.message || "",
});

const dbTableToUI = (t) => ({
  id: t.id,
  zone: t.zone || "",
  status: t.status || "Libre",
  guests: t.guests || 0,
  waiterId: t.waiter_id || null,
  bill: t.bill_total || 0,
  tipAccepted: t.tip_accepted || false,
  tipAmount: t.tip_amount || 0,
  qrToken: t.qr_token || "",
  tableNumber: t.table_number,
  label: t.label || `Mesa ${t.table_number}`,
  lastMessage: "",
});

const dbMenuItemToUI = (m) => ({
  id: m.id,
  dish: m.name,
  category: m.category,
  description: m.subtitle || m.description || "",
  price: m.price,
  avgPrep: m.avg_prep_minutes || 15,
  stock: m.stock_status || "OK",
  available: m.available !== false,
  visibleClient: m.visible_client !== false,
  tags: (m.tags || []).join(","),
  imageUrl: m.image_url || "",
  allergens: m.allergens || [],
  sortOrder: m.sort_order || 0,
});

const money = (n) => `$${Number(n || 0).toLocaleString("es-CL")}`;

const RESTAURANT = {
  name: "HOLU",
  legalName: "HOLU SpA",
  rut: "76.543.210-9",
  address: "Av. Italia 1450, Providencia, Santiago",
  phone: "+56 2 2345 6789",
  website: "holu.cl",
  location: "Santiago · Salón Principal",
  service: "Cena",
};

const RECEIPT_CONFIG = {
  title: "BOLETA ELECTRÓNICA",
  footer: "Gracias por visitar HOLU · Vuelve pronto",
  taxLabel: "IVA incluido",
  showWaiter: true,
  showQr: true,
  printer: "Epson TM-T20III · 80mm",
  printerIp: "192.168.1.44",
  paperWidth: "80mm",
  printMode: "Ticket térmico nítido",
};

const STAFF = [
  { id: "w1", name: "Marco", pin: "1111", role: "camarero", shift: "18:00–00:00", status: "Activo", tables: [2, 7, 8], avatar: "M", photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&auto=format&fit=crop", phone: "+56 9 1111 2222", email: "marco@holu.cl" },
  { id: "w2", name: "Isabella", pin: "2222", role: "camarero", shift: "18:00–00:00", status: "Activo", tables: [3, 4, 9], avatar: "I", photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&auto=format&fit=crop", phone: "+56 9 3333 4444", email: "isabella@holu.cl" },
  { id: "w3", name: "Tomás", pin: "3333", role: "camarero", shift: "19:00–01:00", status: "Pausa", tables: [5], avatar: "T", photoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=600&auto=format&fit=crop", phone: "+56 9 5555 6666", email: "tomas@holu.cl" },
  { id: "a1", name: "Valentina", pin: "0000", role: "admin", shift: "Full", status: "Activo", tables: [], avatar: "V", photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop", phone: "+56 9 7777 8888", email: "valentina@holu.cl" },
  { id: "k1", name: "Cocina", pin: "5555", role: "cocina", shift: "Full", status: "Activo", tables: [], avatar: "K", photoUrl: "", phone: "", email: "" },
];

const TABLES = [
  { id: 1, zone: "Terraza", status: "Libre", guests: 0, waiterId: null, bill: 0, tipAccepted: false, tipAmount: 0, qrToken: "T1K90", lastMessage: "" },
  { id: 2, zone: "Salón", status: "Comiendo", guests: 2, waiterId: "w1", bill: 53400, tipAccepted: true, tipAmount: 5340, qrToken: "B2M18", lastMessage: "¿Nos traen más pan?" },
  { id: 3, zone: "Salón", status: "Esperando plato", guests: 4, waiterId: "w2", bill: 98200, tipAccepted: false, tipAmount: 0, qrToken: "K3N70", lastMessage: "Uno sin cebolla por favor." },
  { id: 4, zone: "Terraza", status: "Pedido nuevo", guests: 2, waiterId: "w2", bill: 28600, tipAccepted: true, tipAmount: 2860, qrToken: "L4P22", lastMessage: "Pedimos dos Spritz." },
  { id: 5, zone: "Bar", status: "Camarero ocupado", guests: 1, waiterId: "w3", bill: 14300, tipAccepted: false, tipAmount: 0, qrToken: "R5Q10", lastMessage: "Necesito ayuda con alergia." },
  { id: 7, zone: "Salón", status: "Solicita cobro", guests: 3, waiterId: "w1", bill: 84900, tipAccepted: false, tipAmount: 0, qrToken: "A7K92", lastMessage: "Queremos pedir la cuenta." },
  { id: 8, zone: "Salón", status: "Preparando", guests: 2, waiterId: "w1", bill: 62100, tipAccepted: true, tipAmount: 6210, qrToken: "H8Z55", lastMessage: "¿Cuánto falta para el plato?" },
  { id: 9, zone: "VIP", status: "Cocina llama", guests: 5, waiterId: "w2", bill: 156800, tipAccepted: true, tipAmount: 15680, qrToken: "VIP09", lastMessage: "El chef pregunta término de carne." },
];

// Empty till. The real shift, if one is open, is loaded from cash_sessions.
const CASH_SESSION_INITIAL = {
  id: null,
  status: "cerrada",
  openedAt: "—",
  closedAt: null,
  openedBy: null,
  currentUser: null,
  activeTurn: "Noche",
  openingCash: 0,
  cash: 0,
  card: 0,
  transfer: 0,
  tips: 0,
  expenses: 0,
  expected: 0,
  counted: 0,
  difference: 0,
  history: [],
};

const KITCHEN_COLUMNS = {
  received: "Recibido",
  preparing: "Preparando",
  ready: "Listo para servir",
  delivered: "Servido",
};

const SALES_PERIODS = {
  day: { label: "Día", sales: 497400, tips: 29150, tickets: 18, avgTicket: 27633 },
  month: { label: "Mes", sales: 14892400, tips: 1287400, tickets: 522, avgTicket: 28529 },
  year: { label: "Año", sales: 174881000, tips: 14932000, tickets: 6240, avgTicket: 28025 },
};

const ORDERS = [
  { id: "ORD-1047", table: 7, waiterId: "w1", status: "Preparando", priority: "Normal", eta: 9, channel: "QR Mesa", items: [
    { dish: "Tagliatelle al Ragù", qty: 1, status: "Preparando", price: 21500 },
    { dish: "Spritz Aperol", qty: 2, status: "Servido", price: 9800 },
  ], notes: "Cliente solicita cuenta al finalizar." },
  { id: "ORD-1048", table: 2, waiterId: "w1", status: "Listo para servir", priority: "Alta", eta: 0, channel: "QR Mesa", items: [
    { dish: "Burrata di Bufala", qty: 1, status: "Listo", price: 14500 },
    { dish: "Branzino al Forno", qty: 1, status: "Listo", price: 28900 },
  ], notes: "Llevar pan adicional." },
  { id: "ORD-1049", table: 9, waiterId: "w2", status: "Cocina requiere info", priority: "Alta", eta: 12, channel: "Cocina", items: [
    { dish: "Osso Buco Milanese", qty: 2, status: "En espera", price: 32500 },
    { dish: "Tiramisù Classico", qty: 1, status: "Pendiente", price: 9500 },
  ], notes: "Confirmar término y alergia a lácteos." },
  { id: "ORD-1050", table: 3, waiterId: "w2", status: "Recibido", priority: "Normal", eta: 18, channel: "QR Mesa", items: [
    { dish: "Risotto ai Funghi", qty: 2, status: "Recibido", price: 19800 },
    { dish: "San Pellegrino", qty: 1, status: "Pendiente", price: 4500 },
  ], notes: "Uno sin cebolla." },
];

const CALLS = [
  { id: "C-001", source: "mesa", table: 7, waiterId: "w1", type: "Solicita cobro", priority: "Alta", status: "Pendiente", age: "Ahora", text: "Queremos pedir la cuenta." },
  { id: "C-002", source: "mesa", table: 5, waiterId: "w3", type: "Alergia", priority: "Crítica", status: "Pendiente", age: "1 min", text: "Necesito ayuda con alergia." },
  { id: "C-003", source: "cocina", table: 9, waiterId: "w2", type: "Confirmar plato", priority: "Alta", status: "Pendiente", age: "2 min", text: "El chef necesita confirmar término de carne." },
  { id: "C-004", source: "mesa", table: 2, waiterId: "w1", type: "Más pan", priority: "Normal", status: "En atención", age: "5 min", text: "¿Nos traen más pan?" },
];

const CLIENT_MESSAGES = [
  { id: 1, table: 7, waiterId: "w1", from: "Cliente", type: "Cobro", text: "Queremos pedir la cuenta.", time: "20:43", status: "pendiente" },
  { id: 2, table: 5, waiterId: "w3", from: "Cliente", type: "Alergia", text: "Necesito ayuda con alergia, soy intolerante a lácteos.", time: "20:42", status: "urgente" },
  { id: 3, table: 8, waiterId: "w1", from: "Cliente", type: "Pedido", text: "¿Cuánto falta para el plato principal?", time: "20:39", status: "pendiente" },
  { id: 4, table: 3, waiterId: "w2", from: "Cliente", type: "Nota cocina", text: "Uno de los risottos sin cebolla por favor.", time: "20:31", status: "resuelto" },
];

const MENU_ITEMS = [
  { id: "tagliatelle", dish: "Tagliatelle al Ragù", category: "Principales", description: "Pasta fresca · ternera 6h · parmesano", price: 21500, avgPrep: 18, stock: "OK", available: true, visibleClient: true, tags: "TOP", imageUrl: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?q=80&w=900&auto=format&fit=crop" },
  { id: "spritz", dish: "Spritz Aperol", category: "Bebidas", description: "Aperol · Prosecco · soda", price: 9800, avgPrep: 5, stock: "OK", available: true, visibleClient: true, tags: "2×1", imageUrl: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?q=80&w=900&auto=format&fit=crop" },
  { id: "ossobuco", dish: "Osso Buco Milanese", category: "Principales", description: "Jarrete · gremolata · risotto", price: 32500, avgPrep: 32, stock: "Bajo", available: true, visibleClient: true, tags: "CHEF", imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=900&auto=format&fit=crop" },
  { id: "branzino", dish: "Branzino al Forno", category: "Principales", description: "Lubina · limone · olive", price: 28900, avgPrep: 25, stock: "OK", available: true, visibleClient: true, tags: "Sin gluten", imageUrl: "https://images.unsplash.com/photo-1535400255456-984241443b29?q=80&w=900&auto=format&fit=crop" },
  { id: "burrata", dish: "Burrata di Bufala", category: "Entradas", description: "Tomate heirloom · albahaca · AOVE", price: 14500, avgPrep: 8, stock: "OK", available: true, visibleClient: true, tags: "TOP,Veg", imageUrl: "https://images.unsplash.com/photo-1608897013039-887f21d8c804?q=80&w=900&auto=format&fit=crop" },
  { id: "tiramisu", dish: "Tiramisù Classico", category: "Postres", description: "Mascarpone · espresso", price: 9500, avgPrep: 7, stock: "OK", available: true, visibleClient: true, tags: "TOP", imageUrl: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?q=80&w=900&auto=format&fit=crop" },
];

const MENU_SALES = [
  { id: "tagliatelle", dish: "Tagliatelle al Ragù", category: "Principales", sold: 34, revenue: 731000, avgPrep: 18, stock: "OK" },
  { id: "spritz", dish: "Spritz Aperol", category: "Bebidas", sold: 61, revenue: 597800, avgPrep: 5, stock: "OK" },
  { id: "ossobuco", dish: "Osso Buco Milanese", category: "Principales", sold: 18, revenue: 585000, avgPrep: 32, stock: "Bajo" },
  { id: "branzino", dish: "Branzino al Forno", category: "Principales", sold: 13, revenue: 375700, avgPrep: 25, stock: "OK" },
  { id: "burrata", dish: "Burrata di Bufala", category: "Entradas", sold: 22, revenue: 319000, avgPrep: 8, stock: "OK" },
  { id: "tiramisu", dish: "Tiramisù Classico", category: "Postres", sold: 25, revenue: 237500, avgPrep: 7, stock: "OK" },
];

const RECEIPT_ITEMS = [
  { name: "Tagliatelle al Ragù", qty: 1, price: 21500 },
  { name: "Spritz Aperol", qty: 2, price: 9800 },
  { name: "Tiramisù Classico", qty: 1, price: 9500 },
];

const INVENTORY_ITEMS = [
  { id: "inv-1", name: "Pasta fresca", category: "Ingrediente", stock: 18, unit: "kg", min: 8, linkedDishes: ["Tagliatelle al Ragù"], status: "OK" },
  { id: "inv-2", name: "Jarrete de ternera", category: "Carne", stock: 4, unit: "kg", min: 6, linkedDishes: ["Osso Buco Milanese"], status: "Bajo" },
  { id: "inv-3", name: "Aperol", category: "Bar", stock: 11, unit: "botellas", min: 4, linkedDishes: ["Spritz Aperol"], status: "OK" },
  { id: "inv-4", name: "Mascarpone", category: "Postre", stock: 2, unit: "kg", min: 3, linkedDishes: ["Tiramisù Classico"], status: "Bajo" },
];

const QR_TOKENS = [
  { table: 1, token: "T1K90", zone: "Terraza", active: true, scans: 12, lastScan: "19:15" },
  { table: 2, token: "B2M18", zone: "Salón", active: true, scans: 31, lastScan: "20:28" },
  { table: 7, token: "A7K92", zone: "Salón", active: true, scans: 44, lastScan: "20:43" },
  { table: 9, token: "VIP09", zone: "VIP", active: true, scans: 18, lastScan: "20:35" },
];

const EXPENSES = [
  { id: "E-1", type: "Caja", detail: "Compra hielo", amount: 12000, userId: "a1", time: "19:22" },
  { id: "E-2", type: "Proveedor", detail: "Reposición pan", amount: 30000, userId: "a1", time: "20:05" },
];

const LOCAL_WEBHOOKS = {
  orderCreate: buildWebhookUrl("order-create"),
  camareroCall: buildWebhookUrl("camarero-call"),
  kitchenCall: buildWebhookUrl("kitchen-call"),
  billRequest: buildWebhookUrl("bill-request"),
  receiptPrint: buildWebhookUrl("receipt-print"),
  feedback: buildWebhookUrl("feedback"),
  cashClose: buildWebhookUrl("cash-close"),
};

const PERMISSIONS = [
  { module: "Mesas", admin: true, camarero: true, cocina: false, caja: true },
  { module: "Pedidos", admin: true, camarero: true, cocina: true, caja: false },
  { module: "Ventas", admin: true, camarero: false, cocina: false, caja: true },
  { module: "Carta", admin: true, camarero: false, cocina: false, caja: false },
  { module: "Inventario", admin: true, camarero: false, cocina: true, caja: false },
  { module: "Caja", admin: true, camarero: false, cocina: false, caja: true },
  { module: "Usuarios", admin: true, camarero: false, cocina: false, caja: false },
];

const REVIEWS = [
  { id: "R-1", table: 7, waiterId: "w1", rating: 5, comment: "Excelente atención y platos rápidos.", google: true, time: "20:20" },
  { id: "R-2", table: 2, waiterId: "w1", rating: 3, comment: "La bebida tardó un poco.", google: false, time: "19:58" },
  { id: "R-3", table: 9, waiterId: "w2", rating: 4, comment: "Muy buena comida, faltó explicar mejor el maridaje.", google: true, time: "19:44" },
];

const icons = {
  dashboard: <svg viewBox="0 0 24 24"><path d="M4 13h7V4H4Zm9 7h7V4h-7ZM4 20h7v-5H4Z" /></svg>,
  table: <svg viewBox="0 0 24 24"><path d="M4 10h16M6 10v10M18 10v10M8 4h8l2 6H6Z" /></svg>,
  order: <svg viewBox="0 0 24 24"><path d="M7 4h10l1 18-6-3-6 3Z" /></svg>,
  bell: <svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10 21h4" /></svg>,
  kitchen: <svg viewBox="0 0 24 24"><path d="M6 14h12v7H6zM7 14c-2-1-3-3-2-5 1-2 3-2 4-1 1-3 6-3 7 0 2-1 4 0 5 2 1 3-2 5-4 4" /></svg>,
  chat: <svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></svg>,
  sales: <svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h18M8 16V9M13 16V4M18 16v-6" /></svg>,
  users: <svg viewBox="0 0 24 24"><path d="M16 21a6 6 0 0 0-12 0M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21a6 6 0 0 0-5-5.9M17 3.3a4 4 0 0 1 0 7.4" /></svg>,
  menu: <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>,
  star: <svg viewBox="0 0 24 24"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21 7 14.2 2 9.3l6.9-1Z" /></svg>,
  settings: <svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" /><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2 3.5-.2-.1a1.8 1.8 0 0 0-2.1.2 1.8 1.8 0 0 0-.6 1.9H9a1.8 1.8 0 0 0-.6-1.9 1.8 1.8 0 0 0-2.1-.2l-.2.1-2-3.5.1-.1a1.8 1.8 0 0 0 .4-2A1.8 1.8 0 0 0 3 13.5v-4A1.8 1.8 0 0 0 4.6 8a1.8 1.8 0 0 0-.4-2l-.1-.1 2-3.5.2.1a1.8 1.8 0 0 0 2.1-.2A1.8 1.8 0 0 0 9 .4h6a1.8 1.8 0 0 0 .6 1.9 1.8 1.8 0 0 0 2.1.2l.2-.1 2 3.5-.1.1a1.8 1.8 0 0 0-.4 2A1.8 1.8 0 0 0 21 9.5v4a1.8 1.8 0 0 0-1.6 1.5Z" /></svg>,
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700;800;900&display=swap');
:root{--bg:#070604;--panel:#14110e;--panel2:#1f1a15;--card:#18130f;--line:rgba(255,255,255,.09);--text:#fff7ed;--muted:#bcae9f;--dim:#7d7064;--gold:#d9a441;--gold2:#f7d37b;--red:#ef4444;--red2:#fca5a5;--green:#34d399;--blue:#60a5fa;--purple:#a78bfa;--shadow:0 24px 80px rgba(0,0,0,.45)}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 10% 0,rgba(217,164,65,.22),transparent 28%),radial-gradient(circle at 110% 20%,rgba(96,165,250,.12),transparent 34%),#050403;color:var(--text);font-family:Inter,system-ui,sans-serif}.app{min-height:100dvh;display:grid;grid-template-columns:286px 1fr;background:linear-gradient(180deg,rgba(255,255,255,.02),transparent)}svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.sidebar{position:sticky;top:0;height:100dvh;padding:18px;border-right:1px solid var(--line);background:rgba(10,8,6,.86);backdrop-filter:blur(22px);display:flex;flex-direction:column}.brand{font-family:'Playfair Display',serif;letter-spacing:.14em;color:var(--gold2);font-size:31px;line-height:.9}.brand small{display:block;font-family:Inter;font-size:10px;letter-spacing:.2em;color:var(--muted);margin-top:8px}.role-card{margin:18px 0;padding:14px;border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025));border:1px solid var(--line)}.role-switch{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.role-switch button,.nav button,.chip,.btn{border:0;cursor:pointer}.role-switch button{border-radius:14px;padding:11px 8px;background:rgba(255,255,255,.06);color:var(--muted);font-weight:900}.role-switch .on,.tab .on{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#171006}.nav{display:grid;gap:7px;margin-top:8px}.nav button{display:flex;align-items:center;gap:11px;text-align:left;border-radius:16px;padding:13px 12px;background:transparent;color:var(--muted);font-weight:800}.nav button.on{background:rgba(247,211,123,.12);color:var(--gold2)}.nav button.locked{opacity:.35;cursor:not-allowed}.side-footer{margin-top:auto;color:var(--dim);font-size:12px;line-height:1.5}.main{padding:22px;min-width:0}.topbar{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:18px}.title h1{font-family:'Playfair Display',serif;font-size:42px;line-height:.96;margin:0;letter-spacing:-.05em}.title p{margin:8px 0 0;color:var(--muted)}.operator{display:flex;gap:10px;align-items:center;padding:11px 13px;border-radius:18px;border:1px solid var(--line);background:rgba(255,255,255,.045)}.avatar{width:42px;height:42px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,var(--gold),var(--gold2));color:#171006;font-weight:900;object-fit:cover}.avatar.img{background:#111;border:1px solid var(--line)}.staff-photo{width:76px;height:76px;border-radius:22px;object-fit:cover;border:1px solid var(--line);box-shadow:0 12px 28px rgba(0,0,0,.28)}.select{background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--text);border-radius:14px;padding:10px;outline:none}.input,.textarea{width:100%;background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--text);border-radius:14px;padding:12px;outline:none;font:inherit}.textarea{min-height:82px;resize:vertical}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.field label{display:block;color:var(--muted);font-size:12px;font-weight:800;margin-bottom:6px}.modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.62);display:grid;place-items:center;z-index:80;padding:18px}.modal{width:min(760px,100%);max-height:90dvh;overflow:auto;border-radius:26px;background:#100d0a;border:1px solid var(--line);box-shadow:var(--shadow);padding:18px}.preview-phone{border-radius:24px;border:1px solid var(--line);background:rgba(255,255,255,.035);padding:14px}.client-dish{border-radius:18px;background:rgba(255,255,255,.055);border:1px solid var(--line);padding:12px;margin-bottom:8px}.dish-thumb{width:74px;height:74px;border-radius:16px;object-fit:cover;background:rgba(255,255,255,.08);border:1px solid var(--line);flex-shrink:0}.dish-thumb.big{width:100%;height:180px;border-radius:20px;margin-bottom:12px}.image-upload{border:1px dashed rgba(247,211,123,.35);border-radius:18px;padding:14px;background:rgba(247,211,123,.05);display:grid;gap:10px}.image-actions{display:flex;gap:8px;flex-wrap:wrap}.client-dish h4{margin:0 0 4px}.client-dish p{margin:0;color:var(--muted);font-size:12px}.toggle{display:inline-flex;align-items:center;gap:8px;color:var(--muted);font-weight:800}.toggle input{accent-color:#d9a441}.grid{display:grid;gap:14px}.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.kpi,.panel,.table-card,.message-card{border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025));border:1px solid var(--line);box-shadow:var(--shadow)}.kpi{padding:16px;min-height:112px}.kpi span{color:var(--muted);font-size:12px;font-weight:700}.kpi strong{display:block;font-size:30px;margin:8px 0 4px}.kpi small{color:var(--dim)}.two{display:grid;grid-template-columns:1.1fr .9fr;gap:14px}.three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.panel{padding:16px;min-width:0}.panel-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px}.panel h2{font-family:'Playfair Display',serif;font-size:27px;margin:0;letter-spacing:-.04em}.panel p{color:var(--muted)}.list{display:grid;gap:10px}.row{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:13px;border-radius:17px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.065)}.row-main b{display:block}.row-main small{display:block;color:var(--muted);margin-top:4px;line-height:1.35}.badge{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:900;background:rgba(247,211,123,.12);color:var(--gold2);white-space:nowrap}.badge.red{background:rgba(239,68,68,.12);color:var(--red2)}.badge.green{background:rgba(52,211,153,.12);color:var(--green)}.badge.blue{background:rgba(96,165,250,.12);color:#93c5fd}.badge.purple{background:rgba(167,139,250,.12);color:#c4b5fd}.btn{border-radius:14px;padding:11px 13px;font-weight:900}.btn.primary{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#171006}.btn.ghost{background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--text)}.btn.danger{background:rgba(239,68,68,.16);color:var(--red2);border:1px solid rgba(239,68,68,.24)}.tab{display:flex;gap:8px;overflow:auto;margin-bottom:14px}.tab button{white-space:nowrap;border:1px solid var(--line);background:rgba(255,255,255,.045);color:var(--muted);border-radius:999px;padding:10px 13px;font-weight:900}.table-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.table-card{padding:14px;min-height:158px}.table-card h3{margin:0;font-size:20px}.table-card .meta{display:flex;justify-content:space-between;align-items:center;margin-top:10px;color:var(--muted);font-size:12px}.table-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}.progress{height:8px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin:9px 0}.progress span{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:999px}.dish-lines{display:grid;gap:7px;margin-top:10px}.dish-line{display:flex;justify-content:space-between;gap:10px;font-size:13px;color:var(--muted)}.chart{display:grid;gap:10px}.bar{display:grid;grid-template-columns:160px 1fr 90px;gap:10px;align-items:center}.bar-track{height:11px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}.bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--gold),var(--gold2))}.message-card{padding:14px}.message-card.urgent{border-color:rgba(239,68,68,.35);background:linear-gradient(145deg,rgba(239,68,68,.10),rgba(255,255,255,.025))}.message-top{display:flex;justify-content:space-between;gap:10px}.message-card blockquote{margin:10px 0 0;color:#eadfd4;line-height:1.45;border-left:3px solid var(--gold);padding-left:10px}.timeline{display:grid;gap:12px}.timeline-item{display:grid;grid-template-columns:20px 1fr;gap:12px}.dot{width:12px;height:12px;border-radius:50%;background:var(--gold2);margin-top:5px;box-shadow:0 0 0 5px rgba(247,211,123,.1)}.audit{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#cbd5e1;font-size:12px;background:rgba(0,0,0,.22);border-radius:16px;padding:14px;overflow:auto}.receipt-wrap{display:grid;place-items:center}.receipt{width:320px;background:#fff;color:#111;border-radius:10px;padding:18px 18px 24px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:0 26px 70px rgba(0,0,0,.42)}.receipt h3{font-family:Inter,system-ui,sans-serif;text-align:center;margin:0;font-size:22px;letter-spacing:.12em}.receipt .center{text-align:center}.receipt .muted2{color:#555;font-size:11px}.receipt .dash{border-top:1px dashed #111;margin:12px 0}.receipt-row{display:flex;justify-content:space-between;gap:8px;font-size:12px;margin:7px 0}.receipt-total{font-size:16px;font-weight:900}.receipt-qr{width:78px;height:78px;margin:12px auto 4px;background:repeating-linear-gradient(45deg,#111 0 6px,#fff 6px 12px);border:6px solid #fff;outline:2px solid #111}.print-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.config-card{border-radius:20px;background:rgba(255,255,255,.045);border:1px solid var(--line);padding:14px}.config-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.print-preview-note{color:var(--muted);font-size:12px;line-height:1.45}.drawer-lite{position:fixed;right:22px;top:22px;width:min(440px,calc(100vw - 44px));max-height:calc(100dvh - 44px);overflow:auto;z-index:60;border-radius:26px;background:#100d0a;border:1px solid var(--line);box-shadow:var(--shadow);padding:18px}.drawer-lite h2{font-family:'Playfair Display',serif;font-size:30px;margin:0}.tip-box{border-radius:18px;background:rgba(247,211,123,.08);border:1px solid rgba(247,211,123,.18);padding:14px}.tip-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.printer-card{border:1px solid rgba(96,165,250,.24);background:rgba(96,165,250,.08);border-radius:20px;padding:14px;margin-top:12px}.period-switch{display:flex;gap:8px;flex-wrap:wrap}.period-switch button{border:1px solid var(--line);background:rgba(255,255,255,.045);color:var(--muted);border-radius:999px;padding:10px 13px;font-weight:900}.period-switch button.on{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#171006}.sales-split{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.sales-mini{border-radius:18px;background:rgba(255,255,255,.045);border:1px solid var(--line);padding:14px}.sales-mini span{color:var(--muted);font-size:12px}.sales-mini strong{display:block;font-size:22px;margin-top:6px}.kitchen-board{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.kitchen-col{border-radius:22px;background:rgba(255,255,255,.04);border:1px solid var(--line);padding:14px}.kitchen-ticket{border-radius:18px;background:#18130f;border:1px solid rgba(255,255,255,.06);padding:12px;margin-top:10px}.kitchen-ticket h4{margin:0 0 6px}.kitchen-ticket p{margin:0;color:var(--muted);font-size:12px}.cash-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.cash-card{border-radius:20px;padding:16px;background:rgba(255,255,255,.045);border:1px solid var(--line)}.cash-card span{display:block;color:var(--muted);font-size:12px}.cash-card strong{display:block;font-size:24px;margin-top:8px}.shift-banner{border-radius:22px;padding:16px;background:linear-gradient(135deg,rgba(217,164,65,.14),rgba(255,255,255,.04));border:1px solid rgba(247,211,123,.22);display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center}.shift-actions{display:flex;gap:8px;flex-wrap:wrap}.close-report{width:min(760px,100%);background:#fff;color:#111;border-radius:14px;padding:24px;font-family:Inter,system-ui,sans-serif}.close-report h2{font-family:Inter,system-ui,sans-serif;margin:0 0 6px;color:#111}.close-report .muted2{color:#555}.report-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0}.report-box{border:1px solid #ddd;border-radius:10px;padding:12px}.report-box span{font-size:12px;color:#555}.report-box b{display:block;font-size:20px;margin-top:4px}.signature-line{border-top:1px solid #111;margin-top:34px;padding-top:8px;text-align:center}.whatsapp-card{border:1px solid rgba(52,211,153,.24);background:rgba(52,211,153,.08);border-radius:20px;padding:14px;margin-top:12px}.qr-card-admin{border-radius:20px;background:rgba(255,255,255,.045);border:1px solid var(--line);padding:14px}.qr-visual{width:112px;height:112px;border-radius:16px;background:repeating-linear-gradient(45deg,#fff 0 7px,#111 7px 14px);border:10px solid #fff;margin:0 auto 12px}.permission-table{width:100%;border-collapse:collapse}.permission-table th,.permission-table td{border-bottom:1px solid var(--line);padding:12px;text-align:left}.permission-table th{color:var(--gold2);font-size:12px}.permission-ok{color:var(--green);font-weight:900}.permission-no{color:var(--red2);font-weight:900}.inventory-low{border-color:rgba(239,68,68,.32)!important;background:linear-gradient(145deg,rgba(239,68,68,.09),rgba(255,255,255,.025))!important}.integration-log{max-height:260px;overflow:auto;display:grid;gap:8px}.log-row{border-radius:14px;background:rgba(0,0,0,.22);border:1px solid var(--line);padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#dbeafe}.log-row b{color:var(--gold2)}.status-dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:7px;background:var(--green);box-shadow:0 0 0 4px rgba(52,211,153,.12)}.status-dot.off{background:var(--red);box-shadow:0 0 0 4px rgba(239,68,68,.12)}.endpoint-grid{display:grid;grid-template-columns:1fr;gap:10px}.endpoint-row{display:grid;grid-template-columns:150px 1fr auto;gap:10px;align-items:center}.demo-banner{border:1px solid rgba(96,165,250,.22);background:rgba(96,165,250,.08);border-radius:20px;padding:14px}.demo-banner b{color:#bfdbfe}@media print{body{background:#fff}.app,.sidebar,.mobile-top,.topbar,.panel:not(.print-target){display:none!important}.print-target{display:block!important;box-shadow:none!important;border:0!important}.receipt{box-shadow:none;border-radius:0;width:80mm}.main{padding:0}.receipt-wrap{display:block}}.mobile-top{display:none}@media(max-width:1050px){.app{grid-template-columns:1fr}.sidebar{display:none}.mobile-top{display:flex;position:sticky;top:0;z-index:20;background:rgba(7,6,4,.9);backdrop-filter:blur(18px);border-bottom:1px solid var(--line);padding:12px;gap:8px;overflow:auto}.mobile-top button{white-space:nowrap}.main{padding:14px}.kpis,.two,.three,.table-grid{grid-template-columns:1fr}.topbar{display:block}.operator{margin-top:12px}.title h1{font-size:34px}.row{grid-template-columns:1fr}.bar{grid-template-columns:1fr}.table-actions{grid-template-columns:1fr 1fr}}@media(max-width:1050px){.kitchen-board,.sales-split{grid-template-columns:repeat(2,1fr)}.cash-grid{grid-template-columns:repeat(3,1fr)}.form-grid,.config-grid{grid-template-columns:1fr}}@media(max-width:640px){.kitchen-board,.cash-grid,.sales-split,.form-grid,.config-grid{grid-template-columns:1fr}}
/* Tablet: two usable columns instead of collapsing everything to one. */
@media(min-width:641px) and (max-width:1050px){.kpis,.three,.table-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.two{grid-template-columns:1fr}.kitchen-board{grid-template-columns:repeat(2,minmax(0,1fr))}.cash-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.form-grid,.config-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.main{padding:18px}}
/* Touch targets and no horizontal overflow on phones. */
@media(max-width:640px){.btn{padding:13px 14px;min-height:44px}.input,.select{min-height:44px;font-size:16px}.mobile-top button{min-height:42px}.panel,.kpi,.table-card{border-radius:18px}.title h1{font-size:28px}.panel h2{font-size:22px}.receipt{width:100%}.modal{padding:14px;border-radius:20px}.drawer-lite{right:0;left:0;top:0;width:100%;max-height:100dvh;border-radius:0;padding:16px}}
.main,.panel,.grid{min-width:0}
.permission-table{display:block;overflow-x:auto}
.audit,.integration-log{overflow-x:auto}`;

// Populated from Supabase by useBackofficeState; falls back to the seed list so
// the UI still renders before the first poll returns.
let LIVE_STAFF = [];
const setLiveStaff = (rows) => { LIVE_STAFF = Array.isArray(rows) ? rows : []; };

function getStaff(id) {
  if (!id) return { name: "Sin asignar", avatar: "—", role: "", photoUrl: "" };
  return LIVE_STAFF.find((s) => s.id === id)
    || STAFF.find((s) => s.id === id)
    || { name: "Sin asignar", avatar: "—", role: "", photoUrl: "" };
}

function StaffAvatar({ staff, className = "avatar" }) {
  if (staff?.photoUrl) return <img className={`${className} img`} src={staff.photoUrl} alt={staff.name} />;
  return <div className={className}>{staff?.avatar || "—"}</div>;
}

function statusBadge(status) {
  const s = String(status).toLowerCase();
  if (s.includes("crítica") || s.includes("alta") || s.includes("cobro") || s.includes("cocina")) return "red";
  if (s.includes("listo") || s.includes("servido") || s.includes("activo")) return "green";
  if (s.includes("preparando") || s.includes("esperando")) return "blue";
  return "";
}

function useBackofficeState(authToken = null) {
  const [orders, setOrders] = useState([]);
  const [calls, setCalls] = useState([]);
  const [messages, setMessages] = useState(CLIENT_MESSAGES);
  // Menu and tables are owned by the restaurant: whatever is in Supabase is the
  // truth, including "nothing yet". No demo rows are injected here.
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [cashSession, setCashSession] = useState(CASH_SESSION_INITIAL);
  const [inventory, setInventory] = useState([]);
  const [qrTokens, setQrTokens] = useState(QR_TOKENS);
  const [expenses, setExpenses] = useState([]);

  // Track locally-changed order IDs so the poll doesn't overwrite them right away
  const localOrderUpdates = useRef({});
  // Id of the cash_sessions row currently open, if any.
  const cashSessionId = useRef(null);

  // Recover the open shift (if there is one) so a reload does not lose the till.
  useEffect(() => {
    (async () => {
      try {
        const rows = await supaGet(`cash_sessions?restaurant_id=eq.${getRestaurantId()}&status=eq.open&order=opened_at.desc&limit=1`, authToken);
        const open = Array.isArray(rows) ? rows[0] : null;
        if (!open) {
          setCashSession((s) => ({ ...s, status: "cerrada", history: [] }));
          return;
        }
        cashSessionId.current = open.id;
        const [moves, spend] = await Promise.all([
          supaGet(`cash_movements?session_id=eq.${encodeURIComponent(open.id)}&order=created_at.desc&limit=40`, authToken),
          supaGet(`expenses?cash_session_id=eq.${encodeURIComponent(open.id)}&order=created_at.desc&limit=40`, authToken),
        ]);
        if (Array.isArray(spend)) setExpenses(spend.map((e) => ({
          id: e.id, type: e.expense_type, detail: e.detail, amount: e.amount, userId: e.staff_id,
          time: new Date(e.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
        })));
        setCashSession((s) => ({
          ...s,
          id: open.id,
          status: "abierta",
          openedAt: new Date(open.opened_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
          closedAt: null,
          openedBy: open.opened_by,
          currentUser: open.opened_by,
          activeTurn: open.turn || "Noche",
          openingCash: open.opening_cash || 0,
          cash: open.cash_total || 0,
          card: open.card_total || 0,
          transfer: open.transfer_total || 0,
          tips: open.tips_total || 0,
          expenses: open.expenses_total || 0,
          expected: (open.opening_cash || 0) + (open.cash_total || 0) + (open.card_total || 0) + (open.transfer_total || 0) - (open.expenses_total || 0),
          history: Array.isArray(moves) ? moves.map((m) => ({
            time: new Date(m.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
            userId: m.staff_id, action: m.action, detail: m.detail || "",
          })) : [],
        }));
      } catch (e) { console.error("[holu caja] cargar turno:", e.message); }
    })();
  }, [authToken]);

  useEffect(() => {
    const poll = async () => {
      try {
        const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const [rawOrders, rawCalls, rawTables, rawMenu, rawStaff] = await Promise.all([
          supaGet(`orders?restaurant_id=eq.${getRestaurantId()}&status=neq.served&created_at=gte.${since}&select=*,order_items(*)&order=created_at.desc&limit=50`, null),
          supaGet(`calls?restaurant_id=eq.${getRestaurantId()}&status=neq.Resuelto&created_at=gte.${since}&select=*&order=created_at.desc`, null),
          supaGet(`tables?restaurant_id=eq.${getRestaurantId()}&active=eq.true&order=table_number.asc`, null),
          supaGet(`menu_items?restaurant_id=eq.${getRestaurantId()}&order=sort_order.asc,name.asc`, null),
          supaGet(`staff?restaurant_id=eq.${getRestaurantId()}&select=id,name,role,shift,status,avatar_url&order=name.asc`, authToken),
        ]);
        if (Array.isArray(rawOrders)) {
          const now = Date.now();
          setOrders((prev) => {
            const incoming = rawOrders.map(dbOrderToUI);
            // Keep local state for orders touched in the last 20s
            return incoming.map((o) => {
              const lockedUntil = localOrderUpdates.current[o.id];
              if (lockedUntil && now < lockedUntil) {
                return prev.find((p) => p.id === o.id) || o;
              }
              return o;
            });
          });
        }
        if (Array.isArray(rawCalls)) setCalls(rawCalls.map(dbCallToUI));
        if (Array.isArray(rawTables)) setTables(rawTables.map(dbTableToUI));
        if (Array.isArray(rawMenu)) setMenuItems(rawMenu.map(dbMenuItemToUI));
        if (Array.isArray(rawStaff)) {
          const mapped = rawStaff.map((s) => ({
            id: s.id, name: s.name, role: s.role, shift: s.shift || "",
            status: s.status, avatar: (s.name || "?")[0].toUpperCase(), photoUrl: s.avatar_url || "",
          }));
          setLiveStaff(mapped);
          setStaffList(mapped);
        }
      } catch (err) {
        console.error("[holu admin] Supabase poll:", err.message);
      }
    };
    poll();
    const t = setInterval(poll, 8000);
    return () => clearInterval(t);
  }, []);

  const attendCall = async (id, actor) => {
    setCalls((rows) => rows.filter((c) => c.id !== id));
    try { await supaPatch(`calls?id=eq.${encodeURIComponent(id)}`, { status: "Resuelto", resolved_at: new Date().toISOString() }, null); }
    catch (e) { console.error("[holu admin] attendCall:", e.message); }
  };
  const resolveMessage = (id, actor) => {
    setMessages((rows) => rows.map((m) => m.id === id ? { ...m, status: `resuelto por ${actor}` } : m));
  };
  const updateOrderStatus = async (id, uiStatus) => {
    localOrderUpdates.current[id] = Date.now() + 20000;
    setOrders((rows) => rows.map((o) => o.id === id ? { ...o, status: uiStatus, eta: uiStatus === "Servido" ? 0 : o.eta } : o));
    if (uiStatus === "Servido") setOrders((rows) => rows.filter((o) => o.id !== id));
    if (STATUS_DB[uiStatus]) {
      try { await supaPatch(`orders?id=eq.${encodeURIComponent(id)}`, { status: STATUS_DB[uiStatus] }, null); }
      catch (e) { console.error("[holu admin] updateOrderStatus:", e.message); }
    }
  };
  const saveMenuItem = async (item) => {
    const isNew = !menuItems.some((r) => r.id === item.id);
    const newId = item.id || `dish-${Date.now()}`;
    const dbItem = {
      id: newId,
      restaurant_id: getRestaurantId(),
      name: item.dish,
      category: item.category,
      subtitle: item.description || null,
      price: Number(item.price) || 0,
      avg_prep_minutes: Number(item.avgPrep) || 15,
      stock_status: item.stock || "OK",
      available: item.available !== false,
      visible_client: item.visibleClient !== false,
      tags: item.tags ? String(item.tags).split(",").map((t) => t.trim()).filter(Boolean) : [],
      image_url: item.imageUrl || null,
    };
    setMenuItems((rows) => {
      if (!isNew) return rows.map((r) => r.id === item.id ? { ...item, id: newId } : r);
      return [{ ...item, id: newId }, ...rows];
    });
    try {
      if (isNew) await supaPost(`menu_items`, dbItem, authToken);
      else await supaPatch(`menu_items?id=eq.${encodeURIComponent(item.id)}`, dbItem, authToken);
    } catch (e) { console.error("[holu admin] saveMenuItem:", e.message); }
  };
  const toggleMenuAvailability = async (id) => {
    const item = menuItems.find((r) => r.id === id);
    if (!item) return;
    const newAvailable = !item.available;
    setMenuItems((rows) => rows.map((r) => r.id === id ? { ...r, available: newAvailable, visibleClient: newAvailable ? r.visibleClient : false } : r));
    try { await supaPatch(`menu_items?id=eq.${encodeURIComponent(id)}`, { available: newAvailable, visible_client: newAvailable ? item.visibleClient : false }, authToken); }
    catch (e) { console.error("[holu admin] toggleMenu:", e.message); }
  };
  const deleteMenuItem = async (id) => {
    setMenuItems((rows) => rows.filter((r) => r.id !== id));
    try { await supaDelete(`menu_items?id=eq.${encodeURIComponent(id)}`, authToken); }
    catch (e) { console.error("[holu admin] deleteMenuItem:", e.message); }
  };
  const setTableTip = async (tableId, accepted) => {
    const table = tables.find((t) => t.id === tableId);
    const tipAmt = accepted && table ? Math.round(table.bill * 0.1) : 0;
    setTables((rows) => rows.map((t) => t.id === tableId ? { ...t, tipAccepted: accepted, tipAmount: tipAmt } : t));
    try { await supaPatch(`tables?id=eq.${tableId}`, { tip_accepted: accepted, tip_amount: tipAmt }, null); }
    catch (e) { console.error("[holu admin] setTableTip:", e.message); }
  };
  // ── Caja ────────────────────────────────────────────────────────────────────
  // A shift lives in cash_sessions; every movement is appended to cash_movements
  // so the running totals and the audit trail survive a reload or a device swap.
  const isStaffUuid = (id) => typeof id === "string" && id.length === 36 && id.includes("-");

  const logMovement = async (userId, action, detail, amount = 0) => {
    const time = new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    setCashSession((s) => ({ ...s, history: [{ time, userId, action, detail }, ...(s.history || [])] }));
    if (!cashSessionId.current) return;
    try {
      await supaPost(`cash_movements`, {
        restaurant_id: getRestaurantId(),
        session_id: cashSessionId.current,
        staff_id: isStaffUuid(userId) ? userId : null,
        action, detail, amount: Number(amount) || 0,
      }, authToken);
    } catch (e) { console.error("[holu caja] movimiento:", e.message); }
  };
  const addCashHistory = logMovement;

  const openCash = async (userId, openingCash = 0, turn = "Noche") => {
    const now = new Date();
    const openedAt = now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    try {
      const rows = await supaPost(`cash_sessions`, {
        restaurant_id: getRestaurantId(),
        opened_by: isStaffUuid(userId) ? userId : null,
        turn,
        status: "open",
        opening_cash: Number(openingCash) || 0,
      }, authToken);
      const created = Array.isArray(rows) ? rows[0] : rows;
      if (created?.id) cashSessionId.current = created.id;
      setCashSession((s) => ({
        ...s, id: created?.id || s.id, status: "abierta", openedAt, closedAt: null,
        openedBy: userId, currentUser: userId, activeTurn: turn,
        openingCash: Number(openingCash) || 0,
        cash: 0, card: 0, transfer: 0, tips: 0, expenses: 0,
        expected: Number(openingCash) || 0, counted: 0, difference: 0, history: [],
      }));
      await logMovement(userId, "Abrió caja", `Fondo inicial ${money(openingCash)} · Turno ${turn}`, Number(openingCash) || 0);
    } catch (e) { console.error("[holu caja] abrir:", e.message); }
  };

  const closeCash = async (userId, counted = null) => {
    const closedAt = new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    await logMovement(userId, "Cerró caja", "Cierre validado del turno");
    setCashSession((s) => {
      const countedVal = counted == null ? s.expected : Number(counted);
      return { ...s, status: "cerrada", closedAt, currentUser: userId, counted: countedVal, difference: countedVal - s.expected };
    });
    if (!cashSessionId.current) return;
    try {
      await supaPatch(`cash_sessions?id=eq.${encodeURIComponent(cashSessionId.current)}`, {
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by: isStaffUuid(userId) ? userId : null,
        cash_total: cashSession.cash, card_total: cashSession.card,
        transfer_total: cashSession.transfer, tips_total: cashSession.tips,
        expenses_total: cashSession.expenses,
      }, authToken);
    } catch (e) { console.error("[holu caja] cerrar:", e.message); }
    cashSessionId.current = null;
  };

  const changeTurn = async (userId, turn) => {
    setCashSession((s) => ({ ...s, activeTurn: turn, currentUser: userId }));
    await logMovement(userId, "Cambio turno", `Nuevo turno activo: ${turn}`);
    if (!cashSessionId.current) return;
    try { await supaPatch(`cash_sessions?id=eq.${encodeURIComponent(cashSessionId.current)}`, { turn }, authToken); }
    catch (e) { console.error("[holu caja] turno:", e.message); }
  };

  const closeTurn = (userId) => logMovement(userId, "Cerró turno", `Responsable: ${getStaff(userId).name}`);

  const addExpense = async (expense) => {
    const amount = Number(expense.amount) || 0;
    const time = new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    setExpenses((rows) => [{ ...expense, id: `E-${Date.now()}`, time }, ...rows]);
    setCashSession((s) => ({ ...s, expenses: s.expenses + amount, expected: s.expected - amount }));
    try {
      await supaPost(`expenses`, {
        restaurant_id: getRestaurantId(),
        cash_session_id: cashSessionId.current,
        staff_id: isStaffUuid(expense.userId) ? expense.userId : null,
        expense_type: expense.type || "Caja",
        detail: expense.detail,
        amount,
      }, authToken);
    } catch (e) { console.error("[holu caja] gasto:", e.message); }
    await logMovement(expense.userId, "Registró gasto", `${expense.detail} · ${money(amount)}`, -amount);
  };

  const updateInventoryStock = async (id, stock) => {
    setInventory((rows) => rows.map((r) => r.id === id ? { ...r, stock: Number(stock), status: Number(stock) <= (r.min_stock ?? r.min ?? 0) ? "Bajo" : "OK" } : r));
    try { await supaPatch(`inventory?id=eq.${encodeURIComponent(id)}`, { stock: Number(stock) }, authToken); }
    catch (e) { console.error("[holu inventario] stock:", e.message); }
  };
  const toggleQr = (table) => setQrTokens((rows) => rows.map((q) => q.table === table ? { ...q, active: !q.active } : q));
  const regenerateQr = (table) => setQrTokens((rows) => rows.map((q) => q.table === table ? { ...q, token: `QR${table}${Math.floor(1000 + Math.random() * 8999)}`, scans: 0, lastScan: "—" } : q));
  const assignWaiter = async (tableId, waiterId) => {
    setTables((rows) => rows.map((t) => t.id === tableId ? { ...t, waiterId } : t));
    addCashHistory(waiterId, "Mesa reasignada", `Mesa ${tableId} asignada a ${getStaff(waiterId).name}`);
    try { await supaPatch(`tables?id=eq.${tableId}`, { waiter_id: waiterId || null }, null); }
    catch (e) { console.error("[holu admin] assignWaiter:", e.message); }
  };
  const cobrarMesa = async (tableId, callId, method, tipAccepted, total, tipAmt, staffUserId) => {
    setTables((rows) => rows.map((t) => t.id === tableId ? { ...t, status: "Libre", bill: 0, tipAccepted: false, tipAmount: 0, guests: 0, waiterId: null } : t));
    setCalls((rows) => rows.filter((c) => c.table !== tableId));
    const time = new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    let totals = null;
    setCashSession((s) => {
      const next = {
        ...s,
        cash:     method === "Efectivo"      ? s.cash     + total : s.cash,
        card:     method === "Tarjeta"       ? s.card     + total : s.card,
        transfer: method === "Transferencia" ? s.transfer + total : s.transfer,
        tips:     s.tips + tipAmt,
        expected: s.expected + total,
        history: [{ time, userId: staffUserId, action: "Cobro registrado", detail: `Mesa ${tableId} · ${money(total)} · ${method}` }, ...(s.history || [])],
      };
      totals = next;
      return next;
    });
    if (cashSessionId.current && totals) {
      try {
        await supaPatch(`cash_sessions?id=eq.${encodeURIComponent(cashSessionId.current)}`, {
          cash_total: totals.cash, card_total: totals.card,
          transfer_total: totals.transfer, tips_total: totals.tips,
        }, authToken);
        await supaPost(`cash_movements`, {
          restaurant_id: getRestaurantId(),
          session_id: cashSessionId.current,
          staff_id: isStaffUuid(staffUserId) ? staffUserId : null,
          action: "Cobro registrado",
          detail: `Mesa ${tableId} · ${money(total)} · ${method}`,
          amount: total,
        }, authToken);
      } catch (e) { console.error("[holu caja] cobro:", e.message); }
    }
    try {
      await supaPatch(`calls?table_id=eq.${tableId}&status=neq.Resuelto&restaurant_id=eq.${getRestaurantId()}`, { status: "Resuelto", resolved_at: new Date().toISOString() }, null);
      await supaPatch(`orders?table_id=eq.${tableId}&status=neq.served&restaurant_id=eq.${getRestaurantId()}`, { status: "served" }, null);
      await supaPatch(`tables?id=eq.${tableId}&restaurant_id=eq.${getRestaurantId()}`, { status: "Libre", guests: 0, bill_total: 0, tip_accepted: false, tip_amount: 0, waiter_id: null }, null);
    } catch (e) { console.error("[holu admin] cobrarMesa:", e.message); }
  };
  return { orders, calls, messages, menuItems, tables, staffList, cashSession, inventory, qrTokens, expenses, authToken, attendCall, resolveMessage, updateOrderStatus, saveMenuItem, toggleMenuAvailability, deleteMenuItem, setTableTip, openCash, closeCash, changeTurn, closeTurn, addExpense, updateInventoryStock, toggleQr, regenerateQr, assignWaiter, cobrarMesa };
}

function Layout({ role, staffId, tab, setTab, onLogout, children, authed }) {
  const found = getStaff(staffId);
  const currentStaff = (found && found.name !== "Sin asignar") ? found : (authed || found);

  if (role === "cocina") return (
    <div style={{ minHeight: "100dvh", background: "#050403", display: "flex", flexDirection: "column" }}>
      <style>{CSS}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 22px", borderBottom: "1px solid rgba(255,255,255,.09)", background: "rgba(10,8,6,.92)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", color: "#f7d37b", fontSize: 24, letterSpacing: ".1em" }}>HOLU · <span style={{ fontFamily: "Inter,sans-serif", fontSize: 14, color: "#bfae9d", letterSpacing: 0 }}>Pantalla Cocina</span></div>
        <button className="btn ghost" style={{ fontSize: 12 }} onClick={onLogout}>Salir</button>
      </div>
      <div style={{ flex: 1, padding: "18px" }}>{children}</div>
    </div>
  );

  const adminTabs = [
    ["dashboard", "Resumen", icons.dashboard],
    ["tables", "Mesas", icons.table],
    ["orders", "Platos/Pedidos", icons.order],
    ["kitchen", "Pantalla cocina", icons.kitchen],
    ["calls", "Llamados", icons.bell],
    ["messages", "Mensajes cliente", icons.chat],
    ["sales", "Ventas platos", icons.sales],
    ["staff", "Camareros", icons.users],
    ["inventory", "Inventario", icons.kitchen],
    ["qr", "QR Mesas", icons.table],
    ["menu", "Carta", icons.menu],
    ["reviews", "Reseñas", icons.star],
    ["settings", "Configuración", icons.settings],
  ];
  const waiterTabs = [
    ["dashboard", "Mi turno", icons.dashboard],
    ["tables", "Mis mesas", icons.table],
    ["orders", "Estado platos", icons.order],
    ["kitchen", "Cocina", icons.kitchen],
    ["calls", "Llamados", icons.bell],
    ["messages", "Mensajes cliente", icons.chat],
    ["reviews", "Reseñas", icons.star],
  ];
  const tabs = role === "admin" ? adminTabs : waiterTabs;
  return <div className="app">
    <style>{CSS}</style>
    <aside className="sidebar">
      <div className="brand">{RESTAURANT.name}<small>BACKOFFICE</small></div>
      <div className="role-card">
        <div style={{display:"flex", gap:10, alignItems:"center"}}><StaffAvatar staff={currentStaff} /><div><b>{currentStaff.name}</b><small style={{display:"block", color:"var(--muted)", marginTop:3}}>{role === "admin" ? "Administrador" : "Camarero"}</small></div></div>
      </div>
      <nav className="nav">{tabs.map(([id, label, ic]) => <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{ic}<span>{label}</span></button>)}</nav>
      <div className="side-footer">Conectado a QR de mesas, cocina y panel de cliente. El rol Camarero no accede a ventas ni configuración financiera.</div>
      {onLogout && <button className="btn ghost" style={{width:"100%",marginTop:10,fontSize:12}} onClick={onLogout}>Cerrar sesión</button>}
    </aside>
    <div className="mobile-top">{tabs.map(([id, label]) => <button className={`btn ${tab === id ? "primary" : "ghost"}`} key={id} onClick={() => setTab(id)}>{label}</button>)}</div>
    <main className="main">{children}</main>
  </div>;
}

function Topbar({ role, staffId, authed }) {
  const found = getStaff(staffId);
  const current = (found && found.name !== "Sin asignar") ? found : (authed || found);
  return <div className="topbar">
    <div className="title"><h1>{role === "admin" ? "Control total del restaurante" : "Operación de camarero"}</h1><p>{RESTAURANT.location} · Servicio {RESTAURANT.service}</p></div>
    <div className="operator"><StaffAvatar staff={current} /><div><b>{current.name}</b><small style={{display:"block", color:"var(--muted)"}}>{role === "admin" ? "Administrador" : "Camarero"} · {current.shift}</small></div></div>
  </div>;
}

function Dashboard({ role, staffId, state }) {
  const isAdmin = role === "admin";
  const staffTables = state.tables.filter((t) => isAdmin || t.waiterId === staffId);
  const staffOrders = state.orders.filter((o) => isAdmin || o.waiterId === staffId);
  const staffCalls = state.calls.filter((c) => isAdmin || c.waiterId === staffId);
  const pendingMessages = state.messages.filter((m) => isAdmin || m.waiterId === staffId).filter((m) => String(m.status).includes("pendiente") || String(m.status).includes("urgente"));
  const salesToday = state.tables.reduce((sum, t) => sum + t.bill, 0);
  const tipsToday = state.tables.reduce((sum, t) => sum + t.tipAmount, 0);
  return <div className="grid">
    <div className="kpis">
      <div className="kpi"><span>{isAdmin ? "Mesas activas" : "Mis mesas"}</span><strong>{staffTables.filter((t)=>t.status !== "Libre").length}</strong><small>{staffTables.length} asignadas/visibles</small></div>
      <div className="kpi"><span>Pedidos en curso</span><strong>{staffOrders.length}</strong><small>Incluye cocina y QR</small></div>
      <div className="kpi"><span>Llamados pendientes</span><strong>{staffCalls.filter((c)=>c.status === "Pendiente").length}</strong><small>Mesa + cocina</small></div>
      <div className="kpi"><span>{isAdmin ? "Ventas hoy" : "Mensajes cliente"}</span><strong>{isAdmin ? money(salesToday) : pendingMessages.length}</strong><small>{isAdmin ? `Propina 10%: ${money(tipsToday)}` : "Por atender"}</small></div>
    </div>
    <div className="two">
      <div className="panel"><div className="panel-head"><h2>Prioridad operativa</h2><span className="badge red">Live</span></div><div className="list">{staffCalls.slice(0,4).map((c)=><CallRow key={c.id} call={c} state={state} actor={getStaff(staffId).name} staffId={staffId} />)}</div></div>
      <div className="panel"><div className="panel-head"><h2>Mensajes del cliente</h2><span className="badge">QR</span></div><div className="list">{pendingMessages.slice(0,4).map((m)=><MessageCard key={m.id} msg={m} state={state} actor={getStaff(staffId).name} compact />)}</div></div>
    </div>
    <div className="panel"><div className="panel-head"><h2>Estado de platos</h2><span className="badge blue">Cocina</span></div><div className="list">{staffOrders.map((o)=><OrderRow key={o.id} order={o} state={state} />)}</div></div>
  </div>;
}

function CobrarModal({ table, callId, state, staffId, onClose }) {
  const [method, setMethod] = useState("Efectivo");
  const [tip, setTip] = useState(false);
  const [done, setDone] = useState(false);
  const subtotal = table.bill || 0;
  const tipAmt = tip ? Math.round(subtotal * 0.1) : 0;
  const total = subtotal + tipAmt;
  const tableOrders = state.orders.filter((o) => o.table === table.id);

  const handleCobrar = async () => {
    await state.cobrarMesa(table.id, callId, method, tip, total, tipAmt, staffId);
    setDone(true);
    setTimeout(onClose, 1800);
  };

  if (done) return (
    <div className="modal-backdrop">
      <div className="modal" style={{ textAlign: "center", padding: "40px 24px" }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>✓</div>
        <h2 style={{ margin: "0 0 8px" }}>Mesa {table.id} cobrada</h2>
        <p style={{ color: "var(--muted)", margin: 0 }}>{money(total)} · {method}</p>
      </div>
    </div>
  );

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="panel-head">
          <div><h2>Cobrar Mesa {table.id}</h2><p style={{ margin: "4px 0 0", color: "var(--muted)" }}>{table.zone} · {table.guests || 0} clientes</p></div>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
        </div>
        {tableOrders.length > 0 && (
          <div style={{ margin: "12px 0" }}>
            {tableOrders.map((o) => o.items.map((item, i) => (
              <div key={`${o.id}-${i}`} className="receipt-row"><span>{item.qty}× {item.dish}</span><span>{money((item.price || 0) * item.qty)}</span></div>
            )))}
          </div>
        )}
        {tableOrders.length === 0 && subtotal > 0 && (
          <div className="receipt-row" style={{ margin: "12px 0" }}><span>Consumo mesa</span><span>{money(subtotal)}</span></div>
        )}
        <div className="dash" />
        <div style={{ margin: "14px 0" }}>
          <b style={{ fontSize: 13, color: "var(--muted)" }}>PROPINA</b>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className={`btn ${tip ? "primary" : "ghost"}`} onClick={() => setTip(true)}>+ {money(Math.round(subtotal * 0.1))} (10%)</button>
            <button className={`btn ${!tip ? "primary" : "ghost"}`} onClick={() => setTip(false)}>Sin propina</button>
          </div>
        </div>
        <div style={{ margin: "14px 0" }}>
          <b style={{ fontSize: 13, color: "var(--muted)" }}>MÉTODO DE PAGO</b>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {["Efectivo", "Tarjeta", "Transferencia"].map((m) => (
              <button key={m} className={`btn ${method === m ? "primary" : "ghost"}`} onClick={() => setMethod(m)}>{m}</button>
            ))}
          </div>
        </div>
        <div className="dash" />
        <div className="receipt-row receipt-total" style={{ fontSize: 20, margin: "14px 0" }}>
          <span>Total</span><b>{money(total)}</b>
        </div>
        <button className="btn primary" style={{ width: "100%", padding: "15px 0", fontSize: 16, marginTop: 4 }} onClick={handleCobrar}>
          Cobrar {money(total)} · {method}
        </button>
      </div>
    </div>
  );
}

function TablesView({ role, staffId, state }) {
  const isAdmin = role === "admin";
  const [selectedTable, setSelectedTable] = useState(null);
  // A waiter sees the tables they already hold plus any table nobody has claimed,
  // so they can pick one up from their phone the moment a call comes in.
  const mine = state.tables.filter((t) => t.waiterId === staffId);
  const free = state.tables.filter((t) => !t.waiterId);
  const visible = isAdmin ? state.tables : [...mine, ...free];
  const waiters = state.staffList.filter((s) => s.role === "camarero");

  if (state.tables.length === 0) return <div className="grid"><div className="panel">
    <div className="panel-head"><h2>{isAdmin ? "Mapa de mesas" : "Mesas"}</h2></div>
    <p style={{ color: "var(--muted)", textAlign: "center", padding: "28px 0", lineHeight: 1.6 }}>
      Aún no hay mesas configuradas.<br />
      {isAdmin ? 'Ve a "QR de mesas" y agrega las mesas de tu local.' : "Pide al administrador que configure las mesas."}
    </p>
  </div></div>;

  return <div className="grid"><div className="panel">
    <div className="panel-head">
      <h2>{isAdmin ? "Mapa de mesas" : "Mesas"}</h2>
      <span className="badge">{isAdmin ? `${visible.length} mesas` : `${mine.length} mías · ${free.length} libres`}</span>
    </div>
    <div className="table-grid">{visible.map((t) => {
      const isMine = t.waiterId === staffId;
      const unclaimed = !t.waiterId;
      return <div className="table-card" key={t.id} style={isMine ? { borderColor: "rgba(247,211,123,.4)" } : {}}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <h3>{t.label}</h3>
          <span className={`badge ${statusBadge(t.status)}`}>{t.status}</span>
        </div>
        <div className="meta"><span>{t.zone}</span><span>{t.guests} pax</span></div>
        <div className="meta"><span>Camarero</span><b>{t.waiterId ? getStaff(t.waiterId).name : "Sin asignar"}</b></div>
        {isAdmin && <div className="meta"><span>Cuenta</span><b>{money(t.bill)}</b></div>}
        <div className="tip-box" style={{ marginTop: 10 }}>
          <small style={{ color: "var(--muted)" }}>Propina 10%</small>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <b>{t.tipAccepted ? "Aceptada" : "No agregada"}</b><span>{money(t.tipAmount)}</span>
          </div>
        </div>
        {isAdmin && <div className="field" style={{ marginTop: 10 }}>
          <label>Asignar camarero</label>
          <select className="input" value={t.waiterId || ""} onChange={(e) => state.assignWaiter(t.id, e.target.value)}>
            <option value="">Sin asignar</option>
            {waiters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>}
        <div className="table-actions">
          {!isAdmin && unclaimed
            ? <button className="btn primary" onClick={() => state.assignWaiter(t.id, staffId)}>Tomar mesa</button>
            : <button className="btn primary" onClick={() => setSelectedTable(t)}>Atender</button>}
          {!isAdmin && isMine
            ? <button className="btn ghost" onClick={() => state.assignWaiter(t.id, null)}>Soltar</button>
            : <button className="btn ghost" onClick={() => setSelectedTable(t)}>Ver ficha</button>}
        </div>
      </div>;
    })}</div>
  </div>
  {selectedTable && <TableDrawer table={selectedTable} role={role} staffId={staffId} state={state} onClose={() => setSelectedTable(null)} />}
  </div>;
}

function TableReceipt({ table, waiter }) {
  const subtotal = table.bill;
  const tip = table.tipAmount || 0;
  const total = subtotal + tip;
  return <div className="receipt-wrap"><div className="receipt"><h3>{RESTAURANT.name}</h3><div className="center muted2">{RESTAURANT.legalName}<br />RUT {RESTAURANT.rut}<br />{RESTAURANT.address}<br />{RESTAURANT.phone} · {RESTAURANT.website}</div><div className="dash" /><div className="center"><b>BOLETA MESA {table.id}</b><br /><span className="muted2">{new Date().toLocaleString("es-CL", { hour:"2-digit", minute:"2-digit", day:"2-digit", month:"2-digit", year:"numeric" })}</span></div><div className="dash" /><div className="receipt-row"><span>Consumo mesa</span><b>{money(subtotal)}</b></div><div className="receipt-row"><span>Propina 10%</span><b>{tip ? money(tip) : "No agregada"}</b></div><div className="receipt-row"><span>IVA incluido</span><b>—</b></div><div className="dash" /><div className="receipt-row receipt-total"><span>TOTAL</span><b>{money(total)}</b></div><div className="receipt-row"><span>Atendió</span><b>{waiter.name}</b></div><div className="receipt-qr" /><div className="center muted2">Escanea para reseña Google</div><div className="dash" /><div className="center muted2">Gracias por visitar HOLU · Vuelve pronto</div></div></div>;
}

function TableDrawer({ table, role, state, staffId, onClose }) {
  const liveTable = state.tables.find((t) => t.id === table.id) || table;
  const [showReceipt, setShowReceipt] = useState(false);
  const [cobrarOpen, setCobrarOpen] = useState(false);
  const waiter = getStaff(liveTable.waiterId);
  const tableOrders = state.orders.filter((o)=>o.table === liveTable.id);
  const tableMessages = state.messages.filter((m)=>m.table === liveTable.id);
  const suggestedTip = Math.round(liveTable.bill * 0.1);
  const total = liveTable.bill + liveTable.tipAmount;
  const generateReceipt = () => setShowReceipt(true);
  return <aside className="drawer-lite"><div className="panel-head"><div><h2>Ficha Mesa {liveTable.id}</h2><p style={{margin:"4px 0 0"}}>Token QR {liveTable.qrToken} · {liveTable.zone}</p></div><button className="btn ghost" onClick={onClose}>Cerrar</button></div><div className="list"><div className="row"><span className={`badge ${statusBadge(liveTable.status)}`}>{liveTable.status}</span><div className="row-main"><b>{liveTable.guests} clientes</b><small>Camarero: {waiter.name}</small></div><strong>{money(liveTable.bill)}</strong></div><div className="tip-box"><b>Propina sugerida 10%</b><p style={{margin:"6px 0",color:"var(--muted)"}}>El cliente decide si desea agregarla. Debe quedar registrado para cierre diario/semanal/mensual.</p><div className="receipt-row" style={{color:"var(--text)"}}><span>Subtotal mesa</span><b>{money(liveTable.bill)}</b></div><div className="receipt-row" style={{color:"var(--text)"}}><span>Propina 10%</span><b>{liveTable.tipAccepted ? money(liveTable.tipAmount) : `${money(suggestedTip)} sugerida`}</b></div><div className="receipt-row receipt-total" style={{color:"var(--text)"}}><span>Total cobro</span><b>{money(total)}</b></div><div className="tip-actions"><button className="btn primary" onClick={()=>state.setTableTip(liveTable.id, true)}>Agregar 10%</button><button className="btn ghost" onClick={()=>state.setTableTip(liveTable.id, false)}>Sin propina</button></div><small style={{display:"block",color:"var(--muted)",marginTop:10}}>Estado: {liveTable.tipAccepted ? "propina aceptada y registrada" : "sin propina registrada"}</small></div><div className="panel" style={{boxShadow:"none"}}><h2>Pedidos</h2>{tableOrders.map((o)=><p key={o.id} style={{color:"var(--muted)"}}><b>{o.id}</b> · {o.status} · {o.items.map(i=>`${i.qty}× ${i.dish}`).join(", ")}</p>)}</div><div className="panel" style={{boxShadow:"none"}}><h2>Mensajes del cliente</h2>{tableMessages.map((m)=><blockquote key={m.id} style={{borderLeft:"3px solid var(--gold)",paddingLeft:10,color:"#eadfd4"}}>{m.text}</blockquote>)}</div>{liveTable.bill > 0 && <button className="btn primary" style={{width:"100%",padding:"14px 0",fontSize:15,background:"linear-gradient(135deg,var(--gold),var(--gold2))",color:"#160f02",marginBottom:8}} onClick={()=>setCobrarOpen(true)}>Cobrar mesa · {money(total)}</button>}{role === "admin" && <button className="btn ghost" style={{width:"100%"}} onClick={generateReceipt}>Generar boleta</button>}{showReceipt && <div className="modal-backdrop"><div className="modal"><div className="panel-head"><div><h2>Boleta generada</h2><p style={{margin:"4px 0 0"}}>Mesa {liveTable.id} · Total {money(total)}</p></div><button className="btn ghost" onClick={()=>setShowReceipt(false)}>Cerrar</button></div><TableReceipt table={liveTable} waiter={waiter} /><div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14}}><button className="btn ghost" onClick={()=>setShowReceipt(false)}>Volver</button><button className="btn primary" onClick={()=>window.print()}>Imprimir boleta</button></div></div></div>}{cobrarOpen && <CobrarModal table={liveTable} callId={null} state={state} staffId={staffId} onClose={()=>setCobrarOpen(false)} />}</div></aside>;
}

function OrdersView({ role, staffId, state }) {
  const visible = state.orders.filter((o) => role === "admin" || o.waiterId === staffId);
  return <div className="grid"><div className="panel"><div className="panel-head"><h2>Estado de platos y pedidos</h2><span className="badge blue">{visible.length} activos</span></div><div className="list">{visible.map((o)=><OrderDetail key={o.id} order={o} state={state} role={role} />)}</div></div></div>;
}

function OrderRow({ order, state }) {
  return <div className="row"><span className={`badge ${statusBadge(order.status)}`}>Mesa {order.table}</span><div className="row-main"><b>{order.id} · {order.status}</b><small>{order.items.map((i)=>`${i.qty}× ${i.dish}`).join(" · ")} · Camarero: {getStaff(order.waiterId).name}</small></div><button className="btn ghost" onClick={()=>state.updateOrderStatus(order.id, "Servido")}>Marcar servido</button></div>;
}

function OrderDetail({ order, state, role }) {
  const progress = order.status.includes("Recibido") ? 25 : order.status.includes("Preparando") ? 55 : order.status.includes("Listo") ? 90 : order.status.includes("Servido") ? 100 : 40;
  return <div className="panel" style={{boxShadow:"none"}}><div className="panel-head"><div><h2 style={{fontSize:24}}>{order.id} · Mesa {order.table}</h2><p style={{margin:"5px 0 0"}}>Canal: {order.channel} · Camarero: {getStaff(order.waiterId).name}</p></div><span className={`badge ${statusBadge(order.priority)}`}>{order.priority}</span></div><div className="progress"><span style={{width:`${progress}%`}} /></div><div className="dish-lines">{order.items.map((item, idx)=><div className="dish-line" key={`${order.id}-${idx}`}><span>{item.qty}× {item.dish}</span><b>{item.status}</b></div>)}</div><p>{order.notes}</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="btn ghost" onClick={()=>state.updateOrderStatus(order.id,"Preparando")}>Preparando</button><button className="btn ghost" onClick={()=>state.updateOrderStatus(order.id,"Listo para servir")}>Listo</button><button className="btn primary" onClick={()=>state.updateOrderStatus(order.id,"Servido")}>Servido</button>{role === "admin" && <button className="btn danger">Escalar incidencia</button>}</div></div>;
}

function CallsView({ role, staffId, state }) {
  const visible = state.calls.filter((c) => role === "admin" || c.waiterId === staffId);
  const cobro = visible.filter((c) => c.type === "Cuenta" || c.type === "Solicita cobro");
  const mesa = visible.filter((c) => c.source === "mesa" && c.type !== "Cuenta" && c.type !== "Solicita cobro");
  const cocina = visible.filter((c) => c.source === "cocina");
  const actor = getStaff(staffId).name;
  return <div className="grid">
    {cobro.length > 0 && <div className="panel" style={{border:"1px solid rgba(247,211,123,.35)",background:"linear-gradient(145deg,rgba(247,211,123,.10),rgba(255,255,255,.025))"}}><div className="panel-head"><h2>Solicitudes de cobro</h2><span className="badge" style={{background:"linear-gradient(135deg,var(--gold),var(--gold2))",color:"#171006"}}>{cobro.length}</span></div><div className="list">{cobro.map((c)=><CallRow key={c.id} call={c} state={state} actor={actor} staffId={staffId}/>)}</div></div>}
    <div className="two">
      <div className="panel"><div className="panel-head"><h2>Llamados de mesa</h2><span className="badge">Cliente QR</span></div><div className="list">{mesa.length ? mesa.map((c)=><CallRow key={c.id} call={c} state={state} actor={actor}/>) : <div style={{color:"var(--dim)",fontSize:13,padding:"8px 0"}}>Sin llamados activos.</div>}</div></div>
      <div className="panel"><div className="panel-head"><h2>Llamados de cocina</h2><span className="badge red">Cocina</span></div><div className="list">{cocina.length ? cocina.map((c)=><CallRow key={c.id} call={c} state={state} actor={actor}/>) : <div style={{color:"var(--dim)",fontSize:13,padding:"8px 0"}}>Sin llamados activos.</div>}</div></div>
    </div>
  </div>;
}

function CallRow({ call, state, actor, staffId }) {
  const [cobrarOpen, setCobrarOpen] = useState(false);
  const [attended, setAttended] = useState(false);
  const isCobro = call.type === "Cuenta" || call.type === "Solicita cobro";
  const table = isCobro ? state.tables.find((t) => t.id === call.table) : null;
  const isResuelto = attended || call.status === "Resuelto";

  const handleAtender = async () => {
    setAttended(true);
    await state.attendCall(call.id, actor);
  };

  return (
    <>
      <div className="row">
        <span className={`badge ${statusBadge(call.priority)}`}>Mesa {call.table}</span>
        <div className="row-main">
          <b>{call.type}</b>
          <small>{call.text} · {call.age} · {getStaff(call.waiterId).name}</small>
          <small style={{ color: isResuelto ? "var(--green, #4caf50)" : "var(--muted)" }}>
            {isResuelto ? "✓ Resuelto" : call.status}
          </small>
        </div>
        {!isResuelto && (
          isCobro && table
            ? <button className="btn primary" style={{ background: "linear-gradient(135deg,var(--gold),var(--gold2))", color: "#160f02" }} onClick={() => setCobrarOpen(true)}>Cobrar</button>
            : <button className="btn primary" onClick={handleAtender}>Atender</button>
        )}
      </div>
      {cobrarOpen && table && (
        <CobrarModal table={table} callId={call.id} state={state} staffId={staffId} onClose={() => setCobrarOpen(false)} />
      )}
    </>
  );
}

function MessagesView({ role, staffId, state }) {
  const visible = state.messages.filter((m) => role === "admin" || m.waiterId === staffId);
  const actor = getStaff(staffId).name;
  return <div className="grid"><div className="panel"><div className="panel-head"><h2>Lo que el cliente escribe o pide</h2><span className="badge purple">Colaboración</span></div><p>Admin puede colaborar cuando un camarero está ocupado. Cada resolución queda asociada al usuario que la atiende.</p><div className="three">{visible.map((m)=><MessageCard key={m.id} msg={m} state={state} actor={actor} />)}</div></div></div>;
}

function MessageCard({ msg, state, actor, compact = false }) {
  return <article className={`message-card ${msg.status === "urgente" ? "urgent" : ""}`}><div className="message-top"><div><b>Mesa {msg.table}</b><small style={{display:"block",color:"var(--muted)",marginTop:4}}>{msg.type} · {msg.time} · {getStaff(msg.waiterId).name}</small></div><span className={`badge ${msg.status === "urgente" ? "red" : msg.status === "resuelto" ? "green" : ""}`}>{msg.status}</span></div><blockquote>{msg.text}</blockquote>{!compact && <div style={{display:"flex",gap:8,marginTop:12}}><button className="btn primary" onClick={()=>state.resolveMessage(msg.id, actor)}>Responder/Resolver</button><button className="btn ghost">Asignar</button></div>}</article>;
}

// Kitchen reads and writes the same shared order state as the table app, the
// cashier and the waiters, so a status change is visible everywhere at once.
function KitchenView({ state }) {
  const orders = state.orders;
  const advance = (id, nextUiStatus) => state.updateOrderStatus(id, nextUiStatus);

  const columns = {
    received: orders.filter((o) => o.status.includes("Recibido")),
    preparing: orders.filter((o) => o.status.includes("Preparando") || o.status.includes("Cocina")),
    ready: orders.filter((o) => o.status.includes("Listo")),
    delivered: orders.filter((o) => o.status.includes("Servido")),
  };
  const nextStatus = { received: "Preparando", preparing: "Listo para servir", ready: "Servido" };
  const readyCount = columns.ready.length;

  return (
    <div className="grid">
      {readyCount > 0 && (
        <div style={{ background: "linear-gradient(135deg,rgba(52,211,153,.18),rgba(52,211,153,.06))", border: "1px solid rgba(52,211,153,.35)", borderRadius: 18, padding: "14px 18px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>🔔</span>
          <div><b style={{ color: "#34d399", fontSize: 16 }}>{readyCount} plato{readyCount > 1 ? "s" : ""} listo{readyCount > 1 ? "s" : ""} para servir</b><div style={{ color: "#bfae9d", fontSize: 13, marginTop: 2 }}>Avisar al camarero para llevar a la mesa</div></div>
        </div>
      )}
      <div className="panel">
        <div className="panel-head"><div><h2>Pantalla cocina</h2><p style={{ margin: "4px 0 0" }}>Mismo flujo que ven mesa, caja y camareros</p></div><span className="badge red">LIVE</span></div>
        <div className="kitchen-board">
          {Object.entries(KITCHEN_COLUMNS).map(([key, label]) => (
            <div className="kitchen-col" key={key}>
              <div className="panel-head"><h2 style={{ fontSize: 22 }}>{label}</h2><span className={`badge ${key === "ready" && columns[key].length ? "green" : ""}`}>{columns[key].length}</span></div>
              {columns[key].length === 0 && <div style={{ color: "var(--dim)", fontSize: 13, marginTop: 8, textAlign: "center" }}>Sin pedidos</div>}
              {columns[key].map((o) => (
                <div className="kitchen-ticket" key={o.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <h4>{o.id}</h4>
                    <span style={{ color: "var(--gold2)", fontWeight: 900, fontSize: 18 }}>Mesa {o.table}</span>
                  </div>
                  <div className="dish-lines" style={{ margin: "8px 0" }}>
                    {o.items.map((i, idx) => <div className="dish-line" key={idx}><span>{i.qty}× {i.dish}</span></div>)}
                  </div>
                  {o.notes && <p style={{ color: "var(--gold2)", fontSize: 12, margin: "6px 0", background: "rgba(217,164,65,.1)", borderRadius: 8, padding: "4px 8px" }}>📝 {o.notes}</p>}
                  {nextStatus[key] && (
                    <button className="btn primary" style={{ width: "100%", marginTop: 10 }} onClick={() => advance(o.id, nextStatus[key])}>
                      {nextStatus[key]}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CashCloseReport({ session, userId }) {
  const user = getStaff(userId || session.currentUser);
  return <div className="close-report"><h2>Cierre de caja</h2><div className="muted2">{RESTAURANT.legalName} · RUT {RESTAURANT.rut}<br />Turno {session.activeTurn} · Responsable {user.name}<br />Apertura {session.openedAt} · Cierre {session.closedAt || "pendiente"}</div><div className="report-grid"><div className="report-box"><span>Fondo inicial</span><b>{money(session.openingCash)}</b></div><div className="report-box"><span>Efectivo</span><b>{money(session.cash)}</b></div><div className="report-box"><span>Tarjeta</span><b>{money(session.card)}</b></div><div className="report-box"><span>Transferencia</span><b>{money(session.transfer)}</b></div><div className="report-box"><span>Propinas</span><b>{money(session.tips)}</b></div><div className="report-box"><span>Gastos</span><b>{money(session.expenses)}</b></div><div className="report-box"><span>Total esperado</span><b>{money(session.expected)}</b></div><div className="report-box"><span>Diferencia</span><b>{money(session.difference)}</b></div></div><h3>Historial del turno</h3>{session.history.slice(0,6).map((h,idx)=><div className="receipt-row" key={idx}><span>{h.time} · {getStaff(h.userId).name}</span><b>{h.action}</b></div>)}<div className="signature-line">Firma responsable: {user.name}</div></div>;
}

function CashClosingView({ state, staffId }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [turn, setTurn] = useState(state.cashSession.activeTurn);
  const [openingCash, setOpeningCash] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const session = state.cashSession;
  const diffOk = session.difference === 0;
  const responsible = getStaff(session.currentUser);
  const whatsappText = encodeURIComponent(`Cierre de caja ${RESTAURANT.name}
Turno: ${session.activeTurn}
Responsable: ${responsible.name}
Efectivo: ${money(session.cash)}
Tarjeta: ${money(session.card)}
Transferencia: ${money(session.transfer)}
Propinas: ${money(session.tips)}
Diferencia: ${money(session.difference)}`);
  const whatsappUrl = `https://wa.me/?text=${whatsappText}`;
  const downloadReport = () => {
    const text = `CIERRE DE CAJA - ${RESTAURANT.name}
Turno: ${session.activeTurn}
Responsable: ${responsible.name}
Estado: ${session.status}
Efectivo: ${money(session.cash)}
Tarjeta: ${money(session.card)}
Transferencia: ${money(session.transfer)}
Propinas: ${money(session.tips)}
Gastos: ${money(session.expenses)}
Esperado: ${money(session.expected)}
Contado: ${money(session.counted)}
Diferencia: ${money(session.difference)}`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cierre-caja-${session.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return <div className="grid"><div className="shift-banner"><div><h2 style={{margin:0,fontFamily:"Playfair Display",fontSize:30}}>Caja {session.status}</h2><p style={{margin:"6px 0 0",color:"var(--muted)"}}>Turno {session.activeTurn} · Responsable actual: {responsible.name} · Apertura {session.openedAt}</p></div><div className="shift-actions">{session.status !== "abierta"
      ? <><input className="input" style={{width:150}} type="number" min="0" placeholder="Fondo inicial" value={openingCash} onChange={(e)=>setOpeningCash(e.target.value)} /><button className="btn primary" onClick={()=>state.openCash(staffId, Number(openingCash)||0, turn)}>Abrir caja</button></>
      : <><button className="btn ghost" onClick={()=>state.closeTurn(staffId)}>Cerrar turno</button><input className="input" style={{width:150}} type="number" min="0" placeholder="Efectivo contado" value={countedCash} onChange={(e)=>setCountedCash(e.target.value)} /><button className="btn danger" onClick={()=>{ if(window.confirm("¿Cerrar la caja de este turno?")) state.closeCash(staffId, countedCash === "" ? null : Number(countedCash)); }}>Cerrar caja</button></>}</div></div><div className="panel"><div className="panel-head"><div><h2>Cambio de turno</h2><p style={{margin:"4px 0 0"}}>Cada acción queda asociada al usuario responsable.</p></div><span className={`badge ${session.status === "abierta" ? "green" : "red"}`}>{session.status}</span></div><div className="form-grid"><div className="field"><label>Turno activo</label><select className="input" value={turn} onChange={(e)=>setTurn(e.target.value)}><option>Día</option><option>Noche</option><option>Full</option></select></div><div className="field"><label>Responsable</label><select className="input" value={staffId} disabled><option>{getStaff(staffId).name}</option></select></div></div><button className="btn primary" style={{marginTop:12}} onClick={()=>state.changeTurn(staffId, turn)}>Cambiar turno</button></div><ExpenseRegister state={state} staffId={staffId} /><div className="panel"><div className="panel-head"><div><h2>Cierre de caja</h2><p style={{margin:"4px 0 0"}}>Control diario de ventas, propinas y diferencias de caja.</p></div><span className={`badge ${diffOk ? "green" : "red"}`}>{diffOk ? "Cuadrado" : "Diferencia"}</span></div><div className="cash-grid"><div className="cash-card"><span>Efectivo</span><strong>{money(session.cash)}</strong></div><div className="cash-card"><span>Tarjeta</span><strong>{money(session.card)}</strong></div><div className="cash-card"><span>Transferencia</span><strong>{money(session.transfer)}</strong></div><div className="cash-card"><span>Propinas</span><strong>{money(session.tips)}</strong></div><div className="cash-card"><span>Gastos</span><strong>{money(session.expenses)}</strong></div></div></div><div className="two"><div className="panel"><div className="panel-head"><h2>Resumen final</h2><span className="badge blue">Caja</span></div><div className="list"><div className="row"><span className="badge">Esperado</span><div className="row-main"><b>Total esperado</b><small>Suma de ventas y métodos de pago</small></div><strong>{money(session.expected)}</strong></div><div className="row"><span className="badge green">Contado</span><div className="row-main"><b>Total contado</b><small>Conteo físico del turno</small></div><strong>{money(session.counted)}</strong></div><div className="row"><span className={`badge ${diffOk ? "green" : "red"}`}>Diferencia</span><div className="row-main"><b>Ajuste</b><small>Debe ser 0 para cierre correcto</small></div><strong>{money(session.difference)}</strong></div></div><div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}><button className="btn primary" onClick={()=>setReportOpen(true)}>Ver cierre</button><button className="btn ghost" onClick={()=>window.print()}>Imprimir</button><button className="btn ghost" onClick={downloadReport}>Descargar</button><button className="btn ghost" onClick={()=>setWhatsappOpen(true)}>WhatsApp</button></div></div><div className="panel"><div className="panel-head"><h2>Propinas registradas</h2><span className="badge">10%</span></div><div className="list">{state.tables.filter((t)=>t.bill > 0).map((t)=><div className="row" key={t.id}><span className={`badge ${t.tipAccepted ? "green" : "red"}`}>Mesa {t.id}</span><div className="row-main"><b>{getStaff(t.waiterId).name}</b><small>{t.tipAccepted ? "Cliente aceptó propina" : "Cliente rechazó propina"}</small></div><strong>{money(t.tipAmount)}</strong></div>)}</div></div></div><div className="panel"><div className="panel-head"><h2>Historial de caja/turno</h2><span className="badge purple">Auditoría</span></div><div className="list">{session.history.map((h,idx)=><div className="row" key={idx}><span className="badge">{h.time}</span><div className="row-main"><b>{h.action}</b><small>{h.detail}</small></div><strong>{getStaff(h.userId).name}</strong></div>)}</div></div>{reportOpen && <div className="modal-backdrop"><div className="modal"><div className="panel-head"><h2>Reporte de cierre</h2><button className="btn ghost" onClick={()=>setReportOpen(false)}>Cerrar</button></div><CashCloseReport session={session} userId={staffId} /><div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14}}><button className="btn ghost" onClick={downloadReport}>Descargar</button><button className="btn ghost" onClick={()=>setWhatsappOpen(true)}>WhatsApp</button><button className="btn primary" onClick={()=>window.print()}>Imprimir</button></div></div></div>}{whatsappOpen && <div className="modal-backdrop"><div className="modal"><div className="panel-head"><h2>Enviar cierre por WhatsApp</h2><button className="btn ghost" onClick={()=>setWhatsappOpen(false)}>Cerrar</button></div><div className="whatsapp-card"><b>Mensaje listo para enviar</b><p style={{color:"var(--muted)",lineHeight:1.5}}>Se enviará resumen del cierre, responsable, métodos de pago, propinas y diferencia.</p><a className="btn primary" style={{display:"inline-block",textDecoration:"none"}} href={whatsappUrl} target="_blank" rel="noreferrer">Abrir WhatsApp</a></div></div></div>}</div>;
}

function ExpenseRegister({ state, staffId }) {
  const [form, setForm] = useState({ type: "Caja", detail: "", amount: "", userId: staffId });
  const submit = () => {
    if (!form.detail.trim() || !Number(form.amount)) return alert("Detalle y monto son requeridos");
    state.addExpense({ ...form, amount: Number(form.amount), userId: staffId });
    setForm({ type: "Caja", detail: "", amount: "", userId: staffId });
  };
  return <div className="panel"><div className="panel-head"><div><h2>Gastos del turno</h2><p style={{margin:"4px 0 0"}}>Todo gasto queda asociado al usuario responsable y afecta cierre de caja.</p></div><span className="badge red">Egresos</span></div><div className="form-grid"><div className="field"><label>Tipo</label><select className="input" value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})}><option>Caja</option><option>Proveedor</option><option>Emergencia</option><option>Operativo</option></select></div><div className="field"><label>Monto</label><input className="input" type="number" value={form.amount} onChange={(e)=>setForm({...form,amount:e.target.value})} /></div><div className="field" style={{gridColumn:"1/-1"}}><label>Detalle</label><input className="input" value={form.detail} onChange={(e)=>setForm({...form,detail:e.target.value})} placeholder="Ej: compra hielo, reposición pan..." /></div></div><button className="btn primary" style={{marginTop:12}} onClick={submit}>Registrar gasto</button><div className="list" style={{marginTop:14}}>{state.expenses.map((e)=><div className="row" key={e.id}><span className="badge red">{e.type}</span><div className="row-main"><b>{e.detail}</b><small>{e.time} · {getStaff(e.userId).name}</small></div><strong>{money(e.amount)}</strong></div>)}</div></div>;
}

function SalesView() {
  const [period, setPeriod] = useState("day");
  const current = SALES_PERIODS[period];
  const total = MENU_SALES.reduce((s, d) => s + d.revenue, 0);
  const max = Math.max(...MENU_SALES.map((d) => d.revenue));
  return <div className="grid"><div className="panel"><div className="panel-head"><div><h2>Ventas por periodo</h2><p style={{margin:"4px 0 0"}}>Incluye control explícito de propina 10% aceptada o rechazada.</p></div><div className="period-switch">{Object.entries(SALES_PERIODS).map(([key,p])=><button key={key} className={period===key?"on":""} onClick={()=>setPeriod(key)}>{p.label}</button>)}</div></div><div className="sales-split"><div className="sales-mini"><span>Ventas {current.label.toLowerCase()}</span><strong>{money(current.sales)}</strong></div><div className="sales-mini"><span>Propina 10%</span><strong>{money(current.tips)}</strong></div><div className="sales-mini"><span>Tickets</span><strong>{current.tickets}</strong></div><div className="sales-mini"><span>Ticket promedio</span><strong>{money(current.avgTicket)}</strong></div></div></div><div className="kpis"><div className="kpi"><span>Ventas platos</span><strong>{money(total)}</strong><small>Acumulado del servicio</small></div><div className="kpi"><span>Plato top</span><strong>{MENU_SALES[0].sold}</strong><small>{MENU_SALES[0].dish}</small></div><div className="kpi"><span>Propina registrada</span><strong>{money(current.tips)}</strong><small>Separada de ventas</small></div><div className="kpi"><span>Stock bajo</span><strong>{MENU_SALES.filter((d)=>d.stock === "Bajo").length}</strong><small>Revisar cocina</small></div></div><div className="panel"><div className="panel-head"><h2>Registro de ventas por plato</h2><span className="badge green">Admin</span></div><div className="chart">{MENU_SALES.map((d)=><div className="bar" key={d.id}><b>{d.dish}</b><div className="bar-track"><div className="bar-fill" style={{width:`${Math.max(8, d.revenue / max * 100)}%`}} /></div><span className="price">{money(d.revenue)}</span></div>)}</div></div><div className="panel"><div className="panel-head"><h2>Detalle de platos</h2></div><div className="list">{MENU_SALES.map((d)=><div className="row" key={d.id}><span className={`badge ${d.stock === "Bajo" ? "red" : "green"}`}>{d.stock}</span><div className="row-main"><b>{d.dish}</b><small>{d.category} · vendidos: {d.sold} · prep promedio: {d.avgPrep} min</small></div><strong>{money(d.revenue)}</strong></div>)}</div></div></div>;
}

function InventoryView({ state }) {
  const authToken = state.authToken;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const EMPTY_FORM = { name: "", category: "Ingrediente", stock: "", unit: "kg", min_stock: "", cost_price: "" };
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchItems = async () => {
    try {
      const rows = await supaFetch(`inventory?restaurant_id=eq.${getRestaurantId()}&order=name.asc`, {}, authToken);
      if (Array.isArray(rows)) setItems(rows);
    } catch (e) {
      console.error("[holu inventory] fetch:", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const minOf = (item) => item.min_stock ?? item.min ?? 0;
  const isLow = (item) => Number(item.stock) <= Number(minOf(item));

  const saveNew = async () => {
    if (!form.name.trim()) return setErr("Nombre requerido");
    setSaving(true); setErr("");
    try {
      await supaFetch(`inventory`, {
        method: "POST",
        body: JSON.stringify({
          restaurant_id: getRestaurantId(),
          name: form.name.trim(),
          category: form.category,
          stock: Number(form.stock) || 0,
          unit: form.unit || "unidades",
          min_stock: Number(form.min_stock) || 0,
          cost_price: Number(form.cost_price) || 0,
        }),
      }, authToken);
      setAdding(false);
      setForm(EMPTY_FORM);
      await fetchItems();
    } catch (e) {
      setErr(e.message.slice(0, 160));
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (item) => {
    setSaving(true);
    try {
      await supaFetch(`inventory?id=eq.${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: item.name,
          category: item.category,
          stock: Number(item.stock) || 0,
          unit: item.unit,
          min_stock: Number(minOf(item)) || 0,
          cost_price: Number(item.cost_price) || 0,
        }),
      }, authToken);
      setEditingId(null);
      await fetchItems();
    } catch (e) {
      console.error("[holu inventory] patch:", e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id, name) => {
    if (!window.confirm(`¿Eliminar "${name}"?`)) return;
    try {
      await supaFetch(`inventory?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", prefer: "return=minimal" }, authToken);
      setItems((rows) => rows.filter((r) => r.id !== id));
    } catch (e) {
      console.error("[holu inventory] delete:", e.message);
    }
  };

  const updateField = (id, key, value) => {
    setItems((rows) => rows.map((r) => r.id === id ? { ...r, [key]: value } : r));
  };

  const low = items.filter(isLow);
  const CATEGORIES = ["Ingrediente", "Carne", "Pescado", "Vegetal", "Lácteo", "Bar", "Postre", "Limpieza", "Otro"];
  const UNITS = ["kg", "g", "litros", "ml", "unidades", "botellas", "cajas", "porciones"];

  return (
    <div className="grid">
      <div className="kpis">
        <div className="kpi"><span>Ingredientes</span><strong>{items.length}</strong><small>En inventario</small></div>
        <div className="kpi"><span>Stock bajo</span><strong>{low.length}</strong><small>Bajo mínimo</small></div>
        <div className="kpi"><span>Costo promedio</span><strong>{items.length ? money(Math.round(items.reduce((s, i) => s + (Number(i.cost_price) || 0), 0) / items.length)) : "—"}</strong><small>Por ítem</small></div>
        <div className="kpi"><span>Actualización</span><strong>Live</strong><small>Supabase</small></div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Inventario</h2>
            <p style={{ margin: "4px 0 0" }}>Ingredientes con precio de costo. Agrega, edita o elimina lo que necesites.</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {low.length > 0 && <span className="badge red">{low.length} bajo</span>}
            <button className="btn primary" onClick={() => { setAdding(true); setErr(""); }}>+ Agregar</button>
          </div>
        </div>

        {adding && (
          <div className="config-card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 12px", fontFamily: "'Playfair Display',serif" }}>Nuevo ingrediente</h3>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: "1/-1" }}>
                <label>Nombre</label>
                <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Pasta fresca" autoFocus />
              </div>
              <div className="field">
                <label>Categoría</label>
                <select className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Unidad</label>
                <select className="input" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Stock actual</label>
                <input className="input" type="number" min="0" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} placeholder="0" />
              </div>
              <div className="field">
                <label>Stock mínimo</label>
                <input className="input" type="number" min="0" value={form.min_stock} onChange={(e) => setForm((f) => ({ ...f, min_stock: e.target.value }))} placeholder="0" />
              </div>
              <div className="field" style={{ gridColumn: "1/-1" }}>
                <label>Precio costo (por unidad)</label>
                <input className="input" type="number" min="0" value={form.cost_price} onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))} placeholder="0" />
              </div>
            </div>
            {err && <p style={{ color: "var(--red2)", margin: "8px 0 0", fontSize: 13 }}>{err}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn primary" onClick={saveNew} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
              <button className="btn ghost" onClick={() => { setAdding(false); setErr(""); setForm(EMPTY_FORM); }}>Cancelar</button>
            </div>
          </div>
        )}

        {loading && <p style={{ color: "var(--muted)", textAlign: "center", padding: "24px 0" }}>Cargando inventario...</p>}
        {!loading && items.length === 0 && !adding && (
          <p style={{ color: "var(--muted)", textAlign: "center", padding: "24px 0" }}>Sin ingredientes. Usa "+ Agregar" para crear el primero.</p>
        )}

        <div className="list">
          {items.map((item) => {
            const low = isLow(item);
            const editing = editingId === item.id;
            if (editing) {
              return (
                <div key={item.id} className="config-card" style={{ marginBottom: 10 }}>
                  <div className="form-grid">
                    <div className="field" style={{ gridColumn: "1/-1" }}>
                      <label>Nombre</label>
                      <input className="input" value={item.name} onChange={(e) => updateField(item.id, "name", e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Categoría</label>
                      <select className="input" value={item.category || "Ingrediente"} onChange={(e) => updateField(item.id, "category", e.target.value)}>
                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Unidad</label>
                      <select className="input" value={item.unit || "unidades"} onChange={(e) => updateField(item.id, "unit", e.target.value)}>
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Stock actual</label>
                      <input className="input" type="number" min="0" value={item.stock ?? ""} onChange={(e) => updateField(item.id, "stock", e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Stock mínimo</label>
                      <input className="input" type="number" min="0" value={minOf(item)} onChange={(e) => updateField(item.id, "min_stock", e.target.value)} />
                    </div>
                    <div className="field" style={{ gridColumn: "1/-1" }}>
                      <label>Precio costo (por unidad)</label>
                      <input className="input" type="number" min="0" value={item.cost_price ?? ""} onChange={(e) => updateField(item.id, "cost_price", e.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button className="btn primary" onClick={() => saveEdit(item)} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
                    <button className="btn ghost" onClick={() => { setEditingId(null); fetchItems(); }}>Cancelar</button>
                  </div>
                </div>
              );
            }
            return (
              <div className={`row ${low ? "inventory-low" : ""}`} key={item.id}>
                <span className={`badge ${low ? "red" : "green"}`}>{low ? "Bajo" : "OK"}</span>
                <div className="row-main">
                  <b>{item.name}</b>
                  <small>{item.category} · stock: {item.stock} {item.unit} · mínimo: {minOf(item)} {item.unit}</small>
                  <small style={{ color: "var(--gold2)" }}>Costo: {money(item.cost_price || 0)} / {item.unit}</small>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn ghost" onClick={() => setEditingId(item.id)}>Editar</button>
                  <button className="btn danger" onClick={() => deleteItem(item.id, item.name)}>Eliminar</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function QRCard({ q, onToggle, onRegenerate, onDelete }) {
  const canvasRef = useRef(null);
  const qrUrl = `${MESA_URL || window.location.origin}/?qr=${q.token}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, qrUrl, {
      width: 200, margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(() => {});
  }, [qrUrl]);

  const downloadPng = () => {
    const a = document.createElement("a");
    a.download = `qr-mesa-${q.table}.png`;
    a.href = canvasRef.current.toDataURL("image/png");
    a.click();
  };

  const printQr = () => {
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>QR Mesa ${q.table}</title>
      <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#fff;color:#111}
      h2{margin:0 0 4px;font-size:22px}p{margin:4px 0;font-size:12px;color:#555}img{width:240px;height:240px;margin:16px 0}
      .url{font-size:11px;word-break:break-all;max-width:260px;text-align:center;color:#333}</style></head>
      <body><h2>Mesa ${q.table}</h2><p>${q.zone}</p><img src="${dataUrl}" /><p class="url">${qrUrl}</p>
      <script>window.onload=()=>{window.print()}<\/script></body></html>`);
    win.document.close();
  };

  return (
    <div className="qr-card-admin">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Mesa {q.table}</h3>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span className={`badge ${q.active ? "green" : "red"}`}>{q.active ? "Activo" : "Inactivo"}</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", background: "#fff", borderRadius: 14, padding: 10, margin: "0 0 12px" }}>
        <canvas ref={canvasRef} style={{ borderRadius: 8 }} />
      </div>
      <div className="meta" style={{ marginBottom: 4 }}><span>Zona</span><b>{q.zone}</b></div>
      <div className="meta" style={{ marginBottom: 4 }}><span>Token</span><b style={{ fontSize: 11, letterSpacing: ".06em" }}>{q.token}</b></div>
      <p style={{ color: "var(--muted)", fontSize: 11, wordBreak: "break-all", margin: "0 0 12px", lineHeight: 1.4 }}>{qrUrl}</p>
      <div style={{ display: "grid", gap: 8 }}>
        <div className="table-actions">
          <button className="btn ghost" onClick={downloadPng}>Descargar PNG</button>
          <button className="btn primary" onClick={printQr}>Imprimir QR</button>
        </div>
        <div className="table-actions">
          <button className="btn ghost" onClick={onToggle}>{q.active ? "Desactivar" : "Activar"}</button>
          <button className="btn ghost" onClick={onRegenerate}>Regenerar token</button>
        </div>
        <button className="btn danger" style={{ width: "100%" }} onClick={onDelete}>Eliminar mesa</button>
      </div>
    </div>
  );
}

function QRView({ state }) {
  const authToken = state.authToken;
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTable, setNewTable] = useState({ table_number: "", zone: "Salón" });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const fetchTables = async () => {
    try {
      const rows = await supaFetch(
        `tables?restaurant_id=eq.${getRestaurantId()}&select=id,table_number,qr_token,zone&order=table_number.asc`,
        {}, authToken
      );
      if (Array.isArray(rows)) {
        setTables(rows.map((r) => ({
          dbId: r.id,
          table: r.table_number,
          token: r.qr_token,
          zone: r.zone || "Salón",
          active: true,
        })));
      }
    } catch (e) {
      console.error("[holu qr] fetch tables:", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTables(); }, []);

  const genToken = (num) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `M${num}${suffix}`;
  };

  const addTable = async () => {
    const num = parseInt(newTable.table_number);
    if (!num || num < 1) return setFormErr("Número de mesa requerido (mínimo 1)");
    if (tables.some((t) => t.table === num)) return setFormErr(`Mesa ${num} ya existe`);
    setSaving(true); setFormErr("");
    try {
      await supaFetch(`tables`, {
        method: "POST",
        body: JSON.stringify({ table_number: num, qr_token: genToken(num), zone: newTable.zone, restaurant_id: getRestaurantId() }),
      }, authToken);
      setAdding(false);
      setNewTable({ table_number: "", zone: "Salón" });
      await fetchTables();
    } catch (e) {
      setFormErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTable = async (dbId, tableNum) => {
    if (!window.confirm(`¿Eliminar Mesa ${tableNum}? Los QR impresos dejarán de funcionar.`)) return;
    try {
      await supaFetch(`tables?id=eq.${dbId}`, { method: "DELETE", prefer: "return=minimal" }, authToken);
      setTables((rows) => rows.filter((t) => t.dbId !== dbId));
    } catch (e) {
      console.error("[holu qr] delete:", e.message);
    }
  };

  const regenerateToken = async (dbId, tableNum) => {
    const token = genToken(tableNum);
    try {
      await supaFetch(`tables?id=eq.${dbId}`, {
        method: "PATCH",
        body: JSON.stringify({ qr_token: token }),
      }, authToken);
      setTables((rows) => rows.map((t) => t.dbId === dbId ? { ...t, token } : t));
    } catch (e) {
      console.error("[holu qr] regen:", e.message);
    }
  };

  const toggleActive = (dbId) => {
    setTables((rows) => rows.map((t) => t.dbId === dbId ? { ...t, active: !t.active } : t));
  };

  return (
    <div className="grid">
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>QR de mesas</h2>
            <p style={{ margin: "4px 0 0" }}>Mesas sincronizadas con Supabase. Agrega, elimina o regenera tokens sin tocar código.</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="badge blue">{tables.length} mesas</span>
            <button className="btn primary" onClick={() => { setAdding(true); setFormErr(""); }}>+ Nueva mesa</button>
          </div>
        </div>
        {adding && (
          <div className="config-card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 12px", fontFamily: "'Playfair Display',serif" }}>Nueva mesa</h3>
            <div className="form-grid">
              <div className="field">
                <label>Número de mesa</label>
                <input className="input" type="number" min="1" value={newTable.table_number}
                  onChange={(e) => setNewTable((n) => ({ ...n, table_number: e.target.value }))}
                  placeholder="Ej: 10" autoFocus />
              </div>
              <div className="field">
                <label>Zona</label>
                <select className="input" value={newTable.zone}
                  onChange={(e) => setNewTable((n) => ({ ...n, zone: e.target.value }))}>
                  {["Salón", "Terraza", "Bar", "VIP", "Privado", "Interior", "Exterior"].map((z) => <option key={z}>{z}</option>)}
                </select>
              </div>
            </div>
            {formErr && <p style={{ color: "var(--red2)", margin: "8px 0 0", fontSize: 13 }}>{formErr}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn primary" onClick={addTable} disabled={saving}>{saving ? "Guardando..." : "Crear mesa"}</button>
              <button className="btn ghost" onClick={() => { setAdding(false); setFormErr(""); }}>Cancelar</button>
            </div>
          </div>
        )}
        {loading && <p style={{ color: "var(--muted)", textAlign: "center", padding: "24px 0" }}>Cargando mesas...</p>}
        {!loading && tables.length === 0 && !adding && (
          <p style={{ color: "var(--muted)", textAlign: "center", padding: "24px 0" }}>No hay mesas configuradas. Usa "+ Nueva mesa" para agregar la primera.</p>
        )}
        <div className="three">
          {tables.map((q) => (
            <QRCard
              key={q.dbId}
              q={q}
              onToggle={() => toggleActive(q.dbId)}
              onRegenerate={() => regenerateToken(q.dbId, q.table)}
              onDelete={() => deleteTable(q.dbId, q.table)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StaffView({ state }) {
  const authToken = state?.authToken;
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const EMPTY_FORM = { name: "", role: "camarero", shift: "", pin_hash: "", status: "Activo" };
  const [form, setForm] = useState(EMPTY_FORM);
  const ROLES = ["camarero", "cocina", "caja"];
  const ROLE_LABELS = { camarero: "Camarero", cocina: "Cocina", caja: "Caja" };
  const ROLE_COLORS = { camarero: "linear-gradient(135deg,var(--gold),var(--gold2))", cocina: "linear-gradient(135deg,#ef4444,#fca5a5)", caja: "linear-gradient(135deg,#60a5fa,#93c5fd)" };

  const fetchStaff = async () => {
    try {
      const rows = await supaFetch(`staff?restaurant_id=eq.${getRestaurantId()}&role=neq.admin&order=name.asc`, {}, authToken);
      if (Array.isArray(rows)) setStaff(rows);
    } catch (e) {
      console.error("[holu staff] fetch:", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStaff(); }, []);

  const saveNew = async () => {
    if (!form.name.trim()) return setErr("Nombre requerido");
    if (!form.pin_hash.trim() || form.pin_hash.length < 4) return setErr("PIN mínimo 4 dígitos");
    setSaving(true); setErr("");
    try {
      await supaFetch(`staff`, {
        method: "POST",
        body: JSON.stringify({ restaurant_id: getRestaurantId(), name: form.name.trim(), role: form.role, shift: form.shift.trim() || null, pin_hash: form.pin_hash.trim(), status: "Activo" }),
      }, authToken);
      setAdding(false); setForm(EMPTY_FORM);
      await fetchStaff();
    } catch (e) { setErr(e.message.slice(0, 160)); } finally { setSaving(false); }
  };

  const saveEdit = async (item) => {
    setSaving(true);
    try {
      await supaFetch(`staff?id=eq.${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ name: item.name, role: item.role, shift: item.shift || null, pin_hash: item.pin_hash, status: item.status }),
      }, authToken);
      setEditingId(null); await fetchStaff();
    } catch (e) { console.error("[holu staff] patch:", e.message); } finally { setSaving(false); }
  };

  const deleteStaff = async (id, name) => {
    if (!window.confirm(`¿Eliminar a "${name}"?`)) return;
    try {
      await supaFetch(`staff?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", prefer: "return=minimal" }, authToken);
      setStaff((rows) => rows.filter((r) => r.id !== id));
    } catch (e) { console.error("[holu staff] delete:", e.message); }
  };

  const updateField = (id, key, value) => setStaff((rows) => rows.map((r) => r.id === id ? { ...r, [key]: value } : r));

  return (
    <div className="grid">
      <div className="kpis">
        <div className="kpi"><span>Empleados</span><strong>{staff.length}</strong><small>Registrados en sistema</small></div>
        <div className="kpi"><span>Activos</span><strong>{staff.filter((s) => s.status === "Activo").length}</strong><small>Disponibles ahora</small></div>
        <div className="kpi"><span>Camareros</span><strong>{staff.filter((s) => s.role === "camarero").length}</strong><small>Asignados a mesas</small></div>
        <div className="kpi"><span>Acceso</span><strong>PIN</strong><small>4 dígitos por empleado</small></div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <div><h2>Gestión de empleados</h2><p style={{ margin: "4px 0 0" }}>Crea usuarios para camareros, cocina y caja. Cada uno entra con su PIN, no con el correo de admin.</p></div>
          <button className="btn primary" onClick={() => { setAdding(true); setErr(""); }}>+ Nuevo empleado</button>
        </div>
        {adding && (
          <div className="config-card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 12px", fontFamily: "'Playfair Display',serif" }}>Nuevo empleado</h3>
            <div className="form-grid">
              <div className="field"><label>Nombre</label><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: María" autoFocus /></div>
              <div className="field"><label>Rol</label><select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></div>
              <div className="field"><label>PIN (4 dígitos)</label><input className="input" type="text" inputMode="numeric" maxLength={6} value={form.pin_hash} onChange={(e) => setForm((f) => ({ ...f, pin_hash: e.target.value.replace(/\D/g, "") }))} placeholder="Ej: 1234" /></div>
              <div className="field"><label>Turno</label><input className="input" value={form.shift} onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))} placeholder="Ej: 18:00–00:00" /></div>
            </div>
            {err && <p style={{ color: "var(--red2)", margin: "8px 0 0", fontSize: 13 }}>{err}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn primary" onClick={saveNew} disabled={saving}>{saving ? "Guardando..." : "Crear empleado"}</button>
              <button className="btn ghost" onClick={() => { setAdding(false); setErr(""); setForm(EMPTY_FORM); }}>Cancelar</button>
            </div>
          </div>
        )}
        {loading && <p style={{ color: "var(--muted)", textAlign: "center", padding: "24px 0" }}>Cargando empleados...</p>}
        {!loading && staff.length === 0 && !adding && (
          <div style={{ color: "var(--muted)", textAlign: "center", padding: "32px 0" }}>
            <p>Aún no hay empleados. Usa "+ Nuevo empleado" para agregar camareros, cocina o caja.</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Cada empleado entra con su PIN desde la pantalla de ingreso.</p>
          </div>
        )}
        <div className="list">
          {staff.map((s) => {
            if (editingId === s.id) return (
              <div key={s.id} className="config-card" style={{ marginBottom: 10 }}>
                <div className="form-grid">
                  <div className="field"><label>Nombre</label><input className="input" value={s.name} onChange={(e) => updateField(s.id, "name", e.target.value)} /></div>
                  <div className="field"><label>Rol</label><select className="input" value={s.role} onChange={(e) => updateField(s.id, "role", e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></div>
                  <div className="field"><label>PIN</label><input className="input" type="text" inputMode="numeric" maxLength={6} value={s.pin_hash || ""} onChange={(e) => updateField(s.id, "pin_hash", e.target.value.replace(/\D/g, ""))} placeholder="Nuevo PIN" /></div>
                  <div className="field"><label>Turno</label><input className="input" value={s.shift || ""} onChange={(e) => updateField(s.id, "shift", e.target.value)} /></div>
                  <div className="field"><label>Estado</label><select className="input" value={s.status} onChange={(e) => updateField(s.id, "status", e.target.value)}><option>Activo</option><option>Pausa</option><option>Fuera</option></select></div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button className="btn primary" onClick={() => saveEdit(s)} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
                  <button className="btn ghost" onClick={() => { setEditingId(null); fetchStaff(); }}>Cancelar</button>
                </div>
              </div>
            );
            return (
              <div className="row" key={s.id}>
                <div className="avatar" style={{ background: ROLE_COLORS[s.role] || "linear-gradient(135deg,var(--gold),var(--gold2))", color: "#171006", flexShrink: 0 }}>{(s.name || "?")[0].toUpperCase()}</div>
                <div className="row-main">
                  <b>{s.name}</b>
                  <small>{ROLE_LABELS[s.role] || s.role}{s.shift ? ` · ${s.shift}` : ""} · PIN: {"●".repeat(s.pin_hash?.length || 4)}</small>
                  <small style={{ color: s.status === "Activo" ? "var(--green)" : "var(--muted)" }}>{s.status}</small>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <span className={`badge ${s.status === "Activo" ? "green" : ""}`}>{ROLE_LABELS[s.role] || s.role}</span>
                  <button className="btn ghost" onClick={() => setEditingId(s.id)}>Editar</button>
                  <button className="btn danger" onClick={() => deleteStaff(s.id, s.name)}>Eliminar</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="panel">
        <h2>¿Cómo entran los empleados?</h2>
        <p style={{ color: "var(--muted)", margin: "8px 0 14px", lineHeight: 1.6 }}>En la pantalla de ingreso aparecen dos opciones: <b style={{ color: "var(--text)" }}>Administrador</b> (correo + contraseña) y <b style={{ color: "var(--text)" }}>Soy empleado</b> (solo PIN). Los empleados nunca usan el correo de admin. Si un PIN se pierde, edítalo desde esta sección.</p>
        <div className="demo-banner"><b>Seguridad</b><p style={{ color: "var(--muted)", margin: "6px 0 0" }}>El correo del restaurante es exclusivo del administrador. Los empleados ingresan solo con su PIN de 4 dígitos.</p></div>
      </div>
    </div>
  );
}

function MenuView({ state }) {
  const [editing, setEditing] = useState(null);
  const openNew = () => setEditing({ id: `dish-${Date.now()}`, dish: "", category: "Principales", description: "", price: 0, avgPrep: 15, stock: "OK", available: true, visibleClient: true, tags: "", imageUrl: "" });
  const visibleClient = state.menuItems.filter((d) => d.available && d.visibleClient);
  return <div className="grid"><div className="two"><div className="panel"><div className="panel-head"><div><h2>Carta operativa</h2><p style={{margin:"4px 0 0"}}>Admin crea/edita platos. Lo visible aparece en el sistema del cliente QR.</p></div><button className="btn primary" onClick={openNew}>Nuevo plato</button></div><div className="list">{state.menuItems.map((d)=><div className="row" key={d.id}><span className={`badge ${d.available ? "green" : "red"}`}>{d.available ? "Activo" : "Oculto"}</span><img className="dish-thumb" src={d.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=900&auto=format&fit=crop"} alt={d.dish} /><div className="row-main"><b>{d.dish}</b><small>{d.category} · {money(d.price)} · Prep {d.avgPrep} min · Tags: {d.tags || "—"}</small><small>{d.description}</small></div><div style={{display:"flex", gap:8, flexWrap:"wrap", justifyContent:"flex-end"}}><button className="btn ghost" onClick={()=>setEditing(d)}>Editar</button><button className="btn ghost" onClick={()=>state.toggleMenuAvailability(d.id)}>{d.available ? "Desactivar" : "Activar"}</button><button className="btn danger" onClick={()=>state.deleteMenuItem(d.id)}>Eliminar</button></div></div>)}</div></div><div className="panel"><div className="panel-head"><h2>Vista cliente QR</h2><span className="badge blue">Sincronizada</span></div><div className="preview-phone">{visibleClient.length ? visibleClient.map((d)=><div className="client-dish" key={d.id}><div style={{display:"flex", gap:12}}><img className="dish-thumb" src={d.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=900&auto=format&fit=crop"} alt={d.dish} /><div style={{flex:1}}><div style={{display:"flex", justifyContent:"space-between", gap:10}}><h4>{d.dish}</h4><b className="price">{money(d.price)}</b></div><p>{d.description}</p><small style={{color:"var(--gold2)",fontWeight:900}}>{d.category} · {d.avgPrep} min</small></div></div></div>) : <p style={{color:"var(--muted)"}}>No hay platos visibles para el cliente.</p>}</div></div></div>{editing && <MenuEditor item={editing} authToken={state.authToken} onClose={()=>setEditing(null)} onSave={(item)=>{ state.saveMenuItem(item); setEditing(null); }} />}</div>;
}

function MenuEditor({ item, onClose, onSave, authToken }) {
  const [form, setForm] = useState(item);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const fileRef = useRef(null);
  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadErr("");
    try {
      const url = await supaUploadImage(file, authToken || SUPABASE_ANON_KEY);
      update("imageUrl", url);
    } catch (err) {
      setUploadErr(err.message);
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    if (!form.dish.trim()) return alert("Nombre del plato requerido");
    if (!Number(form.price)) return alert("Precio requerido");
    onSave({ ...form, price: Number(form.price), avgPrep: Number(form.avgPrep || 0) });
  };

  const placeholder = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=900&auto=format&fit=crop";

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="panel-head">
          <div><h2>{item.dish ? "Editar plato" : "Nuevo plato"}</h2><p style={{ margin: "4px 0 0" }}>Estos datos alimentan la carta del cliente QR y la operación de cocina.</p></div>
          <button className="btn ghost" onClick={onClose}>Cerrar</button>
        </div>
        <div className="two" style={{ gridTemplateColumns: ".8fr 1.2fr", marginBottom: 12 }}>
          <div className="image-upload">
            <img className="dish-thumb big" src={form.imageUrl || placeholder} alt="Preview plato" />
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handleFile} />
            <button
              className={`btn ${uploading ? "ghost" : "primary"}`}
              style={{ width: "100%", marginTop: 10 }}
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Subiendo…" : "Subir foto desde dispositivo"}
            </button>
            {uploadErr && <small style={{ color: "var(--red2)", display: "block", marginTop: 6 }}>{uploadErr}</small>}
            {form.imageUrl && (
              <button className="btn ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => update("imageUrl", "")}>
                Quitar imagen
              </button>
            )}
            <div className="field" style={{ marginTop: 10 }}>
              <label>O pega URL directamente</label>
              <input className="input" value={form.imageUrl || ""} onChange={(e) => update("imageUrl", e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div>
            <div className="form-grid">
              <div className="field"><label>Nombre</label><input className="input" value={form.dish} onChange={(e) => update("dish", e.target.value)} placeholder="Ej: Ravioli al Limone" /></div>
              <div className="field"><label>Categoría</label><select className="input" value={form.category} onChange={(e) => update("category", e.target.value)}><option>Entradas</option><option>Principales</option><option>Postres</option><option>Bebidas</option><option>Promos</option></select></div>
              <div className="field"><label>Precio</label><input className="input" type="number" value={form.price} onChange={(e) => update("price", e.target.value)} /></div>
              <div className="field"><label>Tiempo prep (min)</label><input className="input" type="number" value={form.avgPrep} onChange={(e) => update("avgPrep", e.target.value)} /></div>
              <div className="field"><label>Stock</label><select className="input" value={form.stock} onChange={(e) => update("stock", e.target.value)}><option>OK</option><option>Bajo</option><option>Agotado</option></select></div>
              <div className="field"><label>Tags</label><input className="input" value={form.tags} onChange={(e) => update("tags", e.target.value)} placeholder="TOP,CHEF,Sin gluten" /></div>
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label>Descripción visible en cliente</label>
              <textarea className="textarea" value={form.description} onChange={(e) => update("description", e.target.value)} />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "14px 0" }}>
          <label className="toggle"><input type="checkbox" checked={form.available} onChange={(e) => update("available", e.target.checked)} /> Activo en carta</label>
          <label className="toggle"><input type="checkbox" checked={form.visibleClient} onChange={(e) => update("visibleClient", e.target.checked)} /> Visible para cliente QR</label>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={submit} disabled={uploading}>Guardar y publicar</button>
        </div>
      </div>
    </div>
  );
}

function ReviewsView({ role, staffId }) {
  const visible = REVIEWS.filter((r)=>role === "admin" || r.waiterId === staffId);
  return <div className="panel"><div className="panel-head"><h2>Reseñas y experiencia</h2><span className="badge">Google + internas</span></div><div className="list">{visible.map((r)=><div className="row" key={r.id}><span className={`badge ${r.rating >= 4 ? "green" : ""}`}>Mesa {r.table}</span><div className="row-main"><b style={{color:"var(--gold2)"}}>{"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</b><small>{r.comment} · {getStaff(r.waiterId).name} · {r.time}</small></div><span className={`badge ${r.google ? "green" : ""}`}>{r.google ? "Google" : "Interna"}</span></div>)}</div></div>;
}

function ReceiptPreview({ receiptConfig, restaurant }) {
  const subtotal = RECEIPT_ITEMS.reduce((s, i)=>s + i.qty * i.price, 0);
  const service = Math.round(subtotal * 0.1);
  const total = subtotal + service;
  return <div className="receipt-wrap"><div className="receipt"><h3>{restaurant.name}</h3><div className="center muted2">{restaurant.legalName}<br />RUT {restaurant.rut}<br />{restaurant.address}<br />{restaurant.phone} · {restaurant.website}</div><div className="dash" /><div className="center"><b>{receiptConfig.title}</b><br /><span className="muted2">Mesa 7 · {new Date().toLocaleString("es-CL", { hour:"2-digit", minute:"2-digit", day:"2-digit", month:"2-digit", year:"numeric" })}</span></div><div className="dash" />{RECEIPT_ITEMS.map((i)=><div className="receipt-row" key={i.name}><span>{i.qty}× {i.name}</span><b>{money(i.qty * i.price)}</b></div>)}<div className="dash" /><div className="receipt-row"><span>Subtotal</span><b>{money(subtotal)}</b></div><div className="receipt-row"><span>Servicio 10%</span><b>{money(service)}</b></div><div className="receipt-row"><span>{receiptConfig.taxLabel}</span><b>—</b></div><div className="receipt-row receipt-total"><span>TOTAL</span><b>{money(total)}</b></div>{receiptConfig.showWaiter && <div className="receipt-row"><span>Atendió</span><b>Marco</b></div>}{receiptConfig.showQr && <><div className="receipt-qr" /><div className="center muted2">Escanea para reseña Google</div></>}<div className="dash" /><div className="center muted2">{receiptConfig.footer}</div></div></div>;
}

function SettingsView({ state }) {
  const authToken = state?.authToken;
  const [restaurant, setRestaurant] = useState({ ...RESTAURANT, concept: "", googleReviewUrl: "" });
  const [receiptConfig, setReceiptConfig] = useState(RECEIPT_CONFIG);
  const [showPrinterPanel, setShowPrinterPanel] = useState(true);
  const [demoMode, setDemoMode] = useState(true);
  const [webhooks, setWebhooks] = useState(LOCAL_WEBHOOKS);
  const [logs, setLogs] = useState([
    { time: "20:45", event: "DEMO_READY", status: "ok", detail: "Sistema local listo para simular n8n, QR e impresión." },
  ]);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [promos, setPromos] = useState([]);
  const updateRestaurant = (key, value) => setRestaurant((r)=>({ ...r, [key]: value }));
  const updatePromo = (idx, key, value) => setPromos((rows) => rows.map((p, i) => i === idx ? { ...p, [key]: value } : p));
  const addPromo = () => setPromos((rows) => [...rows, { eyebrow: "", title: "", body: "", price: "" }]);
  const removePromo = (idx) => setPromos((rows) => rows.filter((_, i) => i !== idx));

  useEffect(() => {
    supaFetch(`restaurants?id=eq.${getRestaurantId()}&select=*&limit=1`, {}, authToken)
      .then((rows) => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        const r = rows[0];
        setRestaurant((prev) => ({
          ...prev,
          name: r.name || prev.name,
          legalName: r.legal_name || prev.legalName,
          rut: r.rut || prev.rut,
          address: r.address || prev.address,
          phone: r.phone || prev.phone,
          website: r.website || prev.website,
          concept: r.settings?.concept || prev.concept,
          googleReviewUrl: r.google_review_url || prev.googleReviewUrl,
        }));
        if (Array.isArray(r.settings?.promos)) setPromos(r.settings.promos);
      })
      .catch(() => {});
  }, []);

  const saveRestaurant = async () => {
    setSaving(true); setSavedOk(false);
    try {
      await supaFetch(`restaurants?id=eq.${getRestaurantId()}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: restaurant.name,
          legal_name: restaurant.legalName,
          rut: restaurant.rut,
          address: restaurant.address,
          phone: restaurant.phone,
          website: restaurant.website,
          google_review_url: restaurant.googleReviewUrl || null,
          settings: {
            concept: restaurant.concept || "",
            promos: promos.filter((p) => p.title?.trim()),
          },
        }),
      }, authToken);
      setSavedOk(true); setTimeout(() => setSavedOk(false), 2500);
    } catch (e) { console.error("[holu settings] save:", e.message); }
    finally { setSaving(false); }
  };
  const updateReceipt = (key, value) => setReceiptConfig((r)=>({ ...r, [key]: value }));
  const printReceipt = () => {
    setLogs((rows)=>[{ time: new Date().toLocaleTimeString("es-CL", { hour:"2-digit", minute:"2-digit" }), event: "PRINT_PREVIEW", status: "ok", detail: "window.print() ejecutado en modo local." }, ...rows]);
    window.print();
  };
  const updateWebhook = (key, value) => setWebhooks((w)=>({ ...w, [key]: value }));
  const simulateWebhook = async (event) => {
    const DEMO_PAYLOADS = {
      orderCreate: {
        restaurant_id: getRestaurantId(),
        qr_token: "A7K92",
        table_id: 7,
        session_id: null,
        notes: "Test desde admin",
        items: [{ menu_item_id: "tagliatelle", dish_name: "Tagliatelle al Ragù", unit_price: 21500, qty: 1 }],
        total: 21500,
        channel: "admin-test",
      },
      camareroCall: {
        restaurant_id: getRestaurantId(),
        qr_token: "A7K92",
        table_id: 7,
        call_type: "Camarero",
        message: "Test llamado desde admin",
      },
      kitchenCall: {
        restaurant_id: getRestaurantId(),
        qr_token: "A7K92",
        table_id: 7,
        call_type: "Confirmar plato",
        message: "Test cocina desde admin",
      },
      billRequest: {
        restaurant_id: getRestaurantId(),
        qr_token: "A7K92",
        table_id: 7,
      },
      feedback: {
        restaurant_id: getRestaurantId(),
        qr_token: "A7K92",
        table_id: 7,
        rating: 5,
        comment: "Test feedback desde admin",
        source: "table_qr",
      },
      receiptPrint: {
        restaurant_id: getRestaurantId(),
        qr_token: "A7K92",
        table_id: 7,
        items: [{ dish_name: "Tagliatelle al Ragù", unit_price: 21500, qty: 1 }],
        total: 21500,
      },
      cashClose: {
        restaurant_id: getRestaurantId(),
        session_id: "SHIFT-TEST",
        cash: 428500,
        card: 691200,
        total: 1119700,
      },
    };
    const payload = DEMO_PAYLOADS[event] || { restaurant_id: getRestaurantId(), event, source: "admin-test" };
    setLogs((rows)=>[{ time: new Date().toLocaleTimeString("es-CL", { hour:"2-digit", minute:"2-digit" }), event, status: demoMode ? "demo" : "pending", detail: demoMode ? `Simulado local: ${JSON.stringify(payload)}` : `POST ${webhooks[event] || "sin endpoint"}` }, ...rows]);
    if (!demoMode && webhooks[event]) {
      try {
        const res = await fetch(webhooks[event], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const body = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 240)}`);
        setLogs((rows)=>[{ time: new Date().toLocaleTimeString("es-CL", { hour:"2-digit", minute:"2-digit" }), event, status: "ok", detail: `Enviado a ${webhooks[event]}` }, ...rows]);
      } catch (err) {
        setLogs((rows)=>[{ time: new Date().toLocaleTimeString("es-CL", { hour:"2-digit", minute:"2-digit" }), event, status: "error", detail: String(err?.message || err) }, ...rows]);
      }
    }
  };
  return <div className="grid"><div className="two"><div className="panel"><div className="panel-head"><h2>Datos del restaurante</h2><div style={{display:"flex",gap:8,alignItems:"center"}}>{savedOk&&<span className="badge green">Guardado ✓</span>}<button className="btn primary" onClick={saveRestaurant} disabled={saving}>{saving?"Guardando...":"Guardar y publicar"}</button></div></div><div className="config-grid"><div className="field"><label>Nombre comercial</label><input className="input" value={restaurant.name} onChange={(e)=>updateRestaurant("name", e.target.value)} /></div><div className="field"><label>Razón social</label><input className="input" value={restaurant.legalName} onChange={(e)=>updateRestaurant("legalName", e.target.value)} /></div><div className="field"><label>RUT</label><input className="input" value={restaurant.rut} onChange={(e)=>updateRestaurant("rut", e.target.value)} /></div><div className="field"><label>Teléfono</label><input className="input" value={restaurant.phone} onChange={(e)=>updateRestaurant("phone", e.target.value)} /></div><div className="field" style={{gridColumn:"1/-1"}}><label>Dirección</label><input className="input" value={restaurant.address} onChange={(e)=>updateRestaurant("address", e.target.value)} /></div><div className="field"><label>Web</label><input className="input" value={restaurant.website} onChange={(e)=>updateRestaurant("website", e.target.value)} /></div><div className="field" style={{gridColumn:"1/-1"}}><label>Eslogan / concepto (visible en app de mesa)</label><input className="input" value={restaurant.concept||""} onChange={(e)=>updateRestaurant("concept",e.target.value)} placeholder="Ej: Cocina italiana de autor" /></div><div className="field" style={{gridColumn:"1/-1"}}><label>URL reseña Google (aparece en la app de mesa)</label><input className="input" value={restaurant.googleReviewUrl||""} onChange={(e)=>updateRestaurant("googleReviewUrl",e.target.value)} placeholder="https://g.page/r/..." /></div><div className="field" style={{gridColumn:"1/-1",borderTop:"1px solid var(--line)",paddingTop:14,marginTop:4}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><label style={{margin:0}}>Promociones visibles en la app de mesa</label><button className="btn ghost" style={{fontSize:12,padding:"7px 10px"}} onClick={addPromo}>+ Promo</button></div>{promos.length===0&&<p style={{color:"var(--dim)",fontSize:12,margin:"0 0 8px"}}>Sin promociones. El cliente no verá esta sección.</p>}{promos.map((p,idx)=><div key={idx} className="config-card" style={{marginBottom:8}}><div className="form-grid"><div className="field"><label>Etiqueta</label><input className="input" value={p.eyebrow||""} onChange={(e)=>updatePromo(idx,"eyebrow",e.target.value)} placeholder="LUN–VIE" /></div><div className="field"><label>Título</label><input className="input" value={p.title||""} onChange={(e)=>updatePromo(idx,"title",e.target.value)} placeholder="Menú del Día" /></div><div className="field"><label>Descripción</label><input className="input" value={p.body||""} onChange={(e)=>updatePromo(idx,"body",e.target.value)} placeholder="Entrada + principal + postre" /></div><div className="field"><label>Precio / destacado</label><input className="input" value={p.price||""} onChange={(e)=>updatePromo(idx,"price",e.target.value)} placeholder="$32.000" /></div></div><button className="btn danger" style={{marginTop:8,fontSize:12,padding:"7px 10px"}} onClick={()=>removePromo(idx)}>Eliminar</button></div>)}</div><div className="field"><label>Impresora</label><input className="input" value={receiptConfig.printer} onChange={(e)=>updateReceipt("printer", e.target.value)} /></div><div className="field"><label>IP impresora / estación</label><input className="input" value={receiptConfig.printerIp} onChange={(e)=>updateReceipt("printerIp", e.target.value)} /></div><div className="field"><label>Ancho papel</label><select className="input" value={receiptConfig.paperWidth} onChange={(e)=>updateReceipt("paperWidth", e.target.value)}><option>58mm</option><option>80mm</option></select></div><div className="field"><label>Modo impresión</label><input className="input" value={receiptConfig.printMode} onChange={(e)=>updateReceipt("printMode", e.target.value)} /></div></div></div><div className="panel"><div className="panel-head"><h2>Diseño de boleta</h2><button className="btn primary" onClick={printReceipt}>Generar boleta impresa</button></div><div className="config-grid"><div className="field"><label>Título</label><input className="input" value={receiptConfig.title} onChange={(e)=>updateReceipt("title", e.target.value)} /></div><div className="field"><label>Texto impuesto</label><input className="input" value={receiptConfig.taxLabel} onChange={(e)=>updateReceipt("taxLabel", e.target.value)} /></div><div className="field" style={{gridColumn:"1/-1"}}><label>Pie de ticket</label><input className="input" value={receiptConfig.footer} onChange={(e)=>updateReceipt("footer", e.target.value)} /></div></div><div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:12}}><label className="toggle"><input type="checkbox" checked={receiptConfig.showWaiter} onChange={(e)=>updateReceipt("showWaiter", e.target.checked)} /> Mostrar camarero</label><label className="toggle"><input type="checkbox" checked={receiptConfig.showQr} onChange={(e)=>updateReceipt("showQr", e.target.checked)} /> Mostrar QR reseña</label></div><p className="print-preview-note">Formato pensado para impresora térmica {receiptConfig.paperWidth}: tipografía monoespaciada, contraste alto, separadores limpios y QR visible para reseña.</p>
<>
  <button className="btn ghost" style={{marginTop:10}} onClick={()=>setShowPrinterPanel(!showPrinterPanel)}>
    {showPrinterPanel ? "Ocultar" : "Ver"} configuración de impresora
  </button>

  {showPrinterPanel && (
    <div className="printer-card">
      <b>Impresora configurada</b>

      <p style={{margin:"6px 0",color:"var(--muted)"}}>
        {receiptConfig.printer}<br />
        IP/Estación: {receiptConfig.printerIp}<br />
        Papel: {receiptConfig.paperWidth}<br />
        Modo: {receiptConfig.printMode}
      </p>

      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button className="btn primary" onClick={printReceipt}>Imprimir prueba</button>
        <button className="btn ghost" onClick={()=>alert("Conexión demo OK")}>Test conexión</button>
      </div>
    </div>
  )}
</>
</div></div><div className="two"><div className="panel print-target"><div className="panel-head"><h2>Preview ticket moderno</h2><span className="badge">80mm</span></div><ReceiptPreview receiptConfig={receiptConfig} restaurant={restaurant} /></div><div className="panel"><h2>Conexiones</h2><div className="demo-banner" style={{marginBottom:12}}><b><span className={`status-dot ${demoMode ? "" : "off"}`} />{demoMode ? "Demo local activo" : "Modo n8n real"}</b><p style={{margin:"6px 0 0",color:"var(--muted)"}}>En demo local los botones funcionan sin n8n. Cuando el cliente esté listo, desactiva demo y usa las URLs reales de n8n.</p><button className="btn ghost" style={{marginTop:10}} onClick={()=>setDemoMode(!demoMode)}>{demoMode ? "Cambiar a n8n real" : "Volver a demo local"}</button></div><div className="endpoint-grid">{Object.entries(webhooks).map(([key,value])=><div className="endpoint-row" key={key}><b>{key}</b><input className="input" value={value} onChange={(e)=>updateWebhook(key,e.target.value)} /><button className="btn primary" onClick={()=>simulateWebhook(key)}>Test</button></div>)}</div><div className="list" style={{marginTop:14}}><div className="row"><span className="badge green">n8n</span><div className="row-main"><b>Webhooks configurables</b><small>Pedidos, llamados, cocina, cobro, reseñas, generación de boleta y caja.</small></div><button className="btn ghost" onClick={()=>simulateWebhook("orderCreate")}>Simular pedido</button></div><div className="row"><span className="badge blue">QR</span><div className="row-main"><b>Tokens de mesa</b><small>Mapeo token → mesa → zona → sesión.</small></div><button className="btn ghost" onClick={()=>simulateWebhook("qrScan")}>Simular scan</button></div><div className="row"><span className="badge">Print</span><div className="row-main"><b>{receiptConfig.printer}</b><small>Salida térmica nítida. En demo usa window.print().</small></div><button className="btn ghost" onClick={()=>simulateWebhook("receiptPrint")}>Test print</button></div></div><h2 style={{marginTop:16}}>Logs demo/local</h2><div className="integration-log">{logs.map((l,idx)=><div className="log-row" key={idx}><b>{l.time} · {l.event} · {l.status}</b><br />{l.detail}</div>)}</div><h2 style={{marginTop:16}}>Auditoría</h2><table className="permission-table"><thead><tr><th>Módulo</th><th>Admin</th><th>Camarero</th><th>Cocina</th><th>Caja</th></tr></thead><tbody>{PERMISSIONS.map((p)=><tr key={p.module}><td>{p.module}</td><td className={p.admin?"permission-ok":"permission-no"}>{p.admin?"Sí":"No"}</td><td className={p.camarero?"permission-ok":"permission-no"}>{p.camarero?"Sí":"No"}</td><td className={p.cocina?"permission-ok":"permission-no"}>{p.cocina?"Sí":"No"}</td><td className={p.caja?"permission-ok":"permission-no"}>{p.caja?"Sí":"No"}</td></tr>)}</tbody></table><h2 style={{marginTop:16}}>Auditoría</h2><pre className="audit">POST /order-create
POST /camarero-call
POST /kitchen-call
POST /bill-request
POST /receipt-print
POST /feedback
POST /cash/open
POST /cash/close
POST /shift/change
POST /inventory/update
POST /qr/regenerate</pre></div></div></div>;
}

function SessionLogin({ onAuth, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try { onAuth(await supaSignIn(email, password)); }
    catch (err) { setError(err.message); setLoading(false); }
  };
  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"#070604", gap:28, padding:20 }}>
      <style>{CSS}</style>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:38, letterSpacing:".14em", color:"#f7d37b" }}>HOLU</div>
        <div style={{ color:"var(--muted)", fontSize:11, letterSpacing:".22em", marginTop:6 }}>BACKOFFICE</div>
      </div>
      <form onSubmit={submit} style={{ width:"min(380px,100%)", display:"flex", flexDirection:"column", gap:12 }}>
        <div className="field"><label>Correo del restaurante</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@mirestaurante.cl" required autoFocus /></div>
        <div className="field"><label>Contraseña</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required /></div>
        {error && <div style={{ color:"var(--red2)", fontSize:13, textAlign:"center", padding:"6px 0" }}>{error}</div>}
        <button className="btn primary" type="submit" disabled={loading} style={{ marginTop:4 }}>{loading ? "Verificando..." : "Ingresar"}</button>
      </form>
      {onBack && <button onClick={onBack} style={{ background:"none", border:"none", color:"var(--dim)", cursor:"pointer", fontSize:13, padding:0 }}>← Volver</button>}
      <p style={{ color:"var(--dim)", fontSize:12, textAlign:"center", margin:0 }}>¿Sin cuenta? Regístrate en holu.app</p>
    </div>
  );
}

function LoginEntry({ onAdminAuth, onStaffAuth }) {
  const [mode, setMode] = useState(null);
  if (mode === "admin") return <SessionLogin onAuth={onAdminAuth} onBack={() => setMode(null)} />;
  if (mode === "employee") return <PinGate onAuth={onStaffAuth} onBack={() => setMode(null)} />;
  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"#070604", gap:40, padding:20 }}>
      <style>{CSS}</style>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:42, letterSpacing:".14em", color:"#f7d37b" }}>HOLU</div>
        <div style={{ color:"var(--muted)", fontSize:11, letterSpacing:".22em", marginTop:6 }}>BACKOFFICE</div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:14, width:"min(360px,100%)" }}>
        <button className="btn primary" style={{ padding:"22px 0", fontSize:17, borderRadius:20, lineHeight:1.4 }} onClick={() => setMode("admin")}>
          Administrador<br /><span style={{ fontSize:12, fontWeight:400, opacity:.7 }}>Correo y contraseña</span>
        </button>
        <button className="btn ghost" style={{ padding:"22px 0", fontSize:17, borderRadius:20, lineHeight:1.4 }} onClick={() => setMode("employee")}>
          Soy empleado<br /><span style={{ fontSize:12, fontWeight:400, color:"var(--muted)" }}>Ingresa con tu PIN</span>
        </button>
      </div>
    </div>
  );
}

function PinGate({ onAuth, onBack }) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const reject = () => {
    setError(true);
    setTimeout(() => { setDigits(""); setError(false); }, 800);
  };

  // The PIN never leaves as a comparison the browser can do: it is checked
  // server-side and comes back as a session, not as a list of staff.
  const verifyPin = async (pin) => {
    setChecking(true);
    try {
      const result = await staffPinLogin(getRestaurantId(), pin);
      if (result?.staff?.id) {
        onAuth({
          id: result.staff.id,
          name: result.staff.name,
          role: result.staff.role,
          shift: result.staff.shift || "",
          avatar: (result.staff.name || "?")[0].toUpperCase(),
          photoUrl: result.staff.avatar_url || "",
        }, result.session);
        return;
      }
      reject();
    } catch (e) {
      if (e.message === "too_many_attempts") {
        setBlocked(true);
        setTimeout(() => { setBlocked(false); setDigits(""); }, 5000);
        return;
      }
      console.error("[holu admin] staff login:", e.message);
      reject();
    } finally {
      setChecking(false);
    }
  };

  const handleDigit = (d) => {
    if (digits.length >= 4 || checking) return;
    const next = digits + d;
    setDigits(next);
    if (next.length === 4) verifyPin(next);
  };

  const handleDel = () => setDigits((d) => d.slice(0, -1));

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0f1117", gap: 32 }}>
      <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 4, color: "#fff" }}>HOLU</div>
      <div style={{ fontSize: 14, color: blocked ? "#ef4444" : "#888" }}>
        {blocked ? "Demasiados intentos. Espera unos minutos." : "Ingresa tu PIN de empleado"}
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        {[0,1,2,3].map((i) => (
          <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: digits.length > i ? (error ? "#ef4444" : "#6366f1") : "#333", transition: "background .15s" }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, i) => (
          <button key={i} onClick={() => k === "⌫" ? handleDel() : k ? handleDigit(k) : null}
            style={{ width: 72, height: 72, borderRadius: 16, border: "none", fontSize: 24, fontWeight: 700, cursor: k ? "pointer" : "default", background: k ? "#1e2130" : "transparent", color: "#fff" }}>
            {k}
          </button>
        ))}
      </div>
      {error && <div style={{ color: "#ef4444", fontSize: 13 }}>PIN incorrecto</div>}
      {onBack && <button onClick={onBack} style={{ background:"none", border:"none", color:"#666", cursor:"pointer", fontSize:13 }}>← Volver</button>}
    </div>
  );
}

export default function HoluAdmin() {
  const [session, setSession] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem("holu:session") || "null");
      if (!s) return null;
      // Validate the session belongs to this Supabase project. The ref lives in
      // the decoded iss claim, not in the raw (base64) token text.
      const payload = JSON.parse(atob(s.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      const projectRef = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];
      const issuedHere = payload.iss === "supabase" || String(payload.iss || "").includes(projectRef);
      if (!issuedHere) {
        localStorage.removeItem("holu:session");
        return null;
      }
      if (!s.restaurant_id && payload.user_metadata?.restaurant_id) {
        s.restaurant_id = payload.user_metadata.restaurant_id;
      }
      // Expire check
      if (s.expires_at && s.expires_at < Date.now()) {
        localStorage.removeItem("holu:session");
        return null;
      }
      if (s.restaurant_id) setRestaurantId(s.restaurant_id);
      return s;
    } catch { localStorage.removeItem("holu:session"); return null; }
  });
  const [authed, setAuthed] = useState(() => {
    try {
      const staff = JSON.parse(sessionStorage.getItem("holu:staff") || "null");
      return staff || null;
    } catch { return null; }
  });
  const [role, setRole] = useState(authed?.role || "camarero");
  const [staffId, setStaffId] = useState(authed?.id || "w1");
  const [tab, setTab] = useState("dashboard");
  const state = useBackofficeState(session?.access_token || null);
  const safeTab = role === "cocina" ? "kitchen" : (role === "camarero" && ["sales", "staff", "inventory", "qr", "menu", "settings"].includes(tab) ? "dashboard" : tab);

  // useMemo MUST be before any conditional return (Rules of Hooks)
  const content = useMemo(() => {
    switch (safeTab) {
      case "tables": return <TablesView role={role} staffId={staffId} state={state} />;
      case "orders": return <OrdersView role={role} staffId={staffId} state={state} />;
      case "kitchen": return <KitchenView state={state} />;
      case "calls": return <CallsView role={role} staffId={staffId} state={state} />;
      case "messages": return <MessagesView role={role} staffId={staffId} state={state} />;
      case "sales": return <><CashClosingView state={state} staffId={staffId} /><SalesView /></>;
      case "staff": return <StaffView state={state} />;
      case "inventory": return <InventoryView state={state} />;
      case "qr": return <QRView state={state} />;
      case "menu": return <MenuView state={state} />;
      case "reviews": return <ReviewsView role={role} staffId={staffId} />;
      case "settings": return <SettingsView state={state} />;
      default: return <Dashboard role={role} staffId={staffId} state={state} />;
    }
  }, [safeTab, role, staffId, state]);

  const handleSessionAuth = (sess) => {
    // The restaurant_id in the admin's JWT wins over the build-time default.
    if (sess?.restaurant_id) setRestaurantId(sess.restaurant_id);
    try { localStorage.setItem("holu:session", JSON.stringify(sess)); } catch {}
    setSession(sess);
  };

  const handleStaffAuth = (staff, staffSession = null) => {
    // A PIN login now carries a real Supabase session, so the employee's own
    // restaurant_id claim drives every query they make from here on.
    if (staffSession?.access_token) handleSessionAuth(staffSession);
    try { sessionStorage.setItem("holu:staff", JSON.stringify(staff)); } catch {}
    setAuthed(staff);
    setRole(staff.role);
    setStaffId(staff.id);
  };

  const handleAdminAuth = (sess) => {
    handleSessionAuth(sess);
    const adminStaff = { id: "a1", name: "Admin", role: "admin", shift: "Full", avatar: "A", photoUrl: "" };
    handleStaffAuth(adminStaff);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("holu:session");
      sessionStorage.removeItem("holu:staff");
      sessionStorage.removeItem("holu:restaurant");
    } catch {}
    setRestaurantId(DEFAULT_RESTAURANT_ID);
    setSession(null);
    setAuthed(null);
    setRole("camarero");
    setStaffId("w1");
  };

  if (!authed) return <LoginEntry onAdminAuth={handleAdminAuth} onStaffAuth={handleStaffAuth} />;

  return <Layout role={role} staffId={staffId} tab={safeTab} setTab={setTab} onLogout={handleLogout} authed={authed}>
    <Topbar role={role} staffId={staffId} authed={authed} />
    {content}
  </Layout>;
}
