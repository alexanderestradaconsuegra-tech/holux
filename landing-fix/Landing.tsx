"use client";

import { useState } from "react";

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
    title: "Mesas QR",
    image: "https://assets.zyrosite.com/rvH9B7W9kUvvSHwW/chatgpt-image-26-may-2026-08_25_05-NoZTg8ZqjPaIF1rd.png",
    desc: "Clientes viendo la carta digital desde su teléfono, haciendo pedidos y llamando al camarero directamente desde la mesa.",
  },
  {
    title: "Camareros conectados",
    image: "https://assets.zyrosite.com/rvH9B7W9kUvvSHwW/chatgpt-image-26-may-2026-08_29_05-T0Rd8rgWNQNXOgvt.png",
    desc: "El camarero toma pedidos desde una tablet y todo se envía automáticamente a cocina y caja en segundos.",
  },
  {
    title: "Cocina organizada",
    image: "https://assets.zyrosite.com/rvH9B7W9kUvvSHwW/chatgpt-image-26-may-2026-08_25_20-WyIyg3aQ5mcsj3zs.png",
    desc: "Los cocineros reciben pedidos en pantalla y notifican cuando cada plato está listo para entregar.",
  },
  {
    title: "Autoservicio inteligente",
    image: "https://assets.zyrosite.com/rvH9B7W9kUvvSHwW/chatgpt-image-26-may-2026-08_50_45-UDo4hEUTgFuKTcHa.png",
    desc: "Clientes hacen pedidos rápidos desde una pantalla en barra o autoservicio sin hacer filas ni esperar atención.",
  },
];

const modules = [
  { name: "HOLU Mesas",          eyebrow: "Cliente en mesa",     desc: "Carta digital, pedidos, llamado al camarero, solicitud de cobro, propina, reseñas y seguimiento del pedido desde un QR." },
  { name: "HOLU Camareros",      eyebrow: "Equipo de servicio",  desc: "Llamados de mesa, pedidos activos, mensajes del cliente, mesas asignadas y colaboración del administrador en tiempo real." },
  { name: "HOLU Cocina",         eyebrow: "Pantalla de cocina",  desc: "Pedidos organizados por estado para acelerar el servicio, reducir errores y mantener al equipo coordinado." },
  { name: "HOLU Administración", eyebrow: "Control total",       desc: "Ventas, empleados, carta, QR de mesas, inventario, propinas, caja, turnos, boletas, reportes y auditoría." },
  { name: "HOLU Autoservicio",   eyebrow: "Tótem de barra",      desc: "Clientes hacen pedidos solos desde una pantalla en barra o mostrador, sin filas, sin esperar atención." },
  { name: "HOLU Analítica",      eyebrow: "Decisiones claras",   desc: "Métricas de ventas, platos más vendidos, propinas, rendimiento por camarero, tiempos de cocina y comportamiento por mesa." },
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

const planFeatures = [
  "Mesas con QR y carta digital premium",
  "Panel de camareros en tiempo real",
  "Pantalla de cocina organizada",
  "Administración completa",
  "Inventario con precio costo",
  "Caja, turnos y boletas",
  "Propinas y reseñas de clientes",
  "Analítica de ventas y rendimiento",
  "🎁 Tótem de autoservicio para barra — de regalo",
];

const stats = [
  ["4 roles",   "Mesas, camareros, cocina y caja"],
  ["1 QR",      "Toda la experiencia desde la mesa"],
  ["En vivo",   "Todo sincronizado en tiempo real"],
  ["Regalo",    "Tótem de autoservicio para barra"],
  ["Cloud",     "Accede desde cualquier dispositivo"],
];

const faqs = [
  { q: "¿HOLU reemplaza al camarero?",         a: "No. HOLU ayuda al equipo a trabajar mejor. El camarero sigue siendo clave para la atención, la experiencia humana y el cobro presencial cuando corresponde." },
  { q: "¿Funciona con QR por mesa?",           a: "Sí. Cada mesa tiene un QR único. El cliente entra directamente a la experiencia de su mesa y todo queda conectado con pedidos, cocina, camareros y administración." },
  { q: "¿Puedo agregar o editar platos?",       a: "Sí. Desde administración puedes crear platos, cambiar precios, subir imágenes, activar o desactivar disponibilidad y decidir qué ve el cliente." },
  { q: "¿El sistema incluye propinas y caja?",  a: "Sí. HOLU permite registrar propinas aceptadas o rechazadas, abrir caja, cerrar caja, cambiar turnos, imprimir cierres y revisar reportes." },
  { q: "¿Qué es el tótem de autoservicio?",    a: "Es una pantalla en barra o mostrador desde donde los clientes hacen sus propios pedidos sin esperar atención. Está conectada en tiempo real con cocina, caja y administración, y viene de regalo con tu plan." },
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
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
:root{--bg:#060605;--line:rgba(255,255,255,.1);--text:#fff8ed;--muted:#b0a396;--dim:#6a6058;--gold:#c8a96b;--gold2:#f0d48d;--green:#34d399;--shadow:0 28px 90px rgba(0,0,0,.48)}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(circle at 12% -8%,rgba(200,169,107,.18),transparent 32%),radial-gradient(circle at 100% 18%,rgba(255,255,255,.05),transparent 28%),#050504;color:var(--text);font-family:Inter,system-ui,sans-serif;font-size:16px;line-height:1.5}
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
.showcase-card{position:relative;overflow:hidden;border-radius:28px;min-height:460px;border:1px solid var(--line);box-shadow:var(--shadow);background:#0d0d0d}
.showcase-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.68);transform:scale(1.03);transition:.5s ease}
.showcase-card:hover img{transform:scale(1.07);filter:brightness(.76)}
.showcase-overlay{position:absolute;inset:0;background:linear-gradient(180deg,transparent 25%,rgba(0,0,0,.9));padding:28px;display:flex;flex-direction:column;justify-content:flex-end}
.showcase-overlay h3{font-size:clamp(26px,3.2vw,40px);font-weight:700;line-height:.95;margin:0 0 10px;letter-spacing:-.04em}
.showcase-overlay p{color:#cdc2b0;line-height:1.65;max-width:400px;font-size:14px;margin:0}

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
.demo-card-pro{position:relative;border-radius:28px;overflow:hidden;background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid var(--line);padding:28px;box-shadow:var(--shadow)}
.demo-card-pro::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 80% 10%,rgba(52,211,153,.1),transparent 30%);pointer-events:none}
.demo-options{display:grid;gap:10px;margin-top:20px;position:relative;z-index:1}
.demo-option{display:flex;align-items:flex-start;gap:14px;border-radius:18px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);padding:16px;color:var(--text);transition:.2s ease}
.demo-option:hover{transform:translateY(-2px);border-color:rgba(240,212,141,.22);background:rgba(255,255,255,.07)}
.demo-option.primary-demo{background:linear-gradient(135deg,rgba(200,169,107,.14),rgba(255,255,255,.04));border-color:rgba(240,212,141,.24)}
.demo-badge{width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);display:grid;place-items:center;font-size:18px;flex:0 0 auto}
.demo-option strong{display:block;font-size:15px;font-weight:600;letter-spacing:-.02em}
.demo-option small{display:block;color:var(--muted);line-height:1.5;margin-top:4px;font-size:13px}
.demo-safe{margin-top:14px;border-radius:14px;background:rgba(52,211,153,.06);border:1px solid rgba(52,211,153,.12);padding:12px 14px;color:#b8f5d8;font-size:13px;line-height:1.6;position:relative;z-index:1}

/* PLANS */
.plan.highlight{border-color:rgba(240,212,141,.32);background:linear-gradient(145deg,rgba(200,169,107,.1),rgba(255,255,255,.03))}
.tag{position:absolute;top:14px;right:14px;border-radius:999px;background:rgba(52,211,153,.12);color:var(--green);font-size:11px;padding:6px 10px;font-weight:600;letter-spacing:.04em}
.price{font-size:30px;font-weight:700;color:var(--gold2);margin:12px 0}
.features{display:grid;gap:8px;margin:16px 0}
.features div{color:var(--muted);font-size:14px;line-height:1.4}

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
.form-success .success-icon{font-size:48px;margin-bottom:12px}
.form-success h4{font-size:22px;font-weight:700;margin:0 0 8px}
.form-success p{color:var(--muted);font-size:14px;line-height:1.7;margin:0 0 20px}
.demo-creds{background:rgba(200,169,107,.08);border:1px solid rgba(200,169,107,.2);border-radius:14px;padding:14px 16px;font-size:13px;color:var(--gold2);text-align:left;line-height:1.8}
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

@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.82;transform:scale(1.03)}}
@keyframes spin{to{transform:rotate(360deg)}}
.spinner{width:18px;height:18px;border:2px solid rgba(0,0,0,.2);border-top-color:#160f02;border-radius:50%;animation:spin .7s linear infinite}

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
  .showcase-card{min-height:320px}
  .tablet-outer{display:flex;justify-content:center;margin-top:24px;perspective:none}
  .tablet-frame{width:100%;max-width:400px;transform:none;border-radius:28px;padding:12px 10px 16px}
  .tab-tables{grid-template-columns:repeat(4,1fr)}
  .register-section{padding:52px 0}
}
`;

export default function Landing({ n8nBase, adminUrl }: { n8nBase?: string; adminUrl?: string }) {
  const [openFaq, setOpenFaq] = useState(0);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [formState, setFormState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = adminUrl;

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setFormState("loading");
    try {
      const base = n8nBase ?? "";
      if (base) {
        await fetch(`${base}/webhook/demo-register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      setFormState("done");
    } catch {
      setFormState("done");
    }
  }

  return (
    <div className="page">
      <style>{CSS}</style>

      <nav className="nav">
        <div className="container nav-in">
          <a href="#top">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://assets.zyrosite.com/rvH9B7W9kUvvSHwW/holu-logo-cIEzv6scenVM9k3O.png" alt="HOLU" style={{ height: 108, display: "block" }} />
          </a>
          <div className="nav-links">
            <a href="#modulos">Módulos</a>
            <a href="#beneficios">Beneficios</a>
            <a href="#precios">Planes</a>
            <a href="#faq">Preguntas</a>
            <a className="btn primary" href="#registro">Probar gratis</a>
          </div>
        </div>
      </nav>

      <header id="top" className="hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">Simple · Rápido · Todo conectado</div>
            <h1>El caos del restaurante termina con <span style={{ color: "var(--gold2)" }}>HOLU</span>.</h1>
            <p>HOLU es la forma fácil de organizar tu restaurante: mesas, pedidos, camareros, cocina, caja, propinas y clientes conectados en una sola app.</p>
            <div className="cta-row">
              <a className="btn primary" href="#registro">Probar gratis</a>
              <a className="btn ghost" href="#modulos">Ver cómo funciona</a>
            </div>
            <div className="trust">
              <span><i className="dot" />30 días gratis · sin tarjeta</span>
              <span><i className="dot" />Fácil de usar</span>
              <span><i className="dot" />Hecho para el día a día</span>
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
              <article className="showcase-card" key={item.title}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image} alt={item.title} />
                <div className="showcase-overlay">
                  <div className="eyebrow">Experiencia HOLU</div>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
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
            {benefits.map(b => <div className="benefit" key={b}><span className="check">✓</span><span>{b}</span></div>)}
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

      {/* ── REGISTRO GRATUITO ─────────────────────────────────── */}
      <section id="registro" className="register-section">
        <div className="container register-wrap">
          <div>
            <div className="eyebrow">30 días gratis · sin tarjeta</div>
            <h2 style={{ fontSize: "clamp(36px,5vw,58px)", fontWeight: 700, lineHeight: .92, letterSpacing: "-.05em", margin: "14px 0 18px" }}>Prueba HOLU completo durante 30 días. Sin pagar nada.</h2>
            <p style={{ color: "var(--muted)", lineHeight: 1.75, fontSize: 16, marginBottom: 24 }}>Sin tarjeta, sin compromiso. Crea tu cuenta y explora mesas QR, cocina, camareros, caja y administración durante 30 días completos.</p>
            <div className="register-benefits">
              {[
                "30 días gratis con acceso completo a todo HOLU",
                "Mesas QR, cocina, caja y administración incluidos",
                "Sin instalación — funciona desde el navegador",
                "Después del período gratis, activa con USD $15/mes",
              ].map(b => (
                <div className="reg-benefit" key={b}>
                  <span className="reg-check">✓</span>
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="register-form-box">
            {formState === "done" ? (
              <div className="form-success">
                <div className="success-icon">🎉</div>
                <h4>¡Listo! Revisa tu correo.</h4>
                <p>Te enviamos un correo con toda la información. Crea tu cuenta en <span style={{ color: "var(--gold2)" }}>app.holu.pro</span> y empieza tus 30 días gratis ahora mismo.</p>
                <div style={{ marginTop: 20 }}>
                  <a className="btn primary" href="https://app.holu.pro" target="_blank" rel="noopener noreferrer" style={{ width: "100%", justifyContent: "center" }}>Crear mi cuenta gratis →</a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegister}>
                <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.03em", margin: "0 0 6px" }}>Empezar 30 días gratis</h3>
                <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 22px", lineHeight: 1.6 }}>Sin tarjeta. Sin compromiso. Activa tu restaurante cuando quieras.</p>
                <div className="form-field">
                  <label>Nombre</label>
                  <input
                    type="text"
                    placeholder="Tu nombre"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <label>Correo electrónico</label>
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    required
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <label>WhatsApp <span style={{ color: "var(--dim)", fontWeight: 400 }}>(opcional)</span></label>
                  <input
                    type="tel"
                    placeholder="+56 9 1234 5678"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <button
                  type="submit"
                  className="btn primary"
                  style={{ width: "100%", marginTop: 4, fontSize: 15, padding: "14px 20px", justifyContent: "center" }}
                  disabled={formState === "loading"}
                >
                  {formState === "loading"
                    ? <><span className="spinner" />Enviando...</>
                    : "Empezar 30 días gratis →"}
                </button>
                <p style={{ color: "var(--dim)", fontSize: 12, textAlign: "center", marginTop: 12 }}>
                  Sin tarjeta · 30 días gratis · Sin compromiso
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      <section id="precios" className="section">
        <div className="container">
          <div className="section-head">
            <h2>Un solo plan. Todo incluido.</h2>
            <p>Sin tiers, sin sorpresas. Todo lo que necesita tu restaurante desde el primer día.</p>
          </div>

          {/* Billing toggle */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
            <div style={{ display: "flex", gap: 0, background: "rgba(255,255,255,.06)", border: "1px solid var(--line)", borderRadius: 16, padding: 4 }}>
              <button
                type="button"
                onClick={() => setBilling("monthly")}
                style={{ padding: "10px 24px", borderRadius: 12, border: 0, cursor: "pointer", fontWeight: 600, fontSize: 14, transition: ".2s ease",
                  background: billing === "monthly" ? "linear-gradient(135deg,var(--gold),var(--gold2))" : "transparent",
                  color: billing === "monthly" ? "#160f02" : "var(--muted)" }}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setBilling("annual")}
                style={{ padding: "10px 24px", borderRadius: 12, border: 0, cursor: "pointer", fontWeight: 600, fontSize: 14, transition: ".2s ease",
                  background: billing === "annual" ? "linear-gradient(135deg,var(--gold),var(--gold2))" : "transparent",
                  color: billing === "annual" ? "#160f02" : "var(--muted)" }}
              >
                Anual&nbsp;<span style={{ fontSize: 12, fontWeight: 700, color: billing === "annual" ? "#064" : "var(--green)" }}>−30%</span>
              </button>
            </div>
          </div>

          {/* Single plan card */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <article className="card plan highlight" style={{ position: "relative", maxWidth: 480, width: "100%" }}>
              <span className="tag">Todo incluido</span>
              <h3 style={{ fontSize: 26, marginTop: 8 }}>HOLU — Plan completo</h3>
              <p style={{ color: "var(--green)", fontSize: 14, margin: "0 0 4px", fontWeight: 600 }}>✓ Primeros 30 días gratis al registrarte</p>
              <div className="price" style={{ fontSize: 44, lineHeight: 1 }}>
                {billing === "monthly" ? (
                  <>USD&nbsp;<span style={{ fontSize: 56 }}>$15</span><small style={{ fontSize: 14, color: "var(--muted)", fontWeight: 500 }}> / mes</small></>
                ) : (
                  <>USD&nbsp;<span style={{ fontSize: 56 }}>$126</span><small style={{ fontSize: 14, color: "var(--muted)", fontWeight: 500 }}> / año</small></>
                )}
              </div>
              {billing === "annual" && (
                <p style={{ color: "var(--green)", fontSize: 14, margin: "0 0 8px", fontWeight: 600 }}>
                  Equivale a USD $10.50/mes — ahorras $54 al año
                </p>
              )}
              <div className="features" style={{ marginTop: 16 }}>
                {planFeatures.map(f => (
                  <div key={f} style={{ color: f.startsWith("🎁") ? "var(--gold2)" : "var(--muted)", fontWeight: f.startsWith("🎁") ? 600 : 400 }}>
                    {f.startsWith("🎁") ? f : `✓ ${f}`}
                  </div>
                ))}
              </div>
              <a
                className="btn wa"
                href={`${WA}?text=${encodeURIComponent(`Hola, quiero activar HOLU (plan ${billing === "annual" ? "anual $126" : "mensual $15"})`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ width: "100%", marginTop: 20, fontSize: 15, padding: "14px 20px" }}
              >
                💬 Activar por WhatsApp
              </a>
            </article>
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
            <div className="eyebrow">El restaurante moderno empieza aquí</div>
            <h2>El restaurante moderno funciona con <span style={{ color: "var(--gold2)" }}>HOLU</span>.</h2>
            <p>Clientes pidiendo desde la mesa, camareros conectados, cocina sincronizada, caja organizada y autoservicio funcionando en tiempo real.</p>
            <div className="final-btns">
              <a className="btn primary" href="#registro">Registrarme gratis</a>
              <a className="btn wa" href={WA} target="_blank" rel="noopener noreferrer">💬 Hablar por WhatsApp</a>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-in">
          <span>© {new Date().getFullYear()} <span style={{ color: "var(--gold2)" }}>HOLU</span> fluye en tiempo real.</span>
          <span>Mesas · Camareros · Cocina · Administración · Autoservicio · Analítica</span>
        </div>
      </footer>
    </div>
  );
}
