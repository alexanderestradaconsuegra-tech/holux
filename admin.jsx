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

const N8N_WEBHOOK_BASE = getEnv("VITE_N8N_WEBHOOK_BASE", getEnv("N8N_WEBHOOK_BASE", ""));
const buildWebhookUrl = (path) => {
  const base = String(N8N_WEBHOOK_BASE || "").replace(/\/+$/, "");
  const clean = String(path || "").replace(/^\/+/, "");
  return base ? `${base}/webhook/${clean}` : `/webhook/${clean}`;
};

const SUPABASE_URL = getEnv("VITE_SUPABASE_URL", "https://nlwrkumlrudfgsdnhfhw.supabase.co");
const SUPABASE_ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY", "");
const MESA_URL = getEnv("VITE_MESA_URL", "").replace(/\/+$/, "");

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
    return r.json();
  });
};

const supaGet = (path, token = null) => supaFetch(path, {}, token);
const supaPatch = (path, body, token = null) =>
  supaFetch(path, { method: "PATCH", body: JSON.stringify(body), prefer: "return=minimal" }, token);

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

const STATUS_UI = { received: "Recibido", preparing: "Preparando", ready: "Listo para servir", served: "Servido", pending: "Pendiente" };
const STATUS_DB = { "Recibido": "received", "Preparando": "preparing", "Listo para servir": "ready", "Servido": "served" };

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

const CASH_SESSION_INITIAL = {
  id: "SHIFT-2026-05-11-NOCHE",
  status: "abierta",
  openedAt: "18:00",
  closedAt: null,
  openedBy: "a1",
  currentUser: "a1",
  activeTurn: "Noche",
  openingCash: 150000,
  cash: 428500,
  card: 691200,
  transfer: 118000,
  tips: 29150,
  expenses: 42000,
  expected: 1264850,
  counted: 1264850,
  difference: 0,
  history: [
    { time: "18:00", userId: "a1", action: "Abrió caja", detail: "Fondo inicial $150.000" },
    { time: "19:00", userId: "w1", action: "Inicio turno", detail: "Marco asignado a Salón" },
    { time: "20:15", userId: "w2", action: "Cambio turno", detail: "Isabella toma VIP" },
  ],
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
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 10% 0,rgba(217,164,65,.22),transparent 28%),radial-gradient(circle at 110% 20%,rgba(96,165,250,.12),transparent 34%),#050403;color:var(--text);font-family:Inter,system-ui,sans-serif}.app{min-height:100dvh;display:grid;grid-template-columns:286px 1fr;background:linear-gradient(180deg,rgba(255,255,255,.02),transparent)}svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.sidebar{position:sticky;top:0;height:100dvh;padding:18px;border-right:1px solid var(--line);background:rgba(10,8,6,.86);backdrop-filter:blur(22px);display:flex;flex-direction:column}.brand{font-family:'Playfair Display',serif;letter-spacing:.14em;color:var(--gold2);font-size:31px;line-height:.9}.brand small{display:block;font-family:Inter;font-size:10px;letter-spacing:.2em;color:var(--muted);margin-top:8px}.role-card{margin:18px 0;padding:14px;border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025));border:1px solid var(--line)}.role-switch{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.role-switch button,.nav button,.chip,.btn{border:0;cursor:pointer}.role-switch button{border-radius:14px;padding:11px 8px;background:rgba(255,255,255,.06);color:var(--muted);font-weight:900}.role-switch .on,.tab .on{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#171006}.nav{display:grid;gap:7px;margin-top:8px}.nav button{display:flex;align-items:center;gap:11px;text-align:left;border-radius:16px;padding:13px 12px;background:transparent;color:var(--muted);font-weight:800}.nav button.on{background:rgba(247,211,123,.12);color:var(--gold2)}.nav button.locked{opacity:.35;cursor:not-allowed}.side-footer{margin-top:auto;color:var(--dim);font-size:12px;line-height:1.5}.main{padding:22px;min-width:0}.topbar{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:18px}.title h1{font-family:'Playfair Display',serif;font-size:42px;line-height:.96;margin:0;letter-spacing:-.05em}.title p{margin:8px 0 0;color:var(--muted)}.operator{display:flex;gap:10px;align-items:center;padding:11px 13px;border-radius:18px;border:1px solid var(--line);background:rgba(255,255,255,.045)}.avatar{width:42px;height:42px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,var(--gold),var(--gold2));color:#171006;font-weight:900;object-fit:cover}.avatar.img{background:#111;border:1px solid var(--line)}.staff-photo{width:76px;height:76px;border-radius:22px;object-fit:cover;border:1px solid var(--line);box-shadow:0 12px 28px rgba(0,0,0,.28)}.select{background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--text);border-radius:14px;padding:10px;outline:none}.input,.textarea{width:100%;background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--text);border-radius:14px;padding:12px;outline:none;font:inherit}.textarea{min-height:82px;resize:vertical}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.field label{display:block;color:var(--muted);font-size:12px;font-weight:800;margin-bottom:6px}.modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.62);display:grid;place-items:center;z-index:80;padding:18px}.modal{width:min(760px,100%);max-height:90dvh;overflow:auto;border-radius:26px;background:#100d0a;border:1px solid var(--line);box-shadow:var(--shadow);padding:18px}.preview-phone{border-radius:24px;border:1px solid var(--line);background:rgba(255,255,255,.035);padding:14px}.client-dish{border-radius:18px;background:rgba(255,255,255,.055);border:1px solid var(--line);padding:12px;margin-bottom:8px}.dish-thumb{width:74px;height:74px;border-radius:16px;object-fit:cover;background:rgba(255,255,255,.08);border:1px solid var(--line);flex-shrink:0}.dish-thumb.big{width:100%;height:180px;border-radius:20px;margin-bottom:12px}.image-upload{border:1px dashed rgba(247,211,123,.35);border-radius:18px;padding:14px;background:rgba(247,211,123,.05);display:grid;gap:10px}.image-actions{display:flex;gap:8px;flex-wrap:wrap}.client-dish h4{margin:0 0 4px}.client-dish p{margin:0;color:var(--muted);font-size:12px}.toggle{display:inline-flex;align-items:center;gap:8px;color:var(--muted);font-weight:800}.toggle input{accent-color:#d9a441}.grid{display:grid;gap:14px}.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.kpi,.panel,.table-card,.message-card{border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025));border:1px solid var(--line);box-shadow:var(--shadow)}.kpi{padding:16px;min-height:112px}.kpi span{color:var(--muted);font-size:12px;font-weight:700}.kpi strong{display:block;font-size:30px;margin:8px 0 4px}.kpi small{color:var(--dim)}.two{display:grid;grid-template-columns:1.1fr .9fr;gap:14px}.three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.panel{padding:16px;min-width:0}.panel-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px}.panel h2{font-family:'Playfair Display',serif;font-size:27px;margin:0;letter-spacing:-.04em}.panel p{color:var(--muted)}.list{display:grid;gap:10px}.row{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:13px;border-radius:17px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.065)}.row-main b{display:block}.row-main small{display:block;color:var(--muted);margin-top:4px;line-height:1.35}.badge{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:900;background:rgba(247,211,123,.12);color:var(--gold2);white-space:nowrap}.badge.red{background:rgba(239,68,68,.12);color:var(--red2)}.badge.green{background:rgba(52,211,153,.12);color:var(--green)}.badge.blue{background:rgba(96,165,250,.12);color:#93c5fd}.badge.purple{background:rgba(167,139,250,.12);color:#c4b5fd}.btn{border-radius:14px;padding:11px 13px;font-weight:900}.btn.primary{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#171006}.btn.ghost{background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--text)}.btn.danger{background:rgba(239,68,68,.16);color:var(--red2);border:1px solid rgba(239,68,68,.24)}.tab{display:flex;gap:8px;overflow:auto;margin-bottom:14px}.tab button{white-space:nowrap;border:1px solid var(--line);background:rgba(255,255,255,.045);color:var(--muted);border-radius:999px;padding:10px 13px;font-weight:900}.table-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.table-card{padding:14px;min-height:158px}.table-card h3{margin:0;font-size:20px}.table-card .meta{display:flex;justify-content:space-between;align-items:center;margin-top:10px;color:var(--muted);font-size:12px}.table-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}.progress{height:8px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin:9px 0}.progress span{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:999px}.dish-lines{display:grid;gap:7px;margin-top:10px}.dish-line{display:flex;justify-content:space-between;gap:10px;font-size:13px;color:var(--muted)}.chart{display:grid;gap:10px}.bar{display:grid;grid-template-columns:160px 1fr 90px;gap:10px;align-items:center}.bar-track{height:11px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}.bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--gold),var(--gold2))}.message-card{padding:14px}.message-card.urgent{border-color:rgba(239,68,68,.35);background:linear-gradient(145deg,rgba(239,68,68,.10),rgba(255,255,255,.025))}.message-top{display:flex;justify-content:space-between;gap:10px}.message-card blockquote{margin:10px 0 0;color:#eadfd4;line-height:1.45;border-left:3px solid var(--gold);padding-left:10px}.timeline{display:grid;gap:12px}.timeline-item{display:grid;grid-template-columns:20px 1fr;gap:12px}.dot{width:12px;height:12px;border-radius:50%;background:var(--gold2);margin-top:5px;box-shadow:0 0 0 5px rgba(247,211,123,.1)}.audit{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#cbd5e1;font-size:12px;background:rgba(0,0,0,.22);border-radius:16px;padding:14px;overflow:auto}.receipt-wrap{display:grid;place-items:center}.receipt{width:320px;background:#fff;color:#111;border-radius:10px;padding:18px 18px 24px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:0 26px 70px rgba(0,0,0,.42)}.receipt h3{font-family:Inter,system-ui,sans-serif;text-align:center;margin:0;font-size:22px;letter-spacing:.12em}.receipt .center{text-align:center}.receipt .muted2{color:#555;font-size:11px}.receipt .dash{border-top:1px dashed #111;margin:12px 0}.receipt-row{display:flex;justify-content:space-between;gap:8px;font-size:12px;margin:7px 0}.receipt-total{font-size:16px;font-weight:900}.receipt-qr{width:78px;height:78px;margin:12px auto 4px;background:repeating-linear-gradient(45deg,#111 0 6px,#fff 6px 12px);border:6px solid #fff;outline:2px solid #111}.print-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.config-card{border-radius:20px;background:rgba(255,255,255,.045);border:1px solid var(--line);padding:14px}.config-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.print-preview-note{color:var(--muted);font-size:12px;line-height:1.45}.drawer-lite{position:fixed;right:22px;top:22px;width:min(440px,calc(100vw - 44px));max-height:calc(100dvh - 44px);overflow:auto;z-index:60;border-radius:26px;background:#100d0a;border:1px solid var(--line);box-shadow:var(--shadow);padding:18px}.drawer-lite h2{font-family:'Playfair Display',serif;font-size:30px;margin:0}.tip-box{border-radius:18px;background:rgba(247,211,123,.08);border:1px solid rgba(247,211,123,.18);padding:14px}.tip-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.printer-card{border:1px solid rgba(96,165,250,.24);background:rgba(96,165,250,.08);border-radius:20px;padding:14px;margin-top:12px}.period-switch{display:flex;gap:8px;flex-wrap:wrap}.period-switch button{border:1px solid var(--line);background:rgba(255,255,255,.045);color:var(--muted);border-radius:999px;padding:10px 13px;font-weight:900}.period-switch button.on{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#171006}.sales-split{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.sales-mini{border-radius:18px;background:rgba(255,255,255,.045);border:1px solid var(--line);padding:14px}.sales-mini span{color:var(--muted);font-size:12px}.sales-mini strong{display:block;font-size:22px;margin-top:6px}.kitchen-board{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.kitchen-col{border-radius:22px;background:rgba(255,255,255,.04);border:1px solid var(--line);padding:14px}.kitchen-ticket{border-radius:18px;background:#18130f;border:1px solid rgba(255,255,255,.06);padding:12px;margin-top:10px}.kitchen-ticket h4{margin:0 0 6px}.kitchen-ticket p{margin:0;color:var(--muted);font-size:12px}.cash-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.cash-card{border-radius:20px;padding:16px;background:rgba(255,255,255,.045);border:1px solid var(--line)}.cash-card span{display:block;color:var(--muted);font-size:12px}.cash-card strong{display:block;font-size:24px;margin-top:8px}.shift-banner{border-radius:22px;padding:16px;background:linear-gradient(135deg,rgba(217,164,65,.14),rgba(255,255,255,.04));border:1px solid rgba(247,211,123,.22);display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center}.shift-actions{display:flex;gap:8px;flex-wrap:wrap}.close-report{width:min(760px,100%);background:#fff;color:#111;border-radius:14px;padding:24px;font-family:Inter,system-ui,sans-serif}.close-report h2{font-family:Inter,system-ui,sans-serif;margin:0 0 6px;color:#111}.close-report .muted2{color:#555}.report-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0}.report-box{border:1px solid #ddd;border-radius:10px;padding:12px}.report-box span{font-size:12px;color:#555}.report-box b{display:block;font-size:20px;margin-top:4px}.signature-line{border-top:1px solid #111;margin-top:34px;padding-top:8px;text-align:center}.whatsapp-card{border:1px solid rgba(52,211,153,.24);background:rgba(52,211,153,.08);border-radius:20px;padding:14px;margin-top:12px}.qr-card-admin{border-radius:20px;background:rgba(255,255,255,.045);border:1px solid var(--line);padding:14px}.qr-visual{width:112px;height:112px;border-radius:16px;background:repeating-linear-gradient(45deg,#fff 0 7px,#111 7px 14px);border:10px solid #fff;margin:0 auto 12px}.permission-table{width:100%;border-collapse:collapse}.permission-table th,.permission-table td{border-bottom:1px solid var(--line);padding:12px;text-align:left}.permission-table th{color:var(--gold2);font-size:12px}.permission-ok{color:var(--green);font-weight:900}.permission-no{color:var(--red2);font-weight:900}.inventory-low{border-color:rgba(239,68,68,.32)!important;background:linear-gradient(145deg,rgba(239,68,68,.09),rgba(255,255,255,.025))!important}.integration-log{max-height:260px;overflow:auto;display:grid;gap:8px}.log-row{border-radius:14px;background:rgba(0,0,0,.22);border:1px solid var(--line);padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#dbeafe}.log-row b{color:var(--gold2)}.status-dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:7px;background:var(--green);box-shadow:0 0 0 4px rgba(52,211,153,.12)}.status-dot.off{background:var(--red);box-shadow:0 0 0 4px rgba(239,68,68,.12)}.endpoint-grid{display:grid;grid-template-columns:1fr;gap:10px}.endpoint-row{display:grid;grid-template-columns:150px 1fr auto;gap:10px;align-items:center}.demo-banner{border:1px solid rgba(96,165,250,.22);background:rgba(96,165,250,.08);border-radius:20px;padding:14px}.demo-banner b{color:#bfdbfe}@media print{body{background:#fff}.app,.sidebar,.mobile-top,.topbar,.panel:not(.print-target){display:none!important}.print-target{display:block!important;box-shadow:none!important;border:0!important}.receipt{box-shadow:none;border-radius:0;width:80mm}.main{padding:0}.receipt-wrap{display:block}}.mobile-top{display:none}@media(max-width:1050px){.app{grid-template-columns:1fr}.sidebar{display:none}.mobile-top{display:flex;position:sticky;top:0;z-index:20;background:rgba(7,6,4,.9);backdrop-filter:blur(18px);border-bottom:1px solid var(--line);padding:12px;gap:8px;overflow:auto}.mobile-top button{white-space:nowrap}.main{padding:14px}.kpis,.two,.three,.table-grid{grid-template-columns:1fr}.topbar{display:block}.operator{margin-top:12px}.title h1{font-size:34px}.row{grid-template-columns:1fr}.bar{grid-template-columns:1fr}.table-actions{grid-template-columns:1fr 1fr}}`;

function getStaff(id) {
  return STAFF.find((s) => s.id === id) || { name: "Sin asignar", avatar: "—", role: "", photoUrl: "" };
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
  const [orders, setOrders] = useState(ORDERS);
  const [calls, setCalls] = useState(CALLS);
  const [messages, setMessages] = useState(CLIENT_MESSAGES);
  const [menuItems, setMenuItems] = useState(MENU_ITEMS);
  const [tables, setTables] = useState(TABLES);
  const [cashSession, setCashSession] = useState(CASH_SESSION_INITIAL);
  const [inventory, setInventory] = useState(INVENTORY_ITEMS);
  const [qrTokens, setQrTokens] = useState(QR_TOKENS);
  const [expenses, setExpenses] = useState(EXPENSES);

  useEffect(() => {
    if (!SUPABASE_ANON_KEY) return;
    const poll = async () => {
      try {
        const [rawOrders, rawCalls] = await Promise.all([
          supaGet("orders?status=neq.served&select=*,order_items(*)&order=created_at.desc&limit=50", authToken),
          supaGet("calls?status=neq.Resuelto&select=*&order=created_at.desc", authToken),
        ]);
        if (Array.isArray(rawOrders)) setOrders(rawOrders.map(dbOrderToUI));
        if (Array.isArray(rawCalls)) setCalls(rawCalls.map(dbCallToUI));
      } catch (err) {
        console.error("[holu admin] Supabase poll:", err.message);
      }
    };
    poll();
    const t = setInterval(poll, 8000);
    return () => clearInterval(t);
  }, [authToken]);

  const attendCall = async (id, actor) => {
    setCalls((rows) => rows.map((c) => c.id === id ? { ...c, status: `Atendido por ${actor}` } : c));
    if (SUPABASE_ANON_KEY) {
      try { await supaPatch(`calls?id=eq.${encodeURIComponent(id)}`, { status: "Resuelto", resolved_at: new Date().toISOString() }, authToken); }
      catch (e) { console.error("[holu admin] attendCall:", e.message); }
    }
  };
  const resolveMessage = (id, actor) => {
    setMessages((rows) => rows.map((m) => m.id === id ? { ...m, status: `resuelto por ${actor}` } : m));
  };
  const updateOrderStatus = async (id, uiStatus) => {
    setOrders((rows) => rows.map((o) => o.id === id ? { ...o, status: uiStatus, eta_minutes: uiStatus === "Servido" ? 0 : o.eta_minutes } : o));
    if (SUPABASE_ANON_KEY && STATUS_DB[uiStatus]) {
      try { await supaPatch(`orders?id=eq.${encodeURIComponent(id)}`, { status: STATUS_DB[uiStatus] }, authToken); }
      catch (e) { console.error("[holu admin] updateOrderStatus:", e.message); }
    }
  };
  const saveMenuItem = (item) => {
    setMenuItems((rows) => {
      const exists = rows.some((r) => r.id === item.id);
      if (exists) return rows.map((r) => r.id === item.id ? item : r);
      return [{ ...item, id: item.id || `dish-${Date.now()}` }, ...rows];
    });
  };
  const toggleMenuAvailability = (id) => {
    setMenuItems((rows) => rows.map((r) => r.id === id ? { ...r, available: !r.available, visibleClient: !r.available ? r.visibleClient : false } : r));
  };
  const deleteMenuItem = (id) => setMenuItems((rows) => rows.filter((r) => r.id !== id));
  const setTableTip = (tableId, accepted) => {
    setTables((rows) => rows.map((t) => t.id === tableId ? { ...t, tipAccepted: accepted, tipAmount: accepted ? Math.round(t.bill * 0.1) : 0 } : t));
  };
  const addCashHistory = (userId, action, detail) => {
    setCashSession((s) => ({ ...s, history: [{ time: new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }), userId, action, detail }, ...s.history] }));
  };
  const openCash = (userId) => {
    setCashSession((s) => ({ ...s, status: "abierta", openedAt: new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }), closedAt: null, openedBy: userId, currentUser: userId }));
    addCashHistory(userId, "Abrió caja", "Caja habilitada para ventas del turno");
  };
  const closeCash = (userId) => {
    setCashSession((s) => ({ ...s, status: "cerrada", closedAt: new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }), currentUser: userId }));
    addCashHistory(userId, "Cerró caja", "Cierre validado y listo para impresión/descarga/envío");
  };
  const changeTurn = (userId, turn) => {
    setCashSession((s) => ({ ...s, activeTurn: turn, currentUser: userId }));
    addCashHistory(userId, "Cambio turno", `Nuevo turno activo: ${turn}`);
  };
  const closeTurn = (userId) => {
    addCashHistory(userId, "Cerró turno", `Responsable: ${getStaff(userId).name}`);
  };
  const addExpense = (expense) => {
    const row = { ...expense, id: `E-${Date.now()}`, time: new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) };
    setExpenses((rows) => [row, ...rows]);
    setCashSession((s) => ({ ...s, expenses: s.expenses + Number(expense.amount || 0), expected: s.expected - Number(expense.amount || 0), history: [{ time: row.time, userId: expense.userId, action: "Registró gasto", detail: `${expense.detail} · ${money(expense.amount)}` }, ...s.history] }));
  };
  const updateInventoryStock = (id, stock) => {
    setInventory((rows) => rows.map((r) => r.id === id ? { ...r, stock: Number(stock), status: Number(stock) <= r.min ? "Bajo" : "OK" } : r));
  };
  const toggleQr = (table) => setQrTokens((rows) => rows.map((q) => q.table === table ? { ...q, active: !q.active } : q));
  const regenerateQr = (table) => setQrTokens((rows) => rows.map((q) => q.table === table ? { ...q, token: `QR${table}${Math.floor(1000 + Math.random() * 8999)}`, scans: 0, lastScan: "—" } : q));
  const assignWaiter = (tableId, waiterId) => {
    setTables((rows) => rows.map((t) => t.id === tableId ? { ...t, waiterId } : t));
    addCashHistory(waiterId, "Mesa reasignada", `Mesa ${tableId} asignada a ${getStaff(waiterId).name}`);
  };
  const cobrarMesa = async (tableId, callId, method, tipAccepted, total, tipAmt, staffUserId) => {
    setTables((rows) => rows.map((t) => t.id === tableId ? { ...t, status: "Libre", bill: 0, tipAccepted: false, tipAmount: 0, guests: 0, waiterId: null } : t));
    setCalls((rows) => rows.filter((c) => c.table !== tableId));
    const time = new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    setCashSession((s) => ({
      ...s,
      cash:     method === "Efectivo"      ? s.cash     + total : s.cash,
      card:     method === "Tarjeta"       ? s.card     + total : s.card,
      transfer: method === "Transferencia" ? s.transfer + total : s.transfer,
      tips:     s.tips + tipAmt,
      expected: s.expected + total,
      history: [{ time, userId: staffUserId, action: "Cobro registrado", detail: `Mesa ${tableId} · ${money(total)} · ${method}` }, ...s.history],
    }));
    if (authToken) {
      try {
        await supaPatch(`tables?table_number=eq.${tableId}`, { status: "Libre", bill_total: 0, tip_accepted: false, tip_amount: 0, guests: 0, last_activity_at: new Date().toISOString() }, authToken);
        await supaPatch(`calls?table_id=eq.${tableId}&status=neq.Resuelto`, { status: "Resuelto", resolved_at: new Date().toISOString() }, authToken);
      } catch (e) { console.error("[holu admin] cobrarMesa:", e.message); }
    }
  };
  return { orders, calls, messages, menuItems, tables, cashSession, inventory, qrTokens, expenses, attendCall, resolveMessage, updateOrderStatus, saveMenuItem, toggleMenuAvailability, deleteMenuItem, setTableTip, openCash, closeCash, changeTurn, closeTurn, addExpense, updateInventoryStock, toggleQr, regenerateQr, assignWaiter, cobrarMesa };
}

function Layout({ role, staffId, tab, setTab, onLogout, children }) {
  const currentStaff = getStaff(staffId);
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

function Topbar({ role, staffId }) {
  const current = getStaff(staffId);
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
  const visible = state.tables.filter((t) => isAdmin || t.waiterId === staffId);
  return <div className="grid"><div className="panel"><div className="panel-head"><h2>{isAdmin ? "Mapa de mesas" : "Mesas que atiendo"}</h2><span className="badge">{visible.length} mesas</span></div><div className="table-grid">{visible.map((t)=><div className="table-card" key={t.id}><div style={{display:"flex", justifyContent:"space-between", gap:10}}><h3>Mesa {t.id}</h3><span className={`badge ${statusBadge(t.status)}`}>{t.status}</span></div><div className="meta"><span>{t.zone}</span><span>{t.guests} pax</span></div><div className="meta"><span>Camarero</span><b>{getStaff(t.waiterId).name}</b></div>{isAdmin && <div className="meta"><span>Cuenta</span><b>{money(t.bill)}</b></div>}<p style={{color:"var(--muted)",fontSize:12,minHeight:34}}>{t.lastMessage || "Sin mensajes recientes"}</p><div className="tip-box" style={{marginTop:10}}><small style={{color:"var(--muted)"}}>Propina 10%</small><div style={{display:"flex",justifyContent:"space-between",marginTop:4}}><b>{t.tipAccepted ? "Aceptada" : "No agregada"}</b><span>{money(t.tipAmount)}</span></div></div><div className="field" style={{marginTop:10}}><label>Asignar camarero</label><select className="input" value={t.waiterId || ""} onChange={(e)=>state.assignWaiter(t.id, e.target.value)}><option value="">Sin asignar</option>{STAFF.filter((s)=>s.role === "camarero").map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div className="table-actions"><button className="btn primary" onClick={()=>setSelectedTable(t)}>Atender</button><button className="btn ghost" onClick={()=>setSelectedTable(t)}>Ver ficha</button></div></div>)}</div></div>{selectedTable && <TableDrawer table={selectedTable} role={role} staffId={staffId} state={state} onClose={()=>setSelectedTable(null)} />}</div>;
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

function KitchenView({ state }) {
  const columns = {
    received: state.orders.filter((o)=>o.status.includes("Recibido")),
    preparing: state.orders.filter((o)=>o.status.includes("Preparando") || o.status.includes("Cocina")),
    ready: state.orders.filter((o)=>o.status.includes("Listo")),
    delivered: state.orders.filter((o)=>o.status.includes("Servido")),
  };

  const nextStatus = {
    received: "Preparando",
    preparing: "Listo para servir",
    ready: "Servido",
  };

  return <div className="grid"><div className="panel"><div className="panel-head"><div><h2>Pantalla cocina</h2><p style={{margin:"4px 0 0"}}>Flujo operativo en tiempo real conectado con mesas y camareros.</p></div><span className="badge red">LIVE</span></div><div className="kitchen-board">{Object.entries(KITCHEN_COLUMNS).map(([key,label])=><div className="kitchen-col" key={key}><div className="panel-head"><h2 style={{fontSize:22}}>{label}</h2><span className="badge">{columns[key].length}</span></div>{columns[key].map((o)=><div className="kitchen-ticket" key={o.id}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><h4>{o.id}</h4><span className={`badge ${statusBadge(o.priority)}`}>{o.priority}</span></div><p>Mesa {o.table} · {getStaff(o.waiterId).name}</p><div className="dish-lines">{o.items.map((i,idx)=><div className="dish-line" key={idx}><span>{i.qty}× {i.dish}</span><b>{i.status}</b></div>)}</div><p style={{marginTop:10}}>ETA {o.eta} min</p>{nextStatus[key] && <button className="btn primary" style={{width:"100%",marginTop:10}} onClick={()=>state.updateOrderStatus(o.id,nextStatus[key])}>{nextStatus[key]}</button>}</div>)}</div>)}</div></div></div>;
}

function CashCloseReport({ session, userId }) {
  const user = getStaff(userId || session.currentUser);
  return <div className="close-report"><h2>Cierre de caja</h2><div className="muted2">{RESTAURANT.legalName} · RUT {RESTAURANT.rut}<br />Turno {session.activeTurn} · Responsable {user.name}<br />Apertura {session.openedAt} · Cierre {session.closedAt || "pendiente"}</div><div className="report-grid"><div className="report-box"><span>Fondo inicial</span><b>{money(session.openingCash)}</b></div><div className="report-box"><span>Efectivo</span><b>{money(session.cash)}</b></div><div className="report-box"><span>Tarjeta</span><b>{money(session.card)}</b></div><div className="report-box"><span>Transferencia</span><b>{money(session.transfer)}</b></div><div className="report-box"><span>Propinas</span><b>{money(session.tips)}</b></div><div className="report-box"><span>Gastos</span><b>{money(session.expenses)}</b></div><div className="report-box"><span>Total esperado</span><b>{money(session.expected)}</b></div><div className="report-box"><span>Diferencia</span><b>{money(session.difference)}</b></div></div><h3>Historial del turno</h3>{session.history.slice(0,6).map((h,idx)=><div className="receipt-row" key={idx}><span>{h.time} · {getStaff(h.userId).name}</span><b>{h.action}</b></div>)}<div className="signature-line">Firma responsable: {user.name}</div></div>;
}

function CashClosingView({ state, staffId }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [turn, setTurn] = useState(state.cashSession.activeTurn);
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
  return <div className="grid"><div className="shift-banner"><div><h2 style={{margin:0,fontFamily:"Playfair Display",fontSize:30}}>Caja {session.status}</h2><p style={{margin:"6px 0 0",color:"var(--muted)"}}>Turno {session.activeTurn} · Responsable actual: {responsible.name} · Apertura {session.openedAt}</p></div><div className="shift-actions"><button className="btn primary" onClick={()=>state.openCash(staffId)}>Abrir caja</button><button className="btn ghost" onClick={()=>state.closeTurn(staffId)}>Cerrar turno</button><button className="btn danger" onClick={()=>state.closeCash(staffId)}>Cerrar caja</button></div></div><div className="panel"><div className="panel-head"><div><h2>Cambio de turno</h2><p style={{margin:"4px 0 0"}}>Cada acción queda asociada al usuario responsable.</p></div><span className={`badge ${session.status === "abierta" ? "green" : "red"}`}>{session.status}</span></div><div className="form-grid"><div className="field"><label>Turno activo</label><select className="input" value={turn} onChange={(e)=>setTurn(e.target.value)}><option>Mañana</option><option>Tarde</option><option>Noche</option><option>Extra</option></select></div><div className="field"><label>Responsable</label><select className="input" value={staffId} disabled><option>{getStaff(staffId).name}</option></select></div></div><button className="btn primary" style={{marginTop:12}} onClick={()=>state.changeTurn(staffId, turn)}>Cambiar turno</button></div><ExpenseRegister state={state} staffId={staffId} /><div className="panel"><div className="panel-head"><div><h2>Cierre de caja</h2><p style={{margin:"4px 0 0"}}>Control diario de ventas, propinas y diferencias de caja.</p></div><span className={`badge ${diffOk ? "green" : "red"}`}>{diffOk ? "Cuadrado" : "Diferencia"}</span></div><div className="cash-grid"><div className="cash-card"><span>Efectivo</span><strong>{money(session.cash)}</strong></div><div className="cash-card"><span>Tarjeta</span><strong>{money(session.card)}</strong></div><div className="cash-card"><span>Transferencia</span><strong>{money(session.transfer)}</strong></div><div className="cash-card"><span>Propinas</span><strong>{money(session.tips)}</strong></div><div className="cash-card"><span>Gastos</span><strong>{money(session.expenses)}</strong></div></div></div><div className="two"><div className="panel"><div className="panel-head"><h2>Resumen final</h2><span className="badge blue">Caja</span></div><div className="list"><div className="row"><span className="badge">Esperado</span><div className="row-main"><b>Total esperado</b><small>Suma de ventas y métodos de pago</small></div><strong>{money(session.expected)}</strong></div><div className="row"><span className="badge green">Contado</span><div className="row-main"><b>Total contado</b><small>Conteo físico del turno</small></div><strong>{money(session.counted)}</strong></div><div className="row"><span className={`badge ${diffOk ? "green" : "red"}`}>Diferencia</span><div className="row-main"><b>Ajuste</b><small>Debe ser 0 para cierre correcto</small></div><strong>{money(session.difference)}</strong></div></div><div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}><button className="btn primary" onClick={()=>setReportOpen(true)}>Ver cierre</button><button className="btn ghost" onClick={()=>window.print()}>Imprimir</button><button className="btn ghost" onClick={downloadReport}>Descargar</button><button className="btn ghost" onClick={()=>setWhatsappOpen(true)}>WhatsApp</button></div></div><div className="panel"><div className="panel-head"><h2>Propinas registradas</h2><span className="badge">10%</span></div><div className="list">{state.tables.filter((t)=>t.bill > 0).map((t)=><div className="row" key={t.id}><span className={`badge ${t.tipAccepted ? "green" : "red"}`}>Mesa {t.id}</span><div className="row-main"><b>{getStaff(t.waiterId).name}</b><small>{t.tipAccepted ? "Cliente aceptó propina" : "Cliente rechazó propina"}</small></div><strong>{money(t.tipAmount)}</strong></div>)}</div></div></div><div className="panel"><div className="panel-head"><h2>Historial de caja/turno</h2><span className="badge purple">Auditoría</span></div><div className="list">{session.history.map((h,idx)=><div className="row" key={idx}><span className="badge">{h.time}</span><div className="row-main"><b>{h.action}</b><small>{h.detail}</small></div><strong>{getStaff(h.userId).name}</strong></div>)}</div></div>{reportOpen && <div className="modal-backdrop"><div className="modal"><div className="panel-head"><h2>Reporte de cierre</h2><button className="btn ghost" onClick={()=>setReportOpen(false)}>Cerrar</button></div><CashCloseReport session={session} userId={staffId} /><div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14}}><button className="btn ghost" onClick={downloadReport}>Descargar</button><button className="btn ghost" onClick={()=>setWhatsappOpen(true)}>WhatsApp</button><button className="btn primary" onClick={()=>window.print()}>Imprimir</button></div></div></div>}{whatsappOpen && <div className="modal-backdrop"><div className="modal"><div className="panel-head"><h2>Enviar cierre por WhatsApp</h2><button className="btn ghost" onClick={()=>setWhatsappOpen(false)}>Cerrar</button></div><div className="whatsapp-card"><b>Mensaje listo para enviar</b><p style={{color:"var(--muted)",lineHeight:1.5}}>Se enviará resumen del cierre, responsable, métodos de pago, propinas y diferencia.</p><a className="btn primary" style={{display:"inline-block",textDecoration:"none"}} href={whatsappUrl} target="_blank" rel="noreferrer">Abrir WhatsApp</a></div></div></div>}</div>;
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
  const low = state.inventory.filter((i)=>i.status === "Bajo");
  return <div className="grid"><div className="kpis"><div className="kpi"><span>Ingredientes</span><strong>{state.inventory.length}</strong><small>Control operativo</small></div><div className="kpi"><span>Stock bajo</span><strong>{low.length}</strong><small>Ocultar platos si aplica</small></div><div className="kpi"><span>Platos afectados</span><strong>{low.reduce((s,i)=>s+i.linkedDishes.length,0)}</strong><small>Conexión con carta cliente</small></div><div className="kpi"><span>Actualización</span><strong>Live</strong><small>Cocina/Admin</small></div></div><div className="panel"><div className="panel-head"><div><h2>Inventario básico</h2><p style={{margin:"4px 0 0"}}>Cuando un ingrediente queda bajo o agotado, Admin puede ocultar el plato en la carta del cliente.</p></div><span className="badge red">Stock crítico</span></div><div className="list">{state.inventory.map((i)=><div className={`row ${i.status === "Bajo" ? "inventory-low" : ""}`} key={i.id}><span className={`badge ${i.status === "Bajo" ? "red" : "green"}`}>{i.status}</span><div className="row-main"><b>{i.name}</b><small>{i.category} · mínimo {i.min} {i.unit} · afecta: {i.linkedDishes.join(", ")}</small></div><div style={{display:"flex",gap:8,alignItems:"center"}}><input className="input" style={{width:90}} type="number" value={i.stock} onChange={(e)=>state.updateInventoryStock(i.id, e.target.value)} /><strong>{i.unit}</strong></div></div>)}</div></div></div>;
}

function QRCard({ q, state }) {
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
        <span className={`badge ${q.active ? "green" : "red"}`}>{q.active ? "Activo" : "Inactivo"}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "center", background: "#fff", borderRadius: 14, padding: 10, margin: "0 0 12px" }}>
        <canvas ref={canvasRef} style={{ borderRadius: 8 }} />
      </div>
      <div className="meta" style={{ marginBottom: 4 }}><span>Zona</span><b>{q.zone}</b></div>
      <div className="meta" style={{ marginBottom: 4 }}><span>Escaneos</span><b>{q.scans}</b></div>
      <div className="meta" style={{ marginBottom: 10 }}><span>Último scan</span><b>{q.lastScan}</b></div>
      <p style={{ color: "var(--muted)", fontSize: 11, wordBreak: "break-all", margin: "0 0 12px", lineHeight: 1.4 }}>{qrUrl}</p>
      <div style={{ display: "grid", gap: 8 }}>
        <div className="table-actions">
          <button className="btn ghost" onClick={downloadPng}>Descargar PNG</button>
          <button className="btn primary" onClick={printQr}>Imprimir QR</button>
        </div>
        <div className="table-actions">
          <button className="btn ghost" onClick={() => state.toggleQr(q.table)}>{q.active ? "Desactivar" : "Activar"}</button>
          <button className="btn ghost" onClick={() => state.regenerateQr(q.table)}>Regenerar token</button>
        </div>
      </div>
    </div>
  );
}

function QRView({ state }) {
  return (
    <div className="grid">
      <div className="panel">
        <div className="panel-head">
          <div><h2>QR de mesas</h2><p style={{ margin: "4px 0 0" }}>Descarga o imprime el QR de cada mesa. El cliente lo escanea y abre la carta directamente, sin instalar nada.</p></div>
          <span className="badge blue">Tokens</span>
        </div>
        <div className="three">
          {state.qrTokens.map((q) => <QRCard key={q.table} q={q} state={state} />)}
        </div>
      </div>
    </div>
  );
}

function StaffView() {
  const [editing, setEditing] = useState(null);
  return <div className="grid"><div className="panel"><div className="panel-head"><h2>Camareros y empleados</h2><span className="badge green">Fotos + trazabilidad</span></div><div className="three">{STAFF.map((s)=><div className="table-card" key={s.id}><div style={{display:"flex",gap:12,alignItems:"center"}}><StaffAvatar staff={s} className="staff-photo" /><div><h3>{s.name}</h3><p style={{margin:"3px 0",color:"var(--muted)"}}>{s.role === "admin" ? "Administrador" : "Camarero"} · {s.shift}</p></div></div><div className="meta"><span>Estado</span><span className={`badge ${s.status === "Activo" ? "green" : ""}`}>{s.status}</span></div><div className="meta"><span>Mesas</span><b>{s.tables.length ? s.tables.map((t)=>`#${t}`).join(", ") : "—"}</b></div><div className="meta"><span>Contacto</span><b>{s.phone}</b></div><div className="meta"><span>Ventas mesas</span><b>{money(TABLES.filter((t)=>t.waiterId === s.id).reduce((sum,t)=>sum+t.bill,0))}</b></div><button className="btn ghost" style={{width:"100%",marginTop:12}} onClick={()=>setEditing(s)}>Editar foto/datos</button></div>)}</div></div><div className="panel"><h2>Quién atendió cada mesa</h2><div className="list">{TABLES.filter((t)=>t.waiterId).map((t)=><div className="row" key={t.id}><span className="badge">Mesa {t.id}</span><div className="row-main"><b>{getStaff(t.waiterId).name}</b><small>{t.zone} · {t.guests} clientes · {t.status}</small></div><strong>{money(t.bill)}</strong></div>)}</div></div>{editing && <StaffEditor staff={editing} onClose={()=>setEditing(null)} />}</div>;
}

function StaffEditor({ staff, onClose }) {
  const [form, setForm] = useState(staff);
  const update = (key, value) => setForm((f)=>({ ...f, [key]: value }));
  return <div className="modal-backdrop"><div className="modal"><div className="panel-head"><div><h2>Editar empleado</h2><p style={{margin:"4px 0 0"}}>Demo visual: en producción guarda en users/staff y actualiza permisos RBAC.</p></div><button className="btn ghost" onClick={onClose}>Cerrar</button></div><div className="two" style={{gridTemplateColumns:".7fr 1.3fr"}}><div className="image-upload"><StaffAvatar staff={form} className="dish-thumb big" /><div className="field"><label>Foto empleado</label><input className="input" value={form.photoUrl || ""} onChange={(e)=>update("photoUrl", e.target.value)} placeholder="URL imagen/CDN" /></div><div className="image-actions"><button className="btn ghost" onClick={()=>update("photoUrl", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&auto=format&fit=crop")}>Hombre</button><button className="btn ghost" onClick={()=>update("photoUrl", "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&auto=format&fit=crop")}>Mujer</button></div></div><div className="form-grid"><div className="field"><label>Nombre</label><input className="input" value={form.name} onChange={(e)=>update("name", e.target.value)} /></div><div className="field"><label>Rol</label><select className="input" value={form.role} onChange={(e)=>update("role", e.target.value)}><option value="camarero">Camarero</option><option value="admin">Admin</option></select></div><div className="field"><label>Turno</label><input className="input" value={form.shift} onChange={(e)=>update("shift", e.target.value)} /></div><div className="field"><label>Estado</label><select className="input" value={form.status} onChange={(e)=>update("status", e.target.value)}><option>Activo</option><option>Pausa</option><option>Inactivo</option></select></div><div className="field"><label>Teléfono</label><input className="input" value={form.phone || ""} onChange={(e)=>update("phone", e.target.value)} /></div><div className="field"><label>Email</label><input className="input" value={form.email || ""} onChange={(e)=>update("email", e.target.value)} /></div></div></div><div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:14}}><button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={onClose}>Guardar cambios</button></div></div></div>;
}

function MenuView({ state }) {
  const [editing, setEditing] = useState(null);
  const openNew = () => setEditing({ id: `dish-${Date.now()}`, dish: "", category: "Principales", description: "", price: 0, avgPrep: 15, stock: "OK", available: true, visibleClient: true, tags: "", imageUrl: "" });
  const visibleClient = state.menuItems.filter((d) => d.available && d.visibleClient);
  return <div className="grid"><div className="two"><div className="panel"><div className="panel-head"><div><h2>Carta operativa</h2><p style={{margin:"4px 0 0"}}>Admin crea/edita platos. Lo visible aparece en el sistema del cliente QR.</p></div><button className="btn primary" onClick={openNew}>Nuevo plato</button></div><div className="list">{state.menuItems.map((d)=><div className="row" key={d.id}><span className={`badge ${d.available ? "green" : "red"}`}>{d.available ? "Activo" : "Oculto"}</span><img className="dish-thumb" src={d.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=900&auto=format&fit=crop"} alt={d.dish} /><div className="row-main"><b>{d.dish}</b><small>{d.category} · {money(d.price)} · Prep {d.avgPrep} min · Tags: {d.tags || "—"}</small><small>{d.description}</small></div><div style={{display:"flex", gap:8, flexWrap:"wrap", justifyContent:"flex-end"}}><button className="btn ghost" onClick={()=>setEditing(d)}>Editar</button><button className="btn ghost" onClick={()=>state.toggleMenuAvailability(d.id)}>{d.available ? "Desactivar" : "Activar"}</button><button className="btn danger" onClick={()=>state.deleteMenuItem(d.id)}>Eliminar</button></div></div>)}</div></div><div className="panel"><div className="panel-head"><h2>Vista cliente QR</h2><span className="badge blue">Sincronizada</span></div><div className="preview-phone">{visibleClient.length ? visibleClient.map((d)=><div className="client-dish" key={d.id}><div style={{display:"flex", gap:12}}><img className="dish-thumb" src={d.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=900&auto=format&fit=crop"} alt={d.dish} /><div style={{flex:1}}><div style={{display:"flex", justifyContent:"space-between", gap:10}}><h4>{d.dish}</h4><b className="price">{money(d.price)}</b></div><p>{d.description}</p><small style={{color:"var(--gold2)",fontWeight:900}}>{d.category} · {d.avgPrep} min</small></div></div></div>) : <p style={{color:"var(--muted)"}}>No hay platos visibles para el cliente.</p>}</div></div></div>{editing && <MenuEditor item={editing} onClose={()=>setEditing(null)} onSave={(item)=>{ state.saveMenuItem(item); setEditing(null); }} />}</div>;
}

function MenuEditor({ item, onClose, onSave }) {
  const [form, setForm] = useState(item);
  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const submit = () => {
    if (!form.dish.trim()) return alert("Nombre del plato requerido");
    if (!Number(form.price)) return alert("Precio requerido");
    onSave({ ...form, price: Number(form.price), avgPrep: Number(form.avgPrep || 0) });
  };
  return <div className="modal-backdrop"><div className="modal"><div className="panel-head"><div><h2>{item.dish ? "Editar plato" : "Nuevo plato"}</h2><p style={{margin:"4px 0 0"}}>Estos datos alimentan la carta del cliente QR y la operación de cocina.</p></div><button className="btn ghost" onClick={onClose}>Cerrar</button></div><div className="two" style={{gridTemplateColumns:".8fr 1.2fr", marginBottom:12}}><div className="image-upload"><img className="dish-thumb big" src={form.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=900&auto=format&fit=crop"} alt="Preview plato" /><div className="field"><label>Imagen del plato</label><input className="input" value={form.imageUrl || ""} onChange={(e)=>update("imageUrl", e.target.value)} placeholder="URL de imagen o CDN" /></div><div className="image-actions"><button className="btn ghost" onClick={()=>update("imageUrl", "https://images.unsplash.com/photo-1551183053-bf91a1d81141?q=80&w=900&auto=format&fit=crop")}>Pasta</button><button className="btn ghost" onClick={()=>update("imageUrl", "https://images.unsplash.com/photo-1535400255456-984241443b29?q=80&w=900&auto=format&fit=crop")}>Pescado</button><button className="btn ghost" onClick={()=>update("imageUrl", "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?q=80&w=900&auto=format&fit=crop")}>Postre</button></div><small style={{color:"var(--muted)"}}>En producción aquí sería upload a S3/Supabase Storage/Cloudinary y se guarda la URL en BD.</small></div><div><div className="form-grid"><div className="field"><label>Nombre</label><input className="input" value={form.dish} onChange={(e)=>update("dish", e.target.value)} placeholder="Ej: Ravioli al Limone" /></div><div className="field"><label>Categoría</label><select className="input" value={form.category} onChange={(e)=>update("category", e.target.value)}><option>Entradas</option><option>Principales</option><option>Postres</option><option>Bebidas</option><option>Promos</option></select></div><div className="field"><label>Precio</label><input className="input" type="number" value={form.price} onChange={(e)=>update("price", e.target.value)} /></div><div className="field"><label>Tiempo prep min</label><input className="input" type="number" value={form.avgPrep} onChange={(e)=>update("avgPrep", e.target.value)} /></div><div className="field"><label>Stock</label><select className="input" value={form.stock} onChange={(e)=>update("stock", e.target.value)}><option>OK</option><option>Bajo</option><option>Agotado</option></select></div><div className="field"><label>Tags</label><input className="input" value={form.tags} onChange={(e)=>update("tags", e.target.value)} placeholder="TOP,CHEF,Sin gluten" /></div></div><div className="field" style={{marginTop:10}}><label>Descripción visible en cliente</label><textarea className="textarea" value={form.description} onChange={(e)=>update("description", e.target.value)} /></div></div></div><div style={{display:"flex", gap:14, flexWrap:"wrap", margin:"14px 0"}}><label className="toggle"><input type="checkbox" checked={form.available} onChange={(e)=>update("available", e.target.checked)} /> Activo en carta</label><label className="toggle"><input type="checkbox" checked={form.visibleClient} onChange={(e)=>update("visibleClient", e.target.checked)} /> Visible para cliente QR</label></div><div style={{display:"flex", gap:10, justifyContent:"flex-end"}}><button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={submit}>Guardar y publicar</button></div></div></div>;
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

function SettingsView() {
  const [restaurant, setRestaurant] = useState(RESTAURANT);
  const [receiptConfig, setReceiptConfig] = useState(RECEIPT_CONFIG);
  const [showPrinterPanel, setShowPrinterPanel] = useState(true);
  const [demoMode, setDemoMode] = useState(true);
  const [webhooks, setWebhooks] = useState(LOCAL_WEBHOOKS);
  const [logs, setLogs] = useState([
    { time: "20:45", event: "DEMO_READY", status: "ok", detail: "Sistema local listo para simular n8n, QR e impresión." },
  ]);
  const updateRestaurant = (key, value) => setRestaurant((r)=>({ ...r, [key]: value }));
  const updateReceipt = (key, value) => setReceiptConfig((r)=>({ ...r, [key]: value }));
  const printReceipt = () => {
    setLogs((rows)=>[{ time: new Date().toLocaleTimeString("es-CL", { hour:"2-digit", minute:"2-digit" }), event: "PRINT_PREVIEW", status: "ok", detail: "window.print() ejecutado en modo local." }, ...rows]);
    window.print();
  };
  const updateWebhook = (key, value) => setWebhooks((w)=>({ ...w, [key]: value }));
  const simulateWebhook = async (event) => {
    const DEMO_PAYLOADS = {
      orderCreate: {
        restaurant_id: "holu",
        qr_token: "A7K92",
        table_id: 7,
        session_id: null,
        notes: "Test desde admin",
        items: [{ menu_item_id: "tagliatelle", dish_name: "Tagliatelle al Ragù", unit_price: 21500, qty: 1 }],
        total: 21500,
        channel: "admin-test",
      },
      camareroCall: {
        restaurant_id: "holu",
        qr_token: "A7K92",
        table_id: 7,
        call_type: "Camarero",
        message: "Test llamado desde admin",
      },
      kitchenCall: {
        restaurant_id: "holu",
        qr_token: "A7K92",
        table_id: 7,
        call_type: "Confirmar plato",
        message: "Test cocina desde admin",
      },
      billRequest: {
        restaurant_id: "holu",
        qr_token: "A7K92",
        table_id: 7,
      },
      feedback: {
        restaurant_id: "holu",
        qr_token: "A7K92",
        table_id: 7,
        rating: 5,
        comment: "Test feedback desde admin",
        source: "table_qr",
      },
      receiptPrint: {
        restaurant_id: "holu",
        qr_token: "A7K92",
        table_id: 7,
        items: [{ dish_name: "Tagliatelle al Ragù", unit_price: 21500, qty: 1 }],
        total: 21500,
      },
      cashClose: {
        restaurant_id: "holu",
        session_id: "SHIFT-TEST",
        cash: 428500,
        card: 691200,
        total: 1119700,
      },
    };
    const payload = DEMO_PAYLOADS[event] || { restaurant_id: "holu", event, source: "admin-test" };
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
  return <div className="grid"><div className="two"><div className="panel"><div className="panel-head"><h2>Datos del restaurante</h2><span className="badge green">Boleta</span></div><div className="config-grid"><div className="field"><label>Nombre comercial</label><input className="input" value={restaurant.name} onChange={(e)=>updateRestaurant("name", e.target.value)} /></div><div className="field"><label>Razón social</label><input className="input" value={restaurant.legalName} onChange={(e)=>updateRestaurant("legalName", e.target.value)} /></div><div className="field"><label>RUT</label><input className="input" value={restaurant.rut} onChange={(e)=>updateRestaurant("rut", e.target.value)} /></div><div className="field"><label>Teléfono</label><input className="input" value={restaurant.phone} onChange={(e)=>updateRestaurant("phone", e.target.value)} /></div><div className="field" style={{gridColumn:"1/-1"}}><label>Dirección</label><input className="input" value={restaurant.address} onChange={(e)=>updateRestaurant("address", e.target.value)} /></div><div className="field"><label>Web</label><input className="input" value={restaurant.website} onChange={(e)=>updateRestaurant("website", e.target.value)} /></div><div className="field"><label>Impresora</label><input className="input" value={receiptConfig.printer} onChange={(e)=>updateReceipt("printer", e.target.value)} /></div><div className="field"><label>IP impresora / estación</label><input className="input" value={receiptConfig.printerIp} onChange={(e)=>updateReceipt("printerIp", e.target.value)} /></div><div className="field"><label>Ancho papel</label><select className="input" value={receiptConfig.paperWidth} onChange={(e)=>updateReceipt("paperWidth", e.target.value)}><option>58mm</option><option>80mm</option></select></div><div className="field"><label>Modo impresión</label><input className="input" value={receiptConfig.printMode} onChange={(e)=>updateReceipt("printMode", e.target.value)} /></div></div></div><div className="panel"><div className="panel-head"><h2>Diseño de boleta</h2><button className="btn primary" onClick={printReceipt}>Generar boleta impresa</button></div><div className="config-grid"><div className="field"><label>Título</label><input className="input" value={receiptConfig.title} onChange={(e)=>updateReceipt("title", e.target.value)} /></div><div className="field"><label>Texto impuesto</label><input className="input" value={receiptConfig.taxLabel} onChange={(e)=>updateReceipt("taxLabel", e.target.value)} /></div><div className="field" style={{gridColumn:"1/-1"}}><label>Pie de ticket</label><input className="input" value={receiptConfig.footer} onChange={(e)=>updateReceipt("footer", e.target.value)} /></div></div><div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:12}}><label className="toggle"><input type="checkbox" checked={receiptConfig.showWaiter} onChange={(e)=>updateReceipt("showWaiter", e.target.checked)} /> Mostrar camarero</label><label className="toggle"><input type="checkbox" checked={receiptConfig.showQr} onChange={(e)=>updateReceipt("showQr", e.target.checked)} /> Mostrar QR reseña</label></div><p className="print-preview-note">Formato pensado para impresora térmica {receiptConfig.paperWidth}: tipografía monoespaciada, contraste alto, separadores limpios y QR visible para reseña.</p>
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

function SessionLogin({ onAuth }) {
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
      <p style={{ color:"var(--dim)", fontSize:12, textAlign:"center", margin:0 }}>¿Sin cuenta? Regístrate en holu.app</p>
    </div>
  );
}

function PinGate({ onAuth }) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState(false);

  const handleDigit = (d) => {
    if (digits.length >= 4) return;
    const next = digits + d;
    setDigits(next);
    if (next.length === 4) {
      const found = STAFF.find((s) => s.pin === next);
      if (found) {
        onAuth(found);
      } else {
        setError(true);
        setTimeout(() => { setDigits(""); setError(false); }, 800);
      }
    }
  };

  const handleDel = () => setDigits((d) => d.slice(0, -1));

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0f1117", gap: 32 }}>
      <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 4, color: "#fff" }}>HOLU</div>
      <div style={{ fontSize: 14, color: "#888" }}>Ingresa tu PIN</div>
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
    </div>
  );
}

export default function HoluAdmin() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem("holu:session") || "null"); } catch { return null; }
  });
  const [authed, setAuthed] = useState(() => {
    try {
      const staff = JSON.parse(sessionStorage.getItem("holu:staff") || "null");
      return staff && session ? staff : null;
    } catch { return null; }
  });
  const [role, setRole] = useState(authed?.role || "camarero");
  const [staffId, setStaffId] = useState(authed?.id || "w1");
  const [tab, setTab] = useState("dashboard");
  const state = useBackofficeState(session?.access_token || null);
  const safeTab = role === "camarero" && ["sales", "staff", "inventory", "qr", "menu", "settings"].includes(tab) ? "dashboard" : tab;

  // useMemo MUST be before any conditional return (Rules of Hooks)
  const content = useMemo(() => {
    switch (safeTab) {
      case "tables": return <TablesView role={role} staffId={staffId} state={state} />;
      case "orders": return <OrdersView role={role} staffId={staffId} state={state} />;
      case "kitchen": return <KitchenView state={state} />;
      case "calls": return <CallsView role={role} staffId={staffId} state={state} />;
      case "messages": return <MessagesView role={role} staffId={staffId} state={state} />;
      case "sales": return <><CashClosingView state={state} staffId={staffId} /><SalesView /></>;
      case "staff": return <StaffView />;
      case "inventory": return <InventoryView state={state} />;
      case "qr": return <QRView state={state} />;
      case "menu": return <MenuView state={state} />;
      case "reviews": return <ReviewsView role={role} staffId={staffId} />;
      case "settings": return <SettingsView />;
      default: return <Dashboard role={role} staffId={staffId} state={state} />;
    }
  }, [safeTab, role, staffId, state]);

  const handleSessionAuth = (sess) => {
    try { localStorage.setItem("holu:session", JSON.stringify(sess)); } catch {}
    setSession(sess);
  };

  const handleStaffAuth = (staff) => {
    try { sessionStorage.setItem("holu:staff", JSON.stringify(staff)); } catch {}
    setAuthed(staff);
    setRole(staff.role);
    setStaffId(staff.id);
  };

  const handleLogout = () => {
    try { localStorage.removeItem("holu:session"); sessionStorage.removeItem("holu:staff"); } catch {}
    setSession(null);
    setAuthed(null);
    setRole("camarero");
    setStaffId("w1");
  };

  if (!session) return <SessionLogin onAuth={handleSessionAuth} />;
  if (!authed) return <PinGate onAuth={handleStaffAuth} />;

  return <Layout role={role} staffId={staffId} tab={safeTab} setTab={setTab} onLogout={handleLogout}>
    <Topbar role={role} staffId={staffId} />
    {content}
  </Layout>;
}
