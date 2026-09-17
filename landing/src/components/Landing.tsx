"use client";

import { useState } from "react";

const Icons = {
  phone: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg>,
  users: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  chef: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" y1="17" x2="18" y2="17"/></svg>,
  monitor: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,7 5.5,10.5 12,3"/></svg>,
  gift: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>,
  message: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  success: <svg width="52" height="52" viewBox="0 0 52 52" fill="none"><circle cx="26" cy="26" r="24" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2"/><path d="M15 26l8 8 14-14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  delivery: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>,
  telegram: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>,
  server: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><line x1="6" y1="7" x2="6.01" y2="7"/><line x1="6" y1="17" x2="6.01" y2="17"/></svg>,
};

const socialProof = [
  "Restaurantes modernos",
  "Cafés y brunch",
  "Fast food",
  "Bares y terrazas",
  "Dark kitchens",
  "Food trucks",
];

const showcase = [
  {
    icon: "phone",
    eyebrow: "Mesa · Cliente",
    title: "Mesas QR",
    desc: "Clientes viendo la carta digital desde su teléfono, haciendo pedidos y llamando al camarero directamente desde la mesa.",
    features: ["Carta visual con fotos y categorías", "Pedidos y llamado al camarero sin esperar", "Solicitud de cobro y reseña desde la mesa"],
    color: "#f0d48d",
  },
  {
    icon: "users",
    eyebrow: "Equipo · Salón",
    title: "Camareros conectados",
    desc: "El camarero toma pedidos desde una tablet y todo se envía automáticamente a cocina y caja en segundos.",
    features: ["Llamados de mesa en tiempo real", "Pedidos activos y estado de cada plato", "Coordinación con administración en vivo"],
    color: "#60a5fa",
  },
  {
    icon: "chef",
    eyebrow: "Cocina · Pantalla",
    title: "Cocina organizada",
    desc: "Los cocineros reciben pedidos en pantalla y notifican cuando cada plato está listo para entregar.",
    features: ["Pedidos organizados por prioridad", "Estado del plato actualizable al instante", "Sin papel, sin confusiones"],
    color: "#34d399",
  },
  {
    icon: "monitor",
    eyebrow: "Kiosco · Delivery",
    title: "Kiosco y Delivery",
    desc: "Dos formas más de vender, conectadas a la misma cocina y caja: una pantalla de autoservicio en barra, y tu propia página de pedidos a domicilio.",
    features: ["Kiosco: pedidos sin fila ni camarero", "Delivery: carta, pago y seguimiento en línea", "Todo llega organizado a la misma cocina"],
    color: "#a78bfa",
  },
];

const modules = [
  { name: "HOLU Mesas",          eyebrow: "Cliente en mesa",     desc: "Carta digital, pedidos, llamado al camarero, solicitud de cobro, propina, reseñas y seguimiento del pedido desde un QR." },
  { name: "HOLU Camareros",      eyebrow: "Equipo de servicio",  desc: "Llamados de mesa, pedidos activos, mensajes del cliente, mesas asignadas y colaboración del administrador en tiempo real." },
  { name: "HOLU Cocina",         eyebrow: "Pantalla de cocina",  desc: "Pedidos organizados por estado para acelerar el servicio, reducir errores y mantener al equipo coordinado." },
  { name: "HOLU Administración", eyebrow: "Control total",       desc: "Ventas, empleados, carta, QR de mesas, inventario, propinas, caja, turnos, boletas, reportes y auditoría." },
  { name: "HOLU Autoservicio",   eyebrow: "Tótem de barra",      desc: "Clientes hacen pedidos solos desde una pantalla en barra o mostrador, sin filas, sin esperar atención." },
  { name: "HOLU Delivery",       eyebrow: "Pedidos a domicilio", desc: "Página de pedidos a domicilio con tu carta, carrito, dirección, pago en línea y seguimiento del pedido en tiempo real." },
];

const metrics = [
  ["-40%", "menos tiempo perdido entre cocina y salón"],
  ["+22%", "más pedidos usando carta QR visual"],
  ["24/7",  "restaurante conectado desde cualquier lugar"],
];

const benefits = [
  "Aumenta el ticket promedio con una carta visual, ordenada y fácil de usar.",
  "Reduce esperas entre cliente, camarero, cocina y caja.",
  "Centraliza pedidos, llamados, cobros, propinas, reseñas y boletas.",
  "Convierte cada mesa en una experiencia moderna y conectada.",
  "Permite operar con roles claros: administración, camareros, cocina y caja.",
  "Entrega una imagen premium y diferente frente a otros restaurantes.",
];

// Precios de la sección "#precios" (activación manual por WhatsApp). El
// formulario de "Quiero mi cuenta" más abajo cobra automático vía
// MercadoPago con sus propios montos en CLP definidos en n8n — son dos
// cosas distintas a propósito, no las mezcles al editar precios acá.
const TIERS = [
  {
    key: "mesa",
    name: "Sistema Completo",
    monthly: 15,
    annual: 126,
    tag: null,
    blurb: "Mesa, camareros, cocina, caja y administración — todo en un solo sistema.",
    features: [
      "Administración completa: carta, inventario, reportes y empleados",
      "Mesas con QR y carta digital premium",
      "Camareros con su propio perfil y sus mesas asignadas",
      "Pantalla de cocina organizada, sin papel",
      "Caja, turnos, boletas y propinas",
    ],
  },
  {
    key: "delivery",
    name: "Completo + Kiosco + Delivery",
    monthly: 25,
    annual: 210,
    tag: "Más elegido",
    blurb: "Todo lo anterior, más tu kiosco de autoservicio y tu propia página de delivery.",
    features: [
      "Todo lo del plan Sistema Completo",
      "Kiosco de autoservicio en pantalla, sin filas",
      "Delivery propio: carta, pedido, dirección y pago — sin comisión de apps externas",
      "Seguimiento del pedido en vivo para el cliente",
    ],
  },
];

// Mini pantallas interactivas dentro de la sección de precios — no llaman al
// backend, solo muestran cómo se siente pedir en kiosco y en delivery.
const KIOSCO_ITEMS = [
  { id: "k1", name: "Hamburguesa", price: 6500, img: "🍔", bg: "linear-gradient(160deg,rgba(240,212,141,.32),rgba(200,169,107,.12))" },
  { id: "k2", name: "Papas fritas", price: 3000, img: "🍟", bg: "linear-gradient(160deg,rgba(251,191,36,.32),rgba(240,212,141,.12))" },
  { id: "k3", name: "Limonada", price: 2500, img: "🍋", bg: "linear-gradient(160deg,rgba(163,230,53,.32),rgba(52,211,153,.12))" },
  { id: "k4", name: "Helado", price: 3500, img: "🍦", bg: "linear-gradient(160deg,rgba(96,165,250,.32),rgba(167,139,250,.12))" },
];

const DELIVERY_ITEMS = [
  { id: "d1", name: "Pizza familiar", price: 12000, img: "🍕", bg: "linear-gradient(160deg,rgba(251,146,60,.32),rgba(240,212,141,.12))" },
  { id: "d2", name: "Gaseosa 1.5L", price: 2500, img: "🥤", bg: "linear-gradient(160deg,rgba(96,165,250,.32),rgba(52,211,153,.12))" },
];

function clp(n: number) {
  return `$${n.toLocaleString("es-CL")}`;
}

// El plan a medida no tiene precio de lista a propósito: es un servidor
// dedicado por restaurante, se cotiza según lo que cada uno necesita.
const ENTERPRISE = {
  name: "A Medida — Servidor Dedicado",
  tag: "Personalizado",
  blurb: "Tu propio servidor, con tu marca — colores, logo y nombre propios en toda la experiencia — y dos agentes de IA trabajando para ti las 24 horas.",
  agents: [
    {
      name: "Agente de WhatsApp",
      icon: "message",
      color: "#25d366",
      desc: "Responde, arma el pedido conversando con el cliente y lo cobra — vendiendo directo por chat, sin que nadie del equipo tenga que escribir.",
      chat: [
        { who: "in", text: "Hola! Quiero pedir 2 hamburguesas y una limonada" },
        { who: "out", text: "¡Buenas! Anoté 2 Hamburguesas Clásicas y 1 Limonada 🍔 ¿Retiras o te lo llevamos?" },
        { who: "in", text: "Delivery, mi dirección es Av. Principal 482" },
        { who: "out", text: "El total es $18.500. Te mando el link para pagar 👇" },
        { who: "out", text: "✅ Pago recibido — tu pedido ya está en cocina" },
      ],
    },
    {
      name: "Agente de Telegram",
      icon: "telegram",
      color: "#60a5fa",
      desc: "Tu mano derecha con toda la información del restaurante: ventas del día, alertas de inventario, reportes — lo que necesites, con solo preguntarle.",
      chat: [
        { who: "in", text: "¿Cómo van las ventas hoy?" },
        { who: "out", text: "Vas en $184.500 con 12 pedidos. El más vendido: Hamburguesa Clásica (9 veces) 📈" },
        { who: "in", text: "¿Por qué se demoró el pedido de la mesa 5?" },
        { who: "out", text: "Estuvo 14 min en cocina, 4 más que el promedio — hubo 3 pedidos a la vez a las 20:15" },
      ],
    },
  ],
  includes: [
    "Todo el sistema: Admin, Mesa, Camareros, Cocina, Caja, Kiosco y Delivery",
    "Servidor con capacidad dedicada, exclusiva para tu restaurante",
    "Colores, logo y nombre propios en toda la experiencia del cliente",
    "Los dos agentes configurados con el tono y los datos de tu negocio",
  ],
};

// Cada extensión se conecta al mismo Admin gratuito — no son sistemas
// aparte, ni instalaciones aparte, ni cartas aparte.
const salesChannels = [
  {
    key: "mesa",
    name: "Mesa QR",
    tagline: "Pedidos desde la mesa",
    desc: "El cliente escanea el código de su mesa, ve la carta y pide desde su teléfono. Menos errores, menos espera, camareros libres para atender mejor.",
    color: "#f0d48d",
    icon: "phone",
  },
  {
    key: "kiosco",
    name: "Kiosco",
    tagline: "Autoservicio en barra",
    desc: "Una pantalla en barra o mostrador para pedidos rápidos en horas de más movimiento, sin filas ni esperar atención.",
    color: "#a78bfa",
    icon: "monitor",
  },
  {
    key: "delivery",
    name: "Delivery",
    tagline: "Tu propia página de pedidos",
    desc: "Vende a domicilio directo, sin pagarle una comisión del 25-30% a las apps de delivery por cada pedido.",
    color: "#34d399",
    icon: "delivery",
  },
];

const teamRoles = [
  {
    key: "camarero",
    name: "Camarero",
    tagline: "Su propio perfil",
    desc: "Cada camarero entra con su PIN y ve solo sus mesas, sus llamados y sus pedidos activos — nadie comparte una sola pantalla para todo el salón.",
    color: "#60a5fa",
    icon: "users",
  },
  {
    key: "cocina",
    name: "Cocina",
    tagline: "Pantalla propia",
    desc: "Los pedidos entran organizados por prioridad, sin papel ni gritar la comanda — cada plato se marca listo desde la pantalla de cocina.",
    color: "#fb923c",
    icon: "chef",
  },
];

const stats = [
  ["4 roles",   "Mesas, camareros, cocina y caja"],
  ["1 QR",      "Toda la experiencia desde la mesa"],
  ["En vivo",   "Todo sincronizado en tiempo real"],
  ["+2 canales", "Suma kiosco y delivery cuando quieras"],
  ["Cloud",     "Accede desde cualquier dispositivo"],
];

const faqs = [
  { q: "¿Qué incluye el plan base?", a: "El plan Sistema Completo ($15/mes) incluye todo lo esencial: mesas con QR, camareros con su propio perfil, pantalla de cocina, caja y administración completa. Si además quieres kiosco de autoservicio y tu propia página de delivery, subes al siguiente plan por $25/mes." },
  { q: "¿HOLU reemplaza al camarero?",         a: "No. HOLU ayuda al equipo a trabajar mejor. El camarero sigue siendo clave para la atención, la experiencia humana y el cobro presencial cuando corresponde." },
  { q: "¿Funciona con QR por mesa?",           a: "Sí. Cada mesa tiene un QR único. El cliente entra directamente a la experiencia de su mesa y todo queda conectado con pedidos, cocina, camareros y administración." },
  { q: "¿Puedo agregar o editar platos?",       a: "Sí. Desde administración puedes crear platos, cambiar precios, subir imágenes, activar o desactivar disponibilidad y decidir qué ve el cliente." },
  { q: "¿El sistema incluye propinas y caja?",  a: "Sí. HOLU permite registrar propinas aceptadas o rechazadas, abrir caja, cerrar caja, cambiar turnos, imprimir cierres y revisar reportes." },
  { q: "¿Qué es el tótem de autoservicio?",    a: "Es una pantalla en barra o mostrador desde donde los clientes hacen sus propios pedidos sin esperar atención. Está conectada en tiempo real con cocina, caja y administración, e incluye también tu página de delivery en el mismo plan." },
  { q: "¿Sirve para comida rápida o cafés?",   a: "Sí. El tótem de autoservicio de barra es ideal para cafés, comida rápida y cualquier negocio con flujo alto de pedidos. Todo queda conectado a la misma carta, cocina y caja." },
];

const flow = [
  ["1", "Cliente escanea QR",                 "El cliente entra automáticamente a la experiencia de su mesa."],
  ["2", "Cliente pide o llama al camarero",   "Los pedidos, llamados y solicitudes llegan al instante."],
  ["3", "Cocina y equipo reciben en vivo",    "La cocina recibe pedidos organizados automáticamente y actualiza el estado del plato en segundos."],
  ["4", "Administración controla todo",       "Ventas, propinas, caja, cocina y operación conectados desde cualquier dispositivo."],
];

const ORDERS = [
  { id: "ORD-0042", mesa: "Mesa 5", items: "2 hamburguesas · 1 limonada", status: "Preparando", c: "#f0d48d" },
  { id: "ORD-0041", mesa: "Mesa 2", items: "1 pasta · 2 aguas",           status: "Listo ✓",    c: "#34d399" },
  { id: "ORD-0040", mesa: "Mesa 7", items: "3 tacos · 1 cerveza",         status: "Entregando",  c: "#60a5fa" },
  { id: "ORD-0039", mesa: "Mesa 1", items: "1 salmón · 1 vino tinto",     status: "Cobrado",     c: "#6b7280" },
];

const TABLES = [
  { n: 1, s: "Libre",   bg: "rgba(255,255,255,.04)", tc: "#6b7280" },
  { n: 2, s: "Activa",  bg: "rgba(200,169,107,.09)", tc: "#f0d48d" },
  { n: 3, s: "Libre",   bg: "rgba(255,255,255,.04)", tc: "#6b7280" },
  { n: 4, s: "Cuenta",  bg: "rgba(52,211,153,.07)",  tc: "#34d399" },
  { n: 5, s: "Activa",  bg: "rgba(200,169,107,.09)", tc: "#f0d48d" },
  { n: 6, s: "Libre",   bg: "rgba(255,255,255,.04)", tc: "#6b7280" },
  { n: 7, s: "Activa",  bg: "rgba(200,169,107,.09)", tc: "#f0d48d" },
  { n: 8, s: "Libre",   bg: "rgba(255,255,255,.04)", tc: "#6b7280" },
];

const WA = "https://wa.me/56992103974";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
:root{--bg:#060605;--line:rgba(255,255,255,.1);--text:#fff8ed;--muted:#b0a396;--dim:#6a6058;--gold:#c8a96b;--gold2:#f0d48d;--green:#34d399;--shadow:0 28px 90px rgba(0,0,0,.48)}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(circle at 12% -8%,rgba(200,169,107,.18),transparent 32%),radial-gradient(circle at 100% 18%,rgba(255,255,255,.05),transparent 28%),#050504;color:var(--text);font-family:Manrope,system-ui,sans-serif;font-size:16px;line-height:1.5}
a{color:inherit;text-decoration:none}
.page{overflow:hidden}
.container{width:min(1160px,calc(100% - 40px));margin:auto}

.nav{position:sticky;top:0;z-index:40;background:rgba(6,6,5,.88);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}
.nav-in{height:110px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.nav-links{display:flex;align-items:center;gap:22px;color:var(--muted);font-weight:500;font-size:14px}
.nav-links a:not(.btn):hover{color:var(--text)}

.btn{border:0;border-radius:14px;padding:12px 20px;font-weight:600;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:.2s ease}
.btn.primary{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#160f02;box-shadow:0 12px 32px rgba(200,169,107,.2)}
.btn.primary:hover{box-shadow:0 16px 44px rgba(200,169,107,.34);transform:translateY(-1px)}
.btn.ghost{background:rgba(255,255,255,.07);border:1px solid var(--line);color:var(--text)}
.btn.ghost:hover{background:rgba(255,255,255,.11)}
.btn.wa{background:linear-gradient(135deg,#25d366,#128c48);color:#fff;box-shadow:0 10px 28px rgba(37,211,102,.22)}
.btn.wa:hover{box-shadow:0 14px 36px rgba(37,211,102,.34);transform:translateY(-1px)}

.hero{position:relative;padding:80px 0 52px}
.hero-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
.eyebrow{color:var(--gold2);font-weight:600;letter-spacing:.12em;font-size:11px;text-transform:uppercase}
.hero h1{font-size:clamp(48px,6.5vw,84px);font-weight:700;line-height:.88;letter-spacing:-.06em;margin:14px 0 18px;color:#fff}
.hero p{color:var(--muted);font-size:17px;line-height:1.75;max-width:520px}
.cta-row{display:flex;gap:12px;flex-wrap:wrap;margin-top:26px}
.trust{display:flex;gap:18px;flex-wrap:wrap;margin-top:22px;color:var(--dim);font-size:13px;font-weight:500}
.trust span{display:flex;gap:7px;align-items:center}
.dot{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 0 4px rgba(52,211,153,.12);flex:0 0 auto}
.logos{display:flex;gap:8px;flex-wrap:wrap;margin-top:22px}
.logo-pill{padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid var(--line);color:#c8bba8;font-size:12px;font-weight:500}
.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:22px}
.metric{padding:16px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid var(--line)}
.metric b{display:block;font-size:28px;font-weight:700;color:var(--gold2);line-height:1}
.metric span{display:block;color:var(--muted);margin-top:6px;line-height:1.4;font-size:13px}

/* TABLET */
.tablet-outer{display:flex;justify-content:center;align-items:flex-start;perspective:1600px}
.tablet-frame{
  position:relative;width:440px;
  border-radius:38px;
  background:linear-gradient(165deg,#56565a 0%,#28282c 40%,#1c1c1e 100%);
  padding:18px 13px 22px;
  box-shadow:
    0 0 0 1px rgba(255,255,255,.1),
    inset 0 1px 0 rgba(255,255,255,.16),
    inset 0 -1px 0 rgba(0,0,0,.5),
    inset 1px 0 0 rgba(255,255,255,.07),
    inset -1px 0 0 rgba(0,0,0,.4),
    0 60px 140px rgba(0,0,0,.72),
    0 24px 48px rgba(0,0,0,.38);
  transform:rotateY(-7deg) rotateX(3deg);
}
.tablet-camera{width:9px;height:9px;border-radius:50%;background:#0a0a0c;box-shadow:0 0 0 1.5px rgba(255,255,255,.08),inset 0 0 4px rgba(80,160,255,.35);margin:0 auto 10px}
.tablet-home{width:72px;height:4px;border-radius:4px;background:rgba(255,255,255,.16);margin:10px auto 0}
.tablet-screen{border-radius:24px;background:#08080f;overflow:hidden;border:1px solid rgba(0,0,0,.7)}
.tablet-btn-right{position:absolute;right:-3px;top:110px;width:3px;height:52px;border-radius:0 3px 3px 0;background:linear-gradient(180deg,#3a3a3c,#2a2a2c);box-shadow:2px 0 4px rgba(0,0,0,.4)}
.tablet-btn-vol1{position:absolute;left:-3px;top:100px;width:3px;height:38px;border-radius:3px 0 0 3px;background:linear-gradient(180deg,#3a3a3c,#2a2a2c);box-shadow:-2px 0 4px rgba(0,0,0,.4)}
.tablet-btn-vol2{position:absolute;left:-3px;top:148px;width:3px;height:38px;border-radius:3px 0 0 3px;background:linear-gradient(180deg,#3a3a3c,#2a2a2c);box-shadow:-2px 0 4px rgba(0,0,0,.4)}
.tab-topbar{background:linear-gradient(135deg,#0d0c14,#130f07);padding:14px 16px 12px;border-bottom:1px solid rgba(255,255,255,.06)}
.tab-topbar-row{display:flex;justify-content:space-between;align-items:center}
.tab-brand{font-size:15px;font-weight:700;letter-spacing:-.04em}
.tab-live{font-size:10px;color:#8ff0c5;background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.22);border-radius:999px;padding:4px 9px;font-weight:600;animation:pulse 2.4s infinite}
.tab-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px}
.tab-stat{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:8px 10px}
.tab-stat b{display:block;font-size:15px;font-weight:700;color:#f0d48d;line-height:1}
.tab-stat span{display:block;font-size:10px;color:#6a6058;margin-top:3px}
.tab-section{padding:12px 14px}
.tab-label{font-size:10px;color:#c8a96b;letter-spacing:.1em;text-transform:uppercase;font-weight:600;margin-bottom:8px}
.tab-order{display:flex;justify-content:space-between;align-items:center;padding:9px 11px;border-radius:10px;background:rgba(255,255,255,.034);border:1px solid rgba(255,255,255,.055);margin-bottom:5px}
.tab-order-info b{font-size:12px;font-weight:600;display:block}
.tab-order-info span{font-size:10px;color:#6a6058;display:block;margin-top:2px}
.tab-badge{font-size:10px;border-radius:999px;padding:3px 8px;font-weight:600;white-space:nowrap}
.tab-tables{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
.tab-table{border:1px solid rgba(255,255,255,.06);border-radius:9px;padding:7px 4px;text-align:center}
.tab-table b{display:block;font-size:13px;font-weight:700;line-height:1}
.tab-table span{display:block;font-size:9px;margin-top:3px}
.tab-footer{padding:10px 14px;border-top:1px solid rgba(255,255,255,.05);display:flex;gap:6px}
.tab-footbtn{flex:1;border-radius:10px;padding:9px 6px;font-size:11px;font-weight:600;text-align:center;cursor:pointer;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:var(--muted)}
.tab-footbtn.active{background:linear-gradient(135deg,rgba(200,169,107,.18),rgba(255,255,255,.04));border-color:rgba(240,212,141,.24);color:var(--gold2)}

/* STATS */
.stats-shell{margin-top:32px}
.stats-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
.stats::-webkit-scrollbar{display:none}
.stat{border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.02));border:1px solid var(--line);padding:16px;min-width:160px}
.stat b{font-size:22px;color:var(--gold2);display:block;font-weight:700;line-height:1}
.stat span{display:block;color:var(--muted);font-size:12px;margin-top:6px;line-height:1.4}

.section{padding:72px 0}
.section-head{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:28px}
.section h2{font-size:clamp(36px,5vw,58px);font-weight:700;line-height:.92;letter-spacing:-.05em;margin:0}
.section-head p{color:var(--muted);max-width:440px;line-height:1.7;font-size:15px}

.modules{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.card{border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid var(--line);padding:22px;transition:.2s ease}
.card:hover{transform:translateY(-2px);border-color:rgba(240,212,141,.18)}
.card .label{font-size:10px;color:var(--gold2);letter-spacing:.14em;text-transform:uppercase;font-weight:600}
.card h3{font-size:19px;margin:10px 0 8px;font-weight:600;letter-spacing:-.03em}
.card p{color:var(--muted);line-height:1.6;font-size:14px;margin:0}

.showcase-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.info-card{border-radius:28px;background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid var(--line);padding:28px;transition:.2s ease}
.info-card:hover{transform:translateY(-3px)}
.info-card-header{display:flex;align-items:center;gap:14px;margin-bottom:18px}
.info-icon{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;font-size:24px;flex:0 0 auto}
.info-title{font-size:clamp(20px,2.2vw,26px);font-weight:700;line-height:.95;margin:0 0 12px;letter-spacing:-.04em}
.info-desc{color:var(--muted);line-height:1.7;font-size:15px;margin:0 0 20px}
.info-features{display:grid;gap:10px}
.info-feature{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:#c8bba8;line-height:1.5}
.info-feature-check{font-weight:700;flex:0 0 auto;margin-top:1px}

.split{display:grid;grid-template-columns:.95fr 1.05fr;gap:16px;align-items:start}
.benefits{display:grid;gap:8px}
.benefit{display:flex;gap:12px;align-items:flex-start;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid var(--line);padding:14px;color:#e2d8cb;line-height:1.55;font-size:15px}
.check{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:rgba(52,211,153,.12);color:var(--green);font-weight:700;flex:0 0 auto;font-size:13px}

.demo-panel{border-radius:28px;background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid var(--line);padding:28px;box-shadow:var(--shadow)}
.flow-track{display:grid;gap:12px;margin-top:22px;grid-template-columns:repeat(2,1fr)}
.flow-card{display:grid;grid-template-columns:50px 1fr;gap:16px;align-items:flex-start;padding:0 0 16px;border-bottom:1px solid rgba(255,255,255,.06)}
.flow-card:last-child{padding-bottom:0;border-bottom:0}
.flow-number{width:50px;height:50px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);display:grid;place-items:center;font-size:17px;font-weight:700;color:var(--gold2);position:relative;top:2px}
.flow-content b{display:block;font-size:16px;font-weight:600;letter-spacing:-.02em;margin-bottom:5px}
.flow-content span{display:block;color:var(--muted);font-size:14px;line-height:1.6}

/* HUB — Admin como núcleo + todo lo que se le conecta (v2, sistema vivo) */
.hub-wrap{position:relative}
.hub-wrap::before{content:'';position:absolute;inset:-20px -40px auto;height:520px;background-image:radial-gradient(rgba(255,255,255,.055) 1px,transparent 1px);background-size:24px 24px;-webkit-mask-image:radial-gradient(ellipse 60% 55% at 50% 12%,#000,transparent 72%);mask-image:radial-gradient(ellipse 60% 55% at 50% 12%,#000,transparent 72%);pointer-events:none}
.hub{position:relative;display:flex;flex-direction:column;align-items:center;margin-top:16px}
.hub-core-wrap{position:relative}
.hub-core-wrap::before,.hub-core-wrap::after{content:'';position:absolute;inset:0;border-radius:28px;border:1px solid rgba(52,211,153,.45);animation:hubPulse 2.8s ease-out infinite;pointer-events:none}
.hub-core-wrap::after{animation-delay:1.4s}
@keyframes hubPulse{0%{transform:scale(1);opacity:.85}100%{transform:scale(1.18);opacity:0}}
.hub-core{position:relative;max-width:460px;width:100%;text-align:center;border-radius:28px;padding:34px 30px;background:linear-gradient(160deg,rgba(52,211,153,.16),rgba(255,255,255,.03));border:1px solid rgba(52,211,153,.4);box-shadow:0 26px 74px rgba(52,211,153,.18)}
.hub-badge{display:inline-block;background:rgba(52,211,153,.18);color:var(--green);border-radius:999px;padding:6px 14px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.hub-core h3{font-size:27px;margin:14px 0 8px;font-weight:700;letter-spacing:-.03em}
.hub-core p{color:var(--muted);font-size:14.5px;line-height:1.65;margin:0}

.hub-flow{position:relative;width:2px;height:42px;overflow:hidden;background:rgba(255,255,255,.09)}
.hub-flow::after{content:'';position:absolute;left:0;top:-100%;width:100%;height:200%;background:linear-gradient(180deg,transparent 0%,rgba(52,211,153,.95) 45%,rgba(240,212,141,.95) 55%,transparent 100%);animation:hubFlowDown 1.7s linear infinite}
@keyframes hubFlowDown{from{transform:translateY(0)}to{transform:translateY(50%)}}

.hub-group{width:100%;margin-top:6px}
.hub-group-label{display:flex;align-items:center;gap:10px;justify-content:center;color:var(--dim);font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin-bottom:18px}
.hub-group-label::before,.hub-group-label::after{content:'';height:1px;width:36px;background:rgba(255,255,255,.14)}

.hub-row{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;width:100%;position:relative}
.hub-row.hub-row-2{grid-template-columns:repeat(2,1fr);max-width:620px;margin:0 auto}
.hub-row::before{content:'';position:absolute;top:0;left:16.6%;right:16.6%;height:1px;background:rgba(255,255,255,.1)}
.hub-row.hub-row-2::before{left:25%;right:25%}
.hub-row::after{content:'';position:absolute;top:-1px;left:16.6%;right:16.6%;height:2px;background:linear-gradient(90deg,transparent,rgba(240,212,141,.9),transparent);background-size:55% 100%;background-repeat:no-repeat;animation:hubFlowRight 2.6s linear infinite}
.hub-row.hub-row-2::after{left:25%;right:25%}
@keyframes hubFlowRight{0%{background-position:-55% 0}100%{background-position:155% 0}}

.hub-spoke{display:flex;flex-direction:column;align-items:center}
.hub-spoke-line{width:1px;height:22px;background:rgba(255,255,255,.14)}
.hub-card{width:100%;border-radius:22px;padding:22px 18px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.015));border:1px solid var(--line);text-align:center;transition:.25s ease}
.hub-card:hover{transform:translateY(-3px);box-shadow:0 18px 40px rgba(0,0,0,.34)}
.hub-icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;margin:0 auto 12px}
.hub-tag{display:inline-block;font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;border-radius:999px;padding:4px 10px;margin-bottom:8px}
.hub-card h4{margin:0 0 6px;font-size:17px;font-weight:700;letter-spacing:-.02em}
.hub-card p{color:var(--muted);font-size:12.5px;line-height:1.55;margin:0}
.hub-foot{text-align:center;color:var(--dim);font-size:13px;margin-top:32px;max-width:560px}
@media(max-width:900px){
  .hub-row,.hub-row.hub-row-2{grid-template-columns:1fr;gap:26px;max-width:320px;margin:0 auto}
  .hub-row::before,.hub-row::after{display:none}
}
@media(prefers-reduced-motion:reduce){.hub-core-wrap::before,.hub-core-wrap::after,.hub-flow::after,.hub-row::after{animation:none}}

/* PLANS */
.plan.highlight{border-color:rgba(240,212,141,.32);background:linear-gradient(145deg,rgba(200,169,107,.1),rgba(255,255,255,.03))}
.tag{position:absolute;top:14px;right:14px;border-radius:999px;background:rgba(52,211,153,.12);color:var(--green);font-size:11px;padding:6px 10px;font-weight:600;letter-spacing:.04em}
.price{font-size:30px;font-weight:700;color:var(--gold2);margin:12px 0}
.features{display:grid;gap:8px;margin:16px 0}
.features div{color:var(--muted);font-size:14px;line-height:1.4}

/* TIER GRID — dos niveles fijos + el plan a medida aparte */
.tier-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;align-items:stretch;max-width:760px;margin:0 auto}
.tier-card{position:relative;display:flex;flex-direction:column;border-radius:24px;padding:26px 24px;background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid var(--line)}
.tier-card.tier-full{border-color:rgba(240,212,141,.4);background:linear-gradient(160deg,rgba(200,169,107,.14),rgba(255,255,255,.03));box-shadow:0 22px 60px rgba(200,169,107,.14)}
.tier-name{font-size:19px;font-weight:700;letter-spacing:-.02em;margin:6px 0 6px}
.tier-blurb{color:var(--muted);font-size:13px;line-height:1.55;margin:0 0 14px;min-height:40px}
.tier-price{font-size:38px;font-weight:700;color:var(--gold2);line-height:1;margin-bottom:2px}
.tier-price small{font-size:13px;color:var(--muted);font-weight:500}
.tier-annual-note{color:var(--green);font-size:12px;font-weight:600;margin:0 0 14px}
.tier-features{display:grid;gap:8px;margin:14px 0 20px;flex:1}
.tier-features div{display:flex;gap:8px;align-items:flex-start;color:var(--muted);font-size:13.5px;line-height:1.5}
@media(max-width:760px){.tier-grid{grid-template-columns:1fr}}

/* DEMO SCREENS — kiosco y delivery de verdad, como si fueran la pantalla real */
.demo-screens{display:flex;justify-content:center;align-items:flex-start;gap:44px;flex-wrap:wrap;margin:0 0 44px}
.demo-col{display:flex;flex-direction:column;align-items:center;text-align:center;width:280px}
.demo-col-label{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-bottom:4px}
.demo-col-title{font-size:16.5px;font-weight:700;letter-spacing:-.02em;margin:0 0 18px;line-height:1.3}

.device-frame{position:relative;border-radius:32px;padding:14px 11px 18px;background:linear-gradient(165deg,#54545a 0%,#26262a 45%,#1a1a1c 100%);box-shadow:0 0 0 1px rgba(255,255,255,.09),inset 0 1px 0 rgba(255,255,255,.15),inset 0 -1px 0 rgba(0,0,0,.5),0 40px 90px rgba(0,0,0,.6)}
.device-cam{width:7px;height:7px;border-radius:50%;background:#0a0a0c;margin:0 auto 10px;box-shadow:0 0 0 1.5px rgba(255,255,255,.08)}
.device-notch{position:absolute;top:14px;left:50%;transform:translateX(-50%);width:64px;height:15px;border-radius:9px;background:#0a0a0c;z-index:2}
.device-screen{border-radius:20px;background:#0a0a10;overflow:hidden;border:1px solid rgba(0,0,0,.65)}
.device-topbar{padding:12px 14px 10px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;justify-content:space-between;align-items:center}
.device-topbar.centered{flex-direction:column;gap:2px;padding-top:22px}
.device-topbar b{font-size:12.5px;font-weight:700}
.device-topbar span{font-size:9px;color:#8ff0c5;background:rgba(52,211,153,.14);border-radius:999px;padding:3px 8px;font-weight:700;white-space:nowrap}
.device-topbar.centered span{background:none;padding:0;color:#6ee7b7}

.device-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px}
.device-tile{position:relative;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);padding:8px;cursor:pointer;text-align:left;font-family:inherit;color:inherit;transition:.15s ease}
.device-tile:hover{background:rgba(255,255,255,.08)}
.device-tile-img{width:100%;aspect-ratio:1;border-radius:10px;display:grid;place-items:center;font-size:26px;margin-bottom:6px}
.device-tile b{display:block;font-size:11px;font-weight:600}
.device-tile span{display:block;font-size:10px;color:var(--muted)}
.device-tile-qty{position:absolute;top:6px;right:6px;background:#a78bfa;color:#160f02;font-size:10px;font-weight:800;border-radius:999px;min-width:18px;height:18px;display:grid;place-items:center;padding:0 4px}

.device-list{padding:10px 12px;display:grid;gap:8px}
.device-item{display:flex;align-items:center;gap:9px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);padding:7px;cursor:pointer;text-align:left;font-family:inherit;color:inherit;transition:.15s ease;width:100%}
.device-item.sel{border-color:rgba(52,211,153,.5);background:rgba(52,211,153,.1)}
.device-item-img{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;font-size:16px;flex:0 0 auto}
.device-item-info{flex:1;min-width:0}
.device-item-info b{display:block;font-size:11.5px;font-weight:600}
.device-item-info span{display:block;font-size:10px;color:var(--muted)}
.device-item-check{width:16px;height:16px;border-radius:5px;border:1px solid rgba(255,255,255,.22);display:grid;place-items:center;flex:0 0 auto;color:transparent}

.device-addr{margin:0 12px 8px;width:calc(100% - 24px);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:7px 10px;color:var(--text);font-size:11px;font-family:inherit;outline:none}
.device-addr::placeholder{color:var(--dim)}

.device-bar{padding:10px 14px 14px;border-top:1px solid rgba(255,255,255,.06)}
.device-bar-row{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:8px}
.device-bar-row b{color:var(--gold2);font-size:13px}
.device-cta{width:100%;border:0;border-radius:12px;padding:10px;font-weight:700;font-size:12.5px;cursor:pointer;transition:.2s ease}
.device-cta:disabled{opacity:.4;cursor:not-allowed}
.device-done{display:flex;align-items:center;gap:6px;justify-content:center;padding:9px;border-radius:10px;font-size:11px;font-weight:600}

/* CHAT MOCK — conversación real de los agentes IA, sin teléfono grande */
.chat-head{display:flex;align-items:center;gap:8px;margin-top:16px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.08)}
.chat-head-dot{width:8px;height:8px;border-radius:50%;box-shadow:0 0 0 3px rgba(255,255,255,.06);flex:0 0 auto}
.chat-head span{font-size:11px;color:var(--dim);font-weight:600;letter-spacing:.02em}
.chat-mock{display:grid;gap:8px;margin-top:12px}
.chat-bubble{max-width:88%;padding:9px 12px;border-radius:14px;font-size:12.5px;line-height:1.5;opacity:0;transform:translateY(6px);animation:chatIn .5s ease forwards}
.chat-bubble.in{justify-self:end;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.1);border-bottom-right-radius:4px;color:#e8e0d4}
.chat-bubble.out{justify-self:start;border-bottom-left-radius:4px;color:#f2fbf6}
@keyframes chatIn{to{opacity:1;transform:translateY(0)}}
@media(prefers-reduced-motion:reduce){.chat-bubble{animation:none;opacity:1;transform:none}}

/* ENTERPRISE — plan a medida, sin precio de lista */
.enterprise{position:relative;overflow:hidden;margin:28px auto 0;max-width:920px;border-radius:28px;padding:36px 32px;background:linear-gradient(160deg,rgba(96,165,250,.1),rgba(37,211,102,.06),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.14)}
.enterprise::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 12% -10%,rgba(96,165,250,.16),transparent 42%),radial-gradient(circle at 90% 110%,rgba(37,211,102,.14),transparent 42%);pointer-events:none}
.enterprise-head{position:relative;display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap;margin-bottom:26px}
.enterprise-title{font-size:25px;font-weight:700;letter-spacing:-.03em;margin:10px 0 8px}
.enterprise-blurb{color:var(--muted);font-size:14.5px;line-height:1.65;max-width:440px;margin:0}
.enterprise-cta{display:flex;flex-direction:column;align-items:flex-start;gap:10px}
.enterprise-price{color:var(--dim);font-size:12.5px;font-weight:600}
.enterprise-agents{position:relative;display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:22px}
.enterprise-agent{border-radius:20px;padding:20px;background:rgba(255,255,255,.045);border:1px solid var(--line)}
.enterprise-agent-icon{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;margin-bottom:12px}
.enterprise-agent h4{margin:0 0 6px;font-size:16px;font-weight:700}
.enterprise-agent p{margin:0;color:var(--muted);font-size:13px;line-height:1.55}
.enterprise-includes{position:relative;display:grid;gap:8px;border-top:1px solid rgba(255,255,255,.1);padding-top:18px}
.enterprise-includes div{display:flex;gap:8px;align-items:flex-start;color:var(--muted);font-size:13px;line-height:1.5}
@media(max-width:760px){
  .enterprise{padding:28px 22px}
  .enterprise-agents{grid-template-columns:1fr}
  .enterprise-head{flex-direction:column}
}

/* REGISTER FORM */
.register-section{padding:80px 0;background:radial-gradient(circle at 50% 50%,rgba(200,169,107,.06),transparent 60%)}
.register-wrap{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
.register-form-box{border-radius:28px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025));border:1px solid var(--line);padding:32px;box-shadow:var(--shadow)}
.form-field{margin-bottom:14px}
.form-field label{display:block;font-size:13px;font-weight:600;color:var(--muted);margin-bottom:6px}
.form-field input{width:100%;background:rgba(255,255,255,.06);border:1px solid var(--line);border-radius:12px;padding:13px 16px;color:var(--text);font-size:15px;font-family:inherit;outline:none;transition:.2s ease}
.form-field input:focus{border-color:rgba(240,212,141,.4);background:rgba(255,255,255,.08)}
.form-field input::placeholder{color:var(--dim)}
.form-success{text-align:center;padding:24px 0}
.form-success .success-icon{display:flex;justify-content:center;margin-bottom:16px}
.form-success h4{font-size:22px;font-weight:700;margin:0 0 8px}
.form-success p{color:var(--muted);font-size:14px;line-height:1.7;margin:0 0 20px}
.register-benefits{display:grid;gap:10px;margin-top:24px}
.reg-benefit{display:flex;gap:10px;align-items:flex-start;color:#c8bba8;font-size:15px;line-height:1.5}
.reg-check{color:var(--green);font-size:16px;flex:0 0 auto;margin-top:1px}

/* FAQ */
.faq-accordion{display:grid;gap:10px}
.faq-item{border-radius:18px;border:1px solid var(--line);background:rgba(255,255,255,.03);overflow:hidden}
.faq-btn{width:100%;background:none;border:0;color:var(--text);display:flex;justify-content:space-between;align-items:center;padding:20px 22px;font-size:16px;font-weight:600;cursor:pointer;text-align:left;gap:16px}
.faq-btn:hover{background:rgba(255,255,255,.03)}
.faq-answer{padding:0 22px 20px;color:var(--muted);line-height:1.75;font-size:14px}
.faq-icon{font-size:22px;color:var(--gold2);flex:0 0 auto;line-height:1}

.final{padding:80px 0 96px;text-align:center}
.final-box{position:relative;overflow:hidden;border-radius:36px;background:radial-gradient(circle at 50% 0,rgba(200,169,107,.2),transparent 44%),linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border:1px solid var(--line);padding:64px 24px;box-shadow:var(--shadow)}
.final-box::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at top right,rgba(240,212,141,.1),transparent 32%);pointer-events:none}
.final-box h2{font-size:clamp(44px,6.5vw,96px);font-weight:700;line-height:.86;letter-spacing:-.07em;margin:12px auto 16px;position:relative;z-index:1}
.final-box p{color:var(--muted);max-width:640px;margin:0 auto 28px;line-height:1.8;position:relative;z-index:1}
.final-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;position:relative;z-index:1}

.footer{border-top:1px solid var(--line);padding:26px 0;color:var(--dim);font-size:13px}
.footer-in{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
.footer-legal{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid var(--line);color:var(--dim);font-size:12px}
.footer-legal-links{display:flex;gap:16px}
.footer-legal-links a{color:var(--dim)}
.footer-legal-links a:hover{color:var(--muted)}

@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.82;transform:scale(1.03)}}
@keyframes spin{to{transform:rotate(360deg)}}
.spinner{width:18px;height:18px;border:2px solid rgba(0,0,0,.2);border-top-color:#160f02;border-radius:50%;animation:spin .7s linear infinite}

a:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid var(--gold2);outline-offset:3px;border-radius:6px}
.nav-links a:not(.btn){min-height:44px;display:inline-flex;align-items:center;padding:0 6px}
@media(prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}

@media(max-width:960px){
  .nav-links a:not(.btn){display:none}
  .nav-in{height:80px}
  .hero{padding:48px 0 28px}
  .hero-grid,.split,.register-wrap{grid-template-columns:1fr}
  .hero h1{font-size:clamp(40px,9vw,62px)}
  .hero p{font-size:15px}
  .trust{display:none}
  .logos{display:none}
  .metrics{display:none}
  .stats-shell{display:none}
  .cta-row{margin-top:20px}
  .metrics,.modules,.showcase-grid,.flow-track{grid-template-columns:1fr}
  .section{padding:52px 0}
  .section-head{display:block}
  .tablet-outer{display:flex;justify-content:center;margin-top:24px;perspective:none}
  .tablet-frame{width:100%;max-width:400px;transform:none;border-radius:28px;padding:12px 10px 16px}
  .tab-tables{grid-template-columns:repeat(4,1fr)}
  .register-section{padding:52px 0}
}
`;

const DEMO_URL = "https://app.holu.pro/?demo=1";

export default function Landing({ adminUrl }: { n8nBase?: string; adminUrl?: string }) {
  const [openFaq, setOpenFaq] = useState(0);
  const [form, setForm] = useState({ name: "", restaurant: "", email: "", phone: "", plan: "pro" });
  const [formState, setFormState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [formError, setFormError] = useState("");
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  const [kioscoCart, setKioscoCart] = useState<Record<string, number>>({});
  const [kioscoSent, setKioscoSent] = useState(false);
  const kioscoCount = Object.values(kioscoCart).reduce((a, b) => a + b, 0);
  const kioscoTotal = KIOSCO_ITEMS.reduce((sum, it) => sum + (kioscoCart[it.id] || 0) * it.price, 0);
  function addKiosco(id: string) {
    setKioscoCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  }
  function confirmKiosco() {
    setKioscoSent(true);
    setTimeout(() => { setKioscoSent(false); setKioscoCart({}); }, 2200);
  }

  const [deliverySel, setDeliverySel] = useState<Record<string, boolean>>({ d1: true, d2: false });
  const [deliveryAddr, setDeliveryAddr] = useState("");
  const [deliveryPaid, setDeliveryPaid] = useState(false);
  const deliveryTotal = DELIVERY_ITEMS.reduce((sum, it) => sum + (deliverySel[it.id] ? it.price : 0), 0);
  function toggleDeliveryItem(id: string) {
    setDeliverySel((s) => ({ ...s, [id]: !s[id] }));
  }
  function payDelivery() {
    setDeliveryPaid(true);
    setTimeout(() => setDeliveryPaid(false), 2200);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = adminUrl;

  // Registering no longer creates the account. It records the intent and hands
  // the visitor to MercadoPago; the restaurant, its login and its tables are
  // built when MercadoPago confirms the first payment.
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setFormState("loading");
    setFormError("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.init_point) throw new Error("sin enlace de pago");
      window.location.href = data.init_point;
    } catch {
      setFormError("No pudimos abrir el pago. Revisa los datos e inténtalo de nuevo.");
      setFormState("idle");
    }
  }

  return (
    <div className="page">
      <style>{CSS}</style>

      <nav className="nav">
        <div className="container nav-in">
          <a href="#top">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/holu-logo-256.png" alt="HOLU" style={{ height: 64, width: "auto", display: "block" }} />
          </a>
          <div className="nav-links">
            <a href="#conectado">Cómo funciona</a>
            <a href="#modulos">Módulos</a>
            <a href="#precios">Planes</a>
            <a href="#faq">Preguntas</a>
            <a className="btn primary" href={DEMO_URL} target="_blank" rel="noopener noreferrer">Probar gratis</a>
          </div>
        </div>
      </nav>

      <header id="top" className="hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">Mesa · Camareros · Cocina · Caja · Administración</div>
            <h1>El caos del restaurante termina con <span style={{ color: "var(--gold2)" }}>HOLU</span>.</h1>
            <p>HOLU conecta la mesa, los camareros, la cocina, la caja y la administración de tu restaurante en un solo sistema en tiempo real. Suma kiosco y delivery cuando quieras vender más.</p>
            <div className="cta-row">
              <a className="btn primary" href={DEMO_URL} target="_blank" rel="noopener noreferrer">Probar gratis</a>
              <a className="btn ghost" href="#conectado">Ver cómo se conecta</a>
            </div>
            <div className="trust">
              <span><i className="dot" />Sistema completo desde el primer día</span>
              <span><i className="dot" />Demo abierta · sin registro</span>
              <span><i className="dot" />Kiosco y delivery se conectan al instante</span>
            </div>
            <div className="logos">{socialProof.map(item => <div className="logo-pill" key={item}>{item}</div>)}</div>
            <div className="metrics">{metrics.map(([value, label]) => <div className="metric" key={value}><b>{value}</b><span>{label}</span></div>)}</div>
          </div>

          <div className="tablet-outer">
            <div className="tablet-frame">
              <div className="tablet-btn-right" />
              <div className="tablet-btn-vol1" />
              <div className="tablet-btn-vol2" />
              <div className="tablet-camera" />
              <div className="tablet-screen">
                <div className="tab-topbar">
                  <div className="tab-topbar-row">
                    <span className="tab-brand">HOLU Admin</span>
                    <span className="tab-live">● En vivo</span>
                  </div>
                  <div className="tab-stats">
                    <div className="tab-stat"><b>$184.500</b><span>Ventas hoy</span></div>
                    <div className="tab-stat"><b>12</b><span>Pedidos</span></div>
                    <div className="tab-stat"><b>4</b><span>Mesas activas</span></div>
                  </div>
                </div>
                <div className="tab-section">
                  <div className="tab-label">Pedidos activos</div>
                  {ORDERS.map(o => (
                    <div className="tab-order" key={o.id}>
                      <div className="tab-order-info">
                        <b>{o.id} · {o.mesa}</b>
                        <span>{o.items}</span>
                      </div>
                      <span className="tab-badge" style={{ color: o.c, background: `${o.c}18`, border: `1px solid ${o.c}30` }}>{o.status}</span>
                    </div>
                  ))}
                </div>
                <div className="tab-section" style={{ paddingTop: 0 }}>
                  <div className="tab-label">Mesas</div>
                  <div className="tab-tables">
                    {TABLES.map(t => (
                      <div className="tab-table" key={t.n} style={{ background: t.bg }}>
                        <b>M{t.n}</b>
                        <span style={{ color: t.tc }}>{t.s}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="tab-footer">
                  <div className="tab-footbtn active">Pedidos</div>
                  <div className="tab-footbtn">Mesas</div>
                  <div className="tab-footbtn">Cocina</div>
                  <div className="tab-footbtn">Caja</div>
                </div>
              </div>
              <div className="tablet-home" />
            </div>
          </div>
        </div>

        <div className="container stats-shell">
          <div className="stats-head">
            <div className="eyebrow">Experiencia HOLU</div>
            <div style={{ color: "var(--dim)", fontSize: 12, fontWeight: 500 }}>Desliza →</div>
          </div>
          <div className="stats">{stats.map(([value, label]) => <div className="stat" key={value}><b>{value}</b><span>{label}</span></div>)}</div>
        </div>
      </header>

      <section id="conectado" className="section">
        <div className="container hub-wrap">
          <div className="section-head">
            <h2>Un sistema. Todo conectado en vivo.</h2>
            <p>Mesa, camareros, cocina, caja y kiosco o delivery trabajan sobre el mismo cerebro — misma carta, misma cocina, misma caja, en tiempo real.</p>
          </div>
          <div className="hub">
            <div className="hub-core-wrap">
              <div className="hub-core">
                <span className="hub-badge">Núcleo del sistema</span>
                <h3>HOLU Admin</h3>
                <p>Carta, cocina, caja, empleados, inventario, propinas, reportes y auditoría — el corazón de tu restaurante, siempre conectado con cada canal de venta y cada rol de tu equipo.</p>
              </div>
            </div>

            <div className="hub-flow" />
            <div className="hub-group">
              <div className="hub-group-label">Canales de venta</div>
              <div className="hub-row">
                {salesChannels.map((e) => (
                  <div className="hub-spoke" key={e.key}>
                    <div className="hub-spoke-line" />
                    <div className="hub-card" style={{ borderColor: `${e.color}30` }}>
                      <span className="hub-icon" style={{ background: `${e.color}18`, color: e.color }}>{Icons[e.icon as keyof typeof Icons]}</span>
                      <span className="hub-tag" style={{ color: e.color, background: `${e.color}16` }}>{e.tagline}</span>
                      <h4>{e.name}</h4>
                      <p>{e.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hub-flow" style={{ marginTop: 30 }} />
            <div className="hub-group">
              <div className="hub-group-label">Tu equipo, conectado</div>
              <div className="hub-row hub-row-2">
                {teamRoles.map((e) => (
                  <div className="hub-spoke" key={e.key}>
                    <div className="hub-spoke-line" />
                    <div className="hub-card" style={{ borderColor: `${e.color}30` }}>
                      <span className="hub-icon" style={{ background: `${e.color}18`, color: e.color }}>{Icons[e.icon as keyof typeof Icons]}</span>
                      <span className="hub-tag" style={{ color: e.color, background: `${e.color}16` }}>{e.tagline}</span>
                      <h4>{e.name}</h4>
                      <p>{e.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="hub-foot">Nada corre por su cuenta: un pedido de mesa, un plato listo en cocina o un llamado del cliente se actualizan al instante en toda la cadena — de la mesa a la cocina, de la cocina a la caja, de la caja a tus reportes.</p>
          </div>
        </div>
      </section>

      <section id="modulos" className="section">
        <div className="container">
          <div className="section-head">
            <h2>La experiencia moderna que transforma restaurantes.</h2>
            <p>HOLU une clientes, camareros, cocina, caja y administración en una experiencia visual, rápida y moderna.</p>
          </div>
          <div className="modules">
            {modules.map(m => <article className="card" key={m.name}><span className="label">{m.eyebrow}</span><h3>{m.name}</h3><p>{m.desc}</p></article>)}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>Diseñado para sentirse moderno desde el primer segundo.</h2>
            <p>HOLU no parece un POS antiguo. Se siente como una app moderna diseñada para restaurantes que quieren una operación rápida, limpia y organizada.</p>
          </div>
          <div className="showcase-grid">
            {showcase.map(item => (
              <article className="info-card" key={item.title} style={{ borderColor: `${item.color}28` }}>
                <div className="info-card-header">
                  <span className="info-icon" style={{ background: `${item.color}14`, color: item.color }}>{Icons[item.icon as keyof typeof Icons]}</span>
                  <span className="eyebrow" style={{ color: item.color }}>{item.eyebrow}</span>
                </div>
                <h3 className="info-title">{item.title}</h3>
                <p className="info-desc">{item.desc}</p>
                <div className="info-features">
                  {item.features.map(f => (
                    <div className="info-feature" key={f}>
                      <span className="info-feature-check" style={{ color: item.color }}>{Icons.check}</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="beneficios" className="section">
        <div className="container split">
          <div>
            <div className="eyebrow">Por qué HOLU</div>
            <h2>Diseñado para restaurantes que quieren crecer sin perder el control.</h2>
            <p style={{ color: "var(--muted)", lineHeight: 1.75, fontSize: 15 }}>HOLU fue creado para que cualquier persona pueda operar el restaurante desde el primer día sin capacitación técnica.</p>
          </div>
          <div className="benefits">
            {benefits.map(b => <div className="benefit" key={b}><span className="check">{Icons.check}</span><span>{b}</span></div>)}
          </div>
        </div>
      </section>

      <section id="demo" className="section">
        <div className="container">
          <div className="demo-panel">
            <div className="eyebrow">Flujo real</div>
            <h2 style={{ fontSize: "clamp(34px,4vw,48px)", letterSpacing: "-.05em", marginTop: 12 }}>De la mesa a la cocina. Sin caos.</h2>
            <div className="flow-track">
              {flow.map(([number, title, text]) => (
                <div className="flow-card" key={number}>
                  <div className="flow-number">{number}</div>
                  <div className="flow-content"><b>{title}</b><span>{text}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="registro" className="register-section">
        <div className="container register-wrap">
          <div>
            <div className="eyebrow">Pruébalo gratis, sin registrarte</div>
            <h2 style={{ fontSize: "clamp(36px,5vw,58px)", fontWeight: 700, lineHeight: .92, letterSpacing: "-.05em", margin: "14px 0 18px" }}>
              Míralo funcionando{" "}
              <span style={{ color: "var(--green)" }}>ahora</span>.{" "}
              Decide <span style={{ color: "var(--gold2)" }}>después</span>.
            </h2>
            <p style={{ color: "var(--muted)", lineHeight: 1.75, fontSize: 16, marginBottom: 24 }}>
              Abre la demo y recorre HOLU con un restaurante en pleno servicio: mesas ocupadas, pedidos en cocina, llamados de clientes y la caja del turno. No pedimos correo ni tarjeta para eso.
            </p>
            <div style={{ marginBottom: 26 }}>
              <a className="btn primary" href={DEMO_URL} target="_blank" rel="noopener noreferrer">Abrir la demo →</a>
            </div>
            <div className="register-benefits">
              {[
                "La demo es HOLU completo, con datos de ejemplo",
                "Tu cuenta se crea sola apenas confirmamos el pago",
                "Sin instalación — funciona desde el navegador",
                "Cancelas cuando quieras desde MercadoPago",
              ].map(b => (
                <div className="reg-benefit" key={b}>
                  <span className="reg-check">{Icons.check}</span>
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="register-form-box">
            {formState === "done" ? (
              <div className="form-success">
                <div className="success-icon" style={{ color: "var(--gold2)" }}>{Icons.success}</div>
                <h4>Pago confirmado</h4>
                <p>Te enviamos tu correo y contraseña a la dirección que registraste. Con eso entras a <span style={{ color: "var(--gold2)" }}>app.holu.pro</span> y tu restaurante ya está creado.</p>
                <div style={{ marginTop: 20 }}>
                  <a className="btn primary" href="https://app.holu.pro" target="_blank" rel="noopener noreferrer" style={{ width: "100%", justifyContent: "center" }}>Entrar a mi cuenta →</a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegister}>
                <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.03em", margin: "0 0 6px" }}>Quiero mi cuenta</h3>
                <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 22px", lineHeight: 1.6 }}>Completa tus datos y te llevamos a MercadoPago para confirmar el pago. Al confirmarse el cobro te llegan tus claves por correo y ya puedes entrar.</p>
                <div className="form-field">
                  <label>Nombre del restaurante</label>
                  <input type="text" placeholder="Ej: La Trattoria" required value={form.restaurant} onChange={e => setForm(f => ({ ...f, restaurant: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>Tu nombre</label>
                  <input type="text" placeholder="Tu nombre" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>Correo electrónico</label>
                  <input type="email" placeholder="tu@email.com" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>WhatsApp <span style={{ color: "var(--dim)", fontWeight: 400 }}>(opcional)</span></label>
                  <input type="tel" placeholder="+56 9 1234 5678" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                {formError && <p style={{ color: "#fca5a5", fontSize: 13, textAlign: "center", margin: "0 0 10px", lineHeight: 1.5 }}>{formError}</p>}
                <button type="submit" className="btn primary" style={{ width: "100%", marginTop: 4, fontSize: 15, padding: "14px 20px", justifyContent: "center" }} disabled={formState === "loading"}>
                  {formState === "loading" ? <><span className="spinner" />Abriendo MercadoPago...</> : "Ir a pagar →"}
                </button>
                <p style={{ color: "var(--dim)", fontSize: 12, textAlign: "center", marginTop: 12 }}>Cobro mensual · Cancelas cuando quieras</p>
              </form>
            )}
          </div>
        </div>
      </section>

      <section id="precios" className="section">
        <div className="container">
          <div className="section-head">
            <h2>Un plan para cada etapa de tu restaurante.</h2>
            <p>Empieza con el sistema completo — mesa, camareros, cocina, caja y administración — y sumale kiosco y delivery cuando quieras vender más. ¿Necesitas algo hecho a tu medida? Bajá un poco más.</p>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
            <div style={{ display: "flex", gap: 0, background: "rgba(255,255,255,.06)", border: "1px solid var(--line)", borderRadius: 16, padding: 4 }}>
              <button type="button" onClick={() => setBilling("monthly")} style={{ padding: "10px 24px", borderRadius: 12, border: 0, cursor: "pointer", fontWeight: 600, fontSize: 14, transition: ".2s ease", background: billing === "monthly" ? "linear-gradient(135deg,var(--gold),var(--gold2))" : "transparent", color: billing === "monthly" ? "#160f02" : "var(--muted)" }}>Mensual</button>
              <button type="button" onClick={() => setBilling("annual")} style={{ padding: "10px 24px", borderRadius: 12, border: 0, cursor: "pointer", fontWeight: 600, fontSize: 14, transition: ".2s ease", background: billing === "annual" ? "linear-gradient(135deg,var(--gold),var(--gold2))" : "transparent", color: billing === "annual" ? "#160f02" : "var(--muted)" }}>Anual&nbsp;<span style={{ fontSize: 12, fontWeight: 700, color: billing === "annual" ? "#064" : "var(--green)" }}>−30%</span></button>
            </div>
          </div>
          <div className="tier-grid">
            {TIERS.map((t) => (
              <article className="tier-card" key={t.key}>
                {t.tag && <span className="tag" style={{ position: "static", alignSelf: "flex-start", marginBottom: 8 }}>{t.tag}</span>}
                <h3 className="tier-name">{t.name}</h3>
                <p className="tier-blurb">{t.blurb}</p>
                <div className="tier-price">
                  {billing === "monthly"
                    ? <>USD ${t.monthly}<small> / mes</small></>
                    : <>USD ${t.annual}<small> / año</small></>}
                </div>
                {billing === "annual" && (
                  <p className="tier-annual-note">Equivale a USD ${(t.annual / 12).toFixed(2)}/mes</p>
                )}
                <div className="tier-features">
                  {t.features.map((f) => (
                    <div key={f} style={{ color: "var(--muted)" }}>
                      <span style={{ color: "var(--green)", flex: "0 0 auto", marginTop: 2 }}>{Icons.check}</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <a className="btn wa" href={`${WA}?text=${encodeURIComponent(`Hola, quiero activar HOLU - Plan: ${t.name} (${billing === "annual" ? `anual USD $${t.annual}` : `mensual USD $${t.monthly}`})`)}`} target="_blank" rel="noopener noreferrer" style={{ width: "100%", fontSize: 14, padding: "13px 18px" }}>{Icons.message} Activar por WhatsApp</a>
              </article>
            ))}
          </div>
          <p style={{ textAlign: "center", color: "var(--dim)", fontSize: 13, margin: "20px 0 0" }}>{Icons.check} Demo abierta, sin registro ni tarjeta, para probar el sistema completo antes de elegir.</p>

          <div style={{ marginTop: 56, marginBottom: 24, textAlign: "center" }}>
            <span className="eyebrow">Lo que se suma en el plan +$25</span>
            <h3 style={{ fontSize: "clamp(24px,3vw,32px)", fontWeight: 700, letterSpacing: "-.03em", margin: "10px 0 0" }}>Así funcionan Kiosco y Delivery.</h3>
          </div>
          <div className="demo-screens">
            <div className="demo-col">
              <div className="demo-col-label">Kiosco</div>
              <div className="demo-col-title">Autoservicio en pantalla, sin filas</div>
              <div className="device-frame" style={{ width: 232 }}>
                <div className="device-cam" />
                <div className="device-screen">
                  <div className="device-topbar">
                    <b>HOLU Kiosco</b>
                    <span>● Toca para pedir</span>
                  </div>
                  <div className="device-grid">
                    {KIOSCO_ITEMS.map((it) => (
                      <button type="button" key={it.id} className="device-tile" onClick={() => addKiosco(it.id)}>
                        {kioscoCart[it.id] ? <span className="device-tile-qty">{kioscoCart[it.id]}</span> : null}
                        <span className="device-tile-img" style={{ background: it.bg }}>{it.img}</span>
                        <b>{it.name}</b>
                        <span>{clp(it.price)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="device-bar">
                    <div className="device-bar-row">
                      <span>{kioscoCount} {kioscoCount === 1 ? "producto" : "productos"}</span>
                      <b>{clp(kioscoTotal)}</b>
                    </div>
                    {kioscoSent ? (
                      <div className="device-done" style={{ background: "rgba(167,139,250,.16)", color: "#c4b5fd" }}>{Icons.check} Enviado a cocina</div>
                    ) : (
                      <button type="button" className="device-cta" style={{ background: "linear-gradient(135deg,#a78bfa,#c4b5fd)", color: "#160f02" }} onClick={confirmKiosco} disabled={kioscoCount === 0}>
                        Confirmar pedido →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="demo-col">
              <div className="demo-col-label">Delivery</div>
              <div className="demo-col-title">Tu carta, tu carrito, tu pago</div>
              <div className="device-frame" style={{ width: 210 }}>
                <div className="device-notch" />
                <div className="device-cam" style={{ visibility: "hidden" }} />
                <div className="device-screen">
                  <div className="device-topbar centered">
                    <b>Delivery</b>
                    <span>● Pedido en línea</span>
                  </div>
                  <div className="device-list">
                    {DELIVERY_ITEMS.map((it) => (
                      <button type="button" key={it.id} className={`device-item${deliverySel[it.id] ? " sel" : ""}`} onClick={() => toggleDeliveryItem(it.id)}>
                        <span className="device-item-img" style={{ background: it.bg }}>{it.img}</span>
                        <span className="device-item-info"><b>{it.name}</b><span>{clp(it.price)}</span></span>
                        <span className="device-item-check" style={deliverySel[it.id] ? { background: "#34d399", borderColor: "#34d399", color: "#053323" } : undefined}>{deliverySel[it.id] ? Icons.check : null}</span>
                      </button>
                    ))}
                  </div>
                  <input className="device-addr" placeholder="Tu dirección de entrega" value={deliveryAddr} onChange={(e) => setDeliveryAddr(e.target.value)} />
                  <div className="device-bar">
                    <div className="device-bar-row">
                      <span>Total</span>
                      <b>{clp(deliveryTotal)}</b>
                    </div>
                    {deliveryPaid ? (
                      <div className="device-done" style={{ background: "rgba(52,211,153,.16)", color: "#6ee7b7" }}>{Icons.check} Pago confirmado</div>
                    ) : (
                      <button type="button" className="device-cta" style={{ background: "linear-gradient(135deg,#25d366,#128c48)", color: "#fff" }} onClick={payDelivery} disabled={deliveryTotal === 0}>
                        Pagar con MercadoPago →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="enterprise">
            <div className="enterprise-head">
              <div>
                <span className="tag" style={{ position: "static", background: "rgba(96,165,250,.16)", color: "#93c5fd" }}>{ENTERPRISE.tag}</span>
                <h3 className="enterprise-title">{ENTERPRISE.name}</h3>
                <p className="enterprise-blurb">{ENTERPRISE.blurb}</p>
              </div>
              <div className="enterprise-cta">
                <span className="enterprise-price">Precio a medida — se cotiza según tu operación</span>
                <a className="btn wa" href={`${WA}?text=${encodeURIComponent("Hola, quiero cotizar el plan A Medida de HOLU (servidor dedicado + agentes de WhatsApp y Telegram)")}`} target="_blank" rel="noopener noreferrer">{Icons.message} Cotizar este plan</a>
              </div>
            </div>
            <div className="enterprise-agents">
              {ENTERPRISE.agents.map((a) => (
                <div className="enterprise-agent" key={a.name}>
                  <span className="enterprise-agent-icon" style={{ background: `${a.color}1c`, color: a.color }}>{Icons[a.icon as keyof typeof Icons]}</span>
                  <h4>{a.name}</h4>
                  <p>{a.desc}</p>
                  <div className="chat-head">
                    <span className="chat-head-dot" style={{ background: a.color }} />
                    <span>{a.name} · en línea</span>
                  </div>
                  <div className="chat-mock">
                    {a.chat.map((m, i) => (
                      <div
                        key={i}
                        className={`chat-bubble ${m.who}`}
                        style={{
                          animationDelay: `${i * 0.7 + 0.3}s`,
                          ...(m.who === "out" ? { background: `${a.color}22`, border: `1px solid ${a.color}40` } : {}),
                        }}
                      >
                        {m.text}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="enterprise-includes">
              {ENTERPRISE.includes.map((f) => (
                <div key={f}><span style={{ color: "var(--green)", flex: "0 0 auto", marginTop: 2 }}>{Icons.check}</span><span>{f}</span></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="section">
        <div className="container">
          <div className="section-head">
            <h2>Todo lo que normalmente preguntan antes de usar HOLU.</h2>
            <p>Respondemos las preguntas más comunes sobre operación, instalación, QR, cocina y funcionamiento del sistema.</p>
          </div>
          <div className="faq-accordion">
            {faqs.map((faq, index) => (
              <div className="faq-item" key={faq.q}>
                <button className="faq-btn" type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)}>
                  <span>{faq.q}</span>
                  <span className="faq-icon">{openFaq === index ? "−" : "+"}</span>
                </button>
                {openFaq === index && <div className="faq-answer">{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="final">
        <div className="container">
          <div className="final-box">
            <div className="eyebrow">Todo tu restaurante, en un solo sistema</div>
            <h2>El restaurante moderno funciona con <span style={{ color: "var(--gold2)" }}>HOLU</span>.</h2>
            <p>Mesa, camareros, cocina, caja y administración desde $15/mes. Suma kiosco y delivery cuando quieras vender más.</p>
            <div className="final-btns">
              <a className="btn primary" href="#precios">Quiero mi cuenta</a>
              <a className="btn wa" href={WA} target="_blank" rel="noopener noreferrer">{Icons.message} Hablar por WhatsApp</a>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-in">
          <span>© {new Date().getFullYear()} <span style={{ color: "var(--gold2)" }}>HOLU</span> fluye en tiempo real.</span>
          <span>Mesas · Camareros · Cocina · Administración · Autoservicio · Delivery</span>
        </div>
        <div className="container footer-legal">
          <span>Servicio operado desde Chile · Ley N° 21.719 de Protección de Datos Personales</span>
          <span className="footer-legal-links">
            <a href="/terminos">Términos y condiciones</a>
            <a href="/privacidad">Privacidad y uso de IA</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
