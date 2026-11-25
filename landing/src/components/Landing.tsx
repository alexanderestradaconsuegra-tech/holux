"use client";

import { useState, useEffect } from "react";

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
    eyebrow: "Barra · Autoservicio",
    title: "Kiosco de autoservicio",
    desc: "Una pantalla en barra o mostrador para que el cliente pida solo, conectada a la misma cocina y caja que el resto del sistema.",
    features: ["Pedidos sin fila ni camarero", "Pantalla pensada para horas de más movimiento", "Todo llega organizado a la misma cocina"],
    color: "#a78bfa",
  },
];

const metrics = [
  ["30 días", "gratis, sin tarjeta"],
  ["$19.990", "al mes, todo incluido"],
  ["5 en 1", "mesa, camareros, cocina, caja y kiosco"],
];

const benefits = [
  "Tus clientes piden solos desde el QR de la mesa: menos esperas y menos errores al tomar el pedido.",
  "Una carta con fotos, alérgenos y notas por plato vende más que una carta de papel.",
  "La cocina recibe cada pedido al instante, sin papelitos ni gritos.",
  "Si un cliente no usa el QR, el camarero le toma el pedido desde su celular; en el mostrador cobras en el momento.",
  "Caja con turnos, propinas, cuenta dividida y cuadre de efectivo. Boleta electrónica con tu propia cuenta de Tuu.",
  "Cada persona del equipo entra con su PIN y ve solo lo suyo.",
];

// Precio único de la sección "#precios" (activación manual por WhatsApp).
// Es el MISMO monto que cobra n8n de verdad al reactivar una cuenta vencida
// (nodo "Prepare Resubscription") — en CLP, sin convertir, para que coincida
// con lo que se ve al pagar. Si cambias este número, cambia también el de
// n8n y el de admin.jsx (PLAN_PRICE).
const PLAN = {
  name: "HOLU Completo",
  monthly: 19990,
  annual: 199900, // 10 meses de 12 = "2 meses gratis"
  blurb: "Todo tu restaurante en un solo sistema: mesa, camareros, cocina, caja y kiosco.",
  features: [
    "Mesas con QR y carta digital con fotos, alérgenos y notas por plato",
    "Camareros con su PIN, sus mesas y toma de pedidos desde el celular",
    "Pantalla de cocina en vivo, sin papel",
    "Caja con turnos, propinas, cuenta dividida y cuadre de efectivo",
    "Boleta electrónica con tu propia cuenta de Tuu",
    "Kiosco de autoservicio y venta de mostrador",
    "Administración: carta, inventario, reportes y equipo",
  ],
};

// Mini pantalla interactiva dentro de la sección de precios — no llama al
// backend, solo muestra cómo se siente pedir en el kiosco.
const KIOSCO_ITEMS = [
  { id: "k1", name: "Empanada de pino", price: 4500, img: "empanada" },
  { id: "k2", name: "Limonada de menta", price: 5500, img: "limonada" },
  { id: "k3", name: "Pisco sour", price: 6900, img: "pisco" },
  { id: "k4", name: "Leche asada", price: 5500, img: "leche" },
];

function clp(n: number) {
  return `$${n.toLocaleString("es-CL")}`;
}

// Imagen de un plato. Si existe la foto real /platos/<nombre>.jpg se usa; si no, la
// ilustración /platos/<nombre>.svg. Para cambiar una ilustración por una foto basta con
// subir el .jpg con el mismo nombre a landing/public/platos/.
function DishImg({ name, alt }: { name: string; alt: string }) {
  // Se muestra siempre la ilustración y, si existe la foto, se cambia por ella al cargarla
  // (así no hay imagen rota ni carrera con la hidratación).
  const [src, setSrc] = useState(`/platos/${name}.svg`);
  useEffect(() => {
    const probe = new Image();
    probe.onload = () => setSrc(`/platos/${name}.jpg`);
    probe.src = `/platos/${name}.jpg`;
  }, [name]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" />;
}

// Videos de "Míralo en acción". Se suben a landing/public/videos/ (mp4 corto, sin audio o con
// subtítulos grabados). Mientras un archivo no exista, la tarjeta muestra "Video en preparación".
const VIDEOS = [
  { src: "/videos/mesa-qr.mp4", poster: "/videos/mesa-qr.jpg", ratio: "tall", eyebrow: "Tu cliente", title: "Escanea, mira la carta y pide", desc: "El cliente escanea el QR de su mesa, ve tu carta con fotos y alérgenos, agrega sus platos y los envía a cocina. Sin esperar al camarero." },
  { src: "/videos/camarero.mp4", poster: "/videos/camarero.jpg", ratio: "wide", eyebrow: "Tu equipo", title: "El camarero toma el pedido en segundos", desc: "Para quien no usa el QR: eliges la mesa, tocas los platos, agregas una nota y se envía a cocina. También sirve para vender en el mostrador." },
  { src: "/videos/cocina.mp4", poster: "/videos/cocina.jpg", ratio: "wide", eyebrow: "Cocina", title: "La cocina lo ve al instante", desc: "Los pedidos llegan a la pantalla de cocina en vivo, con las notas de cada plato. Sin papelitos y sin gritar la comanda." },
  { src: "/videos/caja.mp4", poster: "/videos/caja.jpg", ratio: "wide", eyebrow: "Caja", title: "Cobra, divide la cuenta y cierra el turno", desc: "Abres la caja, cobras en efectivo, tarjeta o transferencia, divides la cuenta entre varios y cierras el turno con el cuadre de efectivo." },
];

function VideoCard({ v, i }: { v: (typeof VIDEOS)[number]; i: number }) {
  // El video solo se muestra si el archivo existe (si no, "Video en preparación").
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(v.src, { method: "HEAD" }).then((r) => { if (alive && r.ok) setReady(true); }).catch(() => {});
    return () => { alive = false; };
  }, [v.src]);
  return (
    <article className="video-card reveal" style={{ ["--d" as string]: i }}>
      <div className="video-frame">
        {ready ? (
          <video src={v.src} poster={v.poster} autoPlay muted loop playsInline preload="metadata" aria-label={v.title} />
        ) : (
          <div className="video-ph">
            <span className="video-play" aria-hidden="true">▶</span>
            <b>Video en preparación</b>
            <small>{v.title}</small>
          </div>
        )}
      </div>
      <div className="video-info">
        <span className="label">{v.eyebrow}</span>
        <h3>{v.title}</h3>
        <p>{v.desc}</p>
      </div>
    </article>
  );
}

// Carta de ejemplo de la sección "Una carta que da hambre".
const DISHES = [
  { img: "ceviche", name: "Ceviche de reineta", desc: "Cítricos, cebolla morada y cilantro", price: 9900, tag: "TOP" },
  { img: "empanada", name: "Empanada de pino", desc: "Masa casera, horno de barro", price: 4500, tag: "" },
  { img: "lomo", name: "Lomo a lo pobre", desc: "Papas fritas, cebolla y huevo", price: 15900, tag: "TOP" },
  { img: "pastel", name: "Pastel de choclo", desc: "En greda, con pino tradicional", price: 13900, tag: "CHEF" },
  { img: "leche", name: "Leche asada", desc: "Caramelo natural", price: 5500, tag: "" },
  { img: "pisco", name: "Pisco sour", desc: "Pisco 35°, limón de pica", price: 6900, tag: "TOP" },
];

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

const faqs = [
  { q: "¿Qué incluye el plan?", a: "HOLU Completo ($19.990/mes) incluye todo: mesas con QR, camareros con su propio perfil, pantalla de cocina, caja y kiosco de autoservicio. Un solo precio, sin niveles — y 30 días gratis para probarlo antes de pagar nada. Todo desde el navegador, sin instalar nada." },
  { q: "¿HOLU reemplaza al camarero?",         a: "No. HOLU ayuda al equipo a trabajar mejor. El camarero sigue siendo clave para la atención, la experiencia humana y el cobro presencial cuando corresponde." },
  { q: "¿Funciona con QR por mesa?",           a: "Sí. Cada mesa tiene un QR único. El cliente entra directamente a la experiencia de su mesa y todo queda conectado con pedidos, cocina, camareros y administración." },
  { q: "¿Puedo agregar o editar platos?",       a: "Sí. Desde administración puedes crear platos, cambiar precios, subir imágenes, activar o desactivar disponibilidad y decidir qué ve el cliente." },
  { q: "¿El sistema incluye propinas y caja?",  a: "Sí. HOLU permite registrar propinas aceptadas o rechazadas, abrir caja, cerrar caja, cambiar turnos, imprimir cierres y revisar reportes." },
  { q: "¿Qué es el tótem de autoservicio?",    a: "Es una pantalla en barra o mostrador desde donde los clientes hacen sus propios pedidos sin esperar atención. Está conectada en tiempo real con cocina, caja y administración." },
  { q: "¿Sirve para comida rápida o cafés?",   a: "Sí. El tótem de autoservicio de barra es ideal para cafés, comida rápida y cualquier negocio con flujo alto de pedidos. Todo queda conectado a la misma carta, cocina y caja." },
  { q: "¿Puedo tomar pedidos de clientes que no usan el QR?", a: "Sí. El camarero toma el pedido desde su celular o tablet, y en el mostrador puedes hacer una venta directa y cobrarla en el momento. Todo llega a la misma cocina y a la misma caja." },
  { q: "¿Necesito comprar equipos?", a: "No. HOLU funciona desde el navegador de cualquier celular, tablet o computador. Para la cocina te sirve una tablet o pantalla que ya tengas." },
  { q: "¿Emite boleta electrónica?", a: "Sí: conectas tu propia cuenta de Tuu en la configuración y HOLU emite la boleta al cerrar la mesa. Cada restaurante usa su propia clave." },
];

const flow = [
  ["1", "Cliente escanea QR",                 "El cliente entra automáticamente a la experiencia de su mesa."],
  ["2", "Cliente pide o llama al camarero",   "Los pedidos, llamados y solicitudes llegan al instante."],
  ["3", "Cocina y equipo reciben en vivo",    "La cocina recibe pedidos organizados automáticamente y actualiza el estado del plato en segundos."],
  ["4", "Administración controla todo",       "Ventas, propinas, caja, cocina y operación conectados desde cualquier dispositivo."],
];

const ORDERS = [
  { id: "ORD-0042", mesa: "Mesa 5", items: "2 hamburguesas · 1 limonada", status: "Preparando", c: "#b3781c" },
  { id: "ORD-0041", mesa: "Mesa 2", items: "1 pasta · 2 aguas",           status: "Listo ✓",    c: "#0f9d63" },
  { id: "ORD-0040", mesa: "Mesa 7", items: "3 tacos · 1 cerveza",         status: "Entregando",  c: "#2f6fe0" },
  { id: "ORD-0039", mesa: "Mesa 1", items: "1 salmón · 1 vino tinto",     status: "Cobrado",     c: "#6b5c47" },
];

// Ciclo de vida del primer pedido en el mockup del hero: se anima solo,
// mostrando cómo entra un pedido y cómo termina cobrado.
const HERO_DEMO_STEPS = [
  { status: "Nuevo pedido", c: "#2f6fe0" },
  { status: "Preparando",   c: "#b3781c" },
  { status: "Listo ✓",      c: "#0f9d63" },
  { status: "Cobrado ✓",    c: "#6b5c47" },
];

const TABLES = [
  { n: 1, s: "Libre",   bg: "rgba(36,26,12,.035)",  tc: "#8a7a63" },
  { n: 2, s: "Activa",  bg: "rgba(179,120,28,.1)",  tc: "#b3781c" },
  { n: 3, s: "Libre",   bg: "rgba(36,26,12,.035)",  tc: "#8a7a63" },
  { n: 4, s: "Cuenta",  bg: "rgba(15,157,99,.09)",  tc: "#0f9d63" },
  { n: 5, s: "Activa",  bg: "rgba(179,120,28,.1)",  tc: "#b3781c" },
  { n: 6, s: "Libre",   bg: "rgba(36,26,12,.035)",  tc: "#8a7a63" },
  { n: 7, s: "Activa",  bg: "rgba(179,120,28,.1)",  tc: "#b3781c" },
  { n: 8, s: "Libre",   bg: "rgba(36,26,12,.035)",  tc: "#8a7a63" },
];

const WA = "https://wa.me/56992103974";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
:root{--bg:#060605;--line:rgba(255,255,255,.1);--text:#fff8ed;--muted:#b0a396;--dim:#6a6058;--gold:#c8a96b;--gold2:#f0d48d;--green:#34d399;--shadow:0 28px 90px rgba(20,13,5,.55)}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(circle at 12% -8%,rgba(200,169,107,.18),transparent 32%),radial-gradient(circle at 100% 18%,rgba(255,255,255,.05),transparent 28%),#050504;color:var(--text);font-family:Manrope,system-ui,sans-serif;font-size:16px;line-height:1.5}
a{color:inherit;text-decoration:none}
.page{overflow:hidden;position:relative}
.page::after{content:'';position:fixed;inset:0;z-index:999;pointer-events:none;opacity:.035;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.container{width:min(1160px,calc(100% - 40px));margin:auto}

.nav{position:sticky;top:0;z-index:40;background:rgba(6,6,5,.88);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}
.nav-in{height:110px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.nav-links{display:flex;align-items:center;gap:22px;color:var(--muted);font-weight:500;font-size:14px}
.nav-links a:not(.btn):hover{color:var(--text)}

.btn{border:0;border-radius:14px;padding:12px 20px;font-weight:600;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:.2s ease}
.btn.primary{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#160f02;box-shadow:0 12px 32px rgba(200,169,107,.2)}
.btn.primary:hover{box-shadow:0 16px 44px rgba(200,169,107,.34);transform:translateY(-1px)}
.btn.primary:active{transform:translateY(0) scale(.97);box-shadow:0 8px 20px rgba(200,169,107,.26)}
.btn.ghost{background:rgba(255,255,255,.07);border:1px solid var(--line);color:var(--text)}
.btn.ghost:hover{background:rgba(255,255,255,.11)}
.btn.ghost:active{transform:scale(.97);background:rgba(255,255,255,.14)}
.btn.wa{background:linear-gradient(135deg,#25d366,#128c48);color:#fff;box-shadow:0 10px 28px rgba(37,211,102,.22)}
.btn.wa:hover{box-shadow:0 14px 36px rgba(37,211,102,.34);transform:translateY(-1px)}
.btn.wa:active{transform:translateY(0) scale(.97);box-shadow:0 6px 16px rgba(37,211,102,.3)}

.hero{position:relative;padding:80px 0 52px}
.hero-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
.eyebrow{color:var(--gold2);font-weight:600;letter-spacing:.12em;font-size:11px;text-transform:uppercase}
.hero h1{font-size:clamp(48px,6.5vw,84px);font-weight:800;line-height:.88;letter-spacing:-.06em;margin:14px 0 18px;color:#fff;text-wrap:balance}
.hero p{color:var(--muted);font-size:17px;line-height:1.75;max-width:520px}
.cta-row{display:flex;gap:12px;flex-wrap:wrap;margin-top:26px}
.trust{display:flex;gap:18px;flex-wrap:wrap;margin-top:22px;color:var(--dim);font-size:13px;font-weight:500}
.trust span{display:flex;gap:7px;align-items:center}
.dot{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 0 4px rgba(52,211,153,.12);flex:0 0 auto}
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
.tablet-screen{
  --ts-bg:#f8f2e4;--ts-panel:rgba(36,26,12,.04);--ts-line:rgba(36,26,12,.09);
  --ts-text:#241a0c;--ts-muted:#6b5c47;--ts-dim:#8a7a63;--ts-gold:#b3781c;--ts-gold2:#8a5a12;
  border-radius:24px;background:var(--ts-bg);color:var(--ts-text);overflow:hidden;border:1px solid rgba(0,0,0,.12)
}
.tablet-btn-right{position:absolute;right:-3px;top:110px;width:3px;height:52px;border-radius:0 3px 3px 0;background:linear-gradient(180deg,#3a3a3c,#2a2a2c);box-shadow:2px 0 4px rgba(0,0,0,.4)}
.tablet-btn-vol1{position:absolute;left:-3px;top:100px;width:3px;height:38px;border-radius:3px 0 0 3px;background:linear-gradient(180deg,#3a3a3c,#2a2a2c);box-shadow:-2px 0 4px rgba(0,0,0,.4)}
.tablet-btn-vol2{position:absolute;left:-3px;top:148px;width:3px;height:38px;border-radius:3px 0 0 3px;background:linear-gradient(180deg,#3a3a3c,#2a2a2c);box-shadow:-2px 0 4px rgba(0,0,0,.4)}
.tab-topbar{background:linear-gradient(135deg,#fffaf0,#f1e1bd);padding:14px 16px 12px;border-bottom:1px solid var(--ts-line)}
.tab-topbar-row{display:flex;justify-content:space-between;align-items:center}
.tab-brand{font-size:15px;font-weight:700;letter-spacing:-.04em;color:var(--ts-text)}
.tab-live{font-size:10px;color:#0a7a4c;background:rgba(15,157,99,.12);border:1px solid rgba(15,157,99,.24);border-radius:999px;padding:4px 9px;font-weight:600;animation:pulse 2.4s infinite}
.tab-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px}
.tab-stat{background:var(--ts-panel);border:1px solid var(--ts-line);border-radius:10px;padding:8px 10px}
.tab-stat b{display:block;font-size:15px;font-weight:700;color:var(--ts-gold2);line-height:1}
.tab-stat span{display:block;font-size:10px;color:var(--ts-muted);margin-top:3px}
.tab-section{padding:12px 14px}
.tab-label{font-size:10px;color:var(--ts-gold);letter-spacing:.1em;text-transform:uppercase;font-weight:600;margin-bottom:8px}
.tab-order{display:flex;justify-content:space-between;align-items:center;padding:9px 11px;border-radius:10px;background:var(--ts-panel);border:1px solid var(--ts-line);margin-bottom:5px}
.tab-order-info b{font-size:12px;font-weight:600;display:block;color:var(--ts-text)}
.tab-order-info span{font-size:10px;color:var(--ts-muted);display:block;margin-top:2px}
.tab-badge{font-size:10px;border-radius:999px;padding:3px 8px;font-weight:600;white-space:nowrap}
.tab-tables{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
.tab-table{border:1px solid var(--ts-line);border-radius:9px;padding:7px 4px;text-align:center}
.tab-table b{display:block;font-size:13px;font-weight:700;line-height:1;color:var(--ts-text)}
.tab-table span{display:block;font-size:9px;margin-top:3px}
.tab-footer{padding:10px 14px;border-top:1px solid var(--ts-line);display:flex;gap:6px}
.tab-footbtn{flex:1;border-radius:10px;padding:9px 6px;font-size:11px;font-weight:600;text-align:center;cursor:pointer;border:1px solid var(--ts-line);background:var(--ts-panel);color:var(--ts-muted)}
.tab-footbtn.active{background:linear-gradient(135deg,rgba(179,120,28,.2),rgba(255,255,255,.5));border-color:rgba(179,120,28,.32);color:var(--ts-gold2)}
.tab-order.demo-live{animation:tabOrderIn .45s ease,tabOrderFlash 1.4s ease}
@keyframes tabOrderIn{0%{opacity:0;transform:translateY(-5px)}100%{opacity:1;transform:translateY(0)}}
@keyframes tabOrderFlash{0%{background:rgba(179,120,28,.22)}100%{background:var(--ts-panel)}}

/* STATS */

.section{padding:72px 0}
.section-head{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:28px}
.section h2{font-size:clamp(36px,5vw,58px);font-weight:700;line-height:.92;letter-spacing:-.05em;margin:0;text-wrap:balance}
.section-head p{color:var(--muted);max-width:440px;line-height:1.7;font-size:15px}

/* Bento asimétrico: Administración es el núcleo (tarjeta grande) — rompe el
   grid de 3 columnas iguales sin tocar la paleta. Las demás quedan chicas
   alrededor, como corresponde a módulos que se conectan al núcleo en vez de
   competir con él en tamaño. */
.card{border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid var(--line);padding:22px;transition:.2s ease}
.card:hover{transform:translateY(-2px);border-color:rgba(240,212,141,.18)}
.card .label{font-size:10px;color:var(--gold2);letter-spacing:.14em;text-transform:uppercase;font-weight:600}
.card h3{font-size:19px;margin:10px 0 8px;font-weight:600;letter-spacing:-.03em}
.card p{color:var(--muted);line-height:1.6;font-size:14px;margin:0}
@media(max-width:960px){.modules .card:nth-child(4){grid-column:auto}}

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
.hub-card{position:relative;overflow:hidden;width:100%;border-radius:22px;padding:22px 18px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.015));border:1px solid var(--line);text-align:center;transition:.25s ease}
.hub-card::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% -12%,var(--accent,transparent),transparent 65%);opacity:.18;pointer-events:none;transition:opacity .25s ease}
.hub-card>*{position:relative;z-index:1}
.hub-card:hover{transform:translateY(-4px);box-shadow:0 22px 48px -14px var(--accent,rgba(0,0,0,.4)),0 10px 26px rgba(0,0,0,.28)}
.hub-card:hover::before{opacity:.28}
.hub-icon{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;margin:0 auto 14px}
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

/* TIER GRID — un solo plan, centrado, + el plan a medida aparte */
.tier-grid{display:flex;justify-content:center;max-width:760px;margin:0 auto}
.tier-card{position:relative;display:flex;flex-direction:column;width:min(440px,100%);border-radius:24px;padding:30px 28px;background:linear-gradient(160deg,rgba(200,169,107,.14),rgba(255,255,255,.03));border:1px solid rgba(240,212,141,.4);box-shadow:0 22px 60px rgba(200,169,107,.14)}
.tier-name{font-size:19px;font-weight:700;letter-spacing:-.02em;margin:6px 0 6px}
.tier-blurb{color:var(--muted);font-size:13px;line-height:1.55;margin:0 0 14px}
.tier-price{font-size:38px;font-weight:700;color:var(--gold2);line-height:1;margin-bottom:2px}
.tier-price small{font-size:13px;color:var(--muted);font-weight:500}
.tier-annual-note{color:var(--green);font-size:12px;font-weight:600;margin:0 0 14px}
.tier-features{display:grid;gap:8px;margin:14px 0 20px;flex:1}
.tier-features div{display:flex;gap:8px;align-items:flex-start;color:var(--muted);font-size:13.5px;line-height:1.5}
.tier-roi{color:var(--muted);font-size:12.5px;line-height:1.55;margin:0 0 16px;padding:11px 13px;border-radius:12px;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.18)}

/* DEMO SCREEN — kiosco de verdad, como si fuera la pantalla real */
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
.device-tile-img{width:100%;aspect-ratio:1;border-radius:10px;display:block;overflow:hidden;margin-bottom:6px;background:#120c07}
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

/* FAQ — lista editorial sin marco de tarjeta, para que no se sienta como
   otra caja más repitiendo el mismo look que módulos, showcase y hub. */
.faq-accordion{display:flex;flex-direction:column;border-top:1px solid var(--line)}
.faq-item{border-bottom:1px solid var(--line)}
.faq-btn{width:100%;background:none;border:0;color:var(--text);display:flex;justify-content:space-between;align-items:center;padding:22px 2px;font-size:16px;font-weight:600;cursor:pointer;text-align:left;gap:16px;transition:.2s ease}
.faq-btn:hover{color:var(--gold2)}
.faq-answer{padding:0 2px 22px;color:var(--muted);line-height:1.75;font-size:14px;max-width:680px}
.faq-icon{font-size:20px;color:var(--gold2);flex:0 0 auto;line-height:1}

.final{padding:80px 0 96px;text-align:center}
.final-box{position:relative;overflow:hidden;border-radius:36px;background:radial-gradient(circle at 50% 0,rgba(200,169,107,.2),transparent 44%),linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border:1px solid var(--line);padding:64px 24px;box-shadow:var(--shadow)}
.final-box::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at top right,rgba(240,212,141,.1),transparent 32%);pointer-events:none}
.final-box h2{font-size:clamp(44px,6.5vw,96px);font-weight:800;line-height:.86;letter-spacing:-.07em;margin:12px auto 16px;position:relative;z-index:1;text-wrap:balance}
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

/* SCROLL REVEAL — le da vida a toda la página al bajar, no solo al hero */
/* VIDEOS + CARTA CON IMÁGENES */
.video-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
.video-card{border-radius:24px;overflow:hidden;background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid var(--line);display:flex;flex-direction:column}
.video-frame{position:relative;background:#0c0a07;display:grid;place-items:center;overflow:hidden}
.video-frame{aspect-ratio:16/10}
.video-frame video{width:100%;height:100%;object-fit:contain;display:block;background:#0c0a07}
.video-ph{display:grid;gap:8px;justify-items:center;text-align:center;padding:24px;color:var(--muted)}
.video-ph b{color:var(--text);font-size:15px}
.video-ph small{font-size:12px;color:var(--dim);max-width:260px;line-height:1.5}
.video-play{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;background:rgba(240,212,141,.14);border:1px solid rgba(240,212,141,.35);color:var(--gold2);font-size:18px;padding-left:3px}
.video-info{padding:18px 20px 22px}
.video-info .label{font-size:10px;color:var(--gold2);letter-spacing:.14em;text-transform:uppercase;font-weight:700}
.video-info h3{font-size:20px;margin:8px 0 6px;letter-spacing:-.03em;font-weight:700}
.video-info p{margin:0;color:var(--muted);font-size:14px;line-height:1.65}
.dish-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.dish-card{border-radius:20px;padding:10px 10px 14px;background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid var(--line);display:flex;flex-direction:column;gap:3px}
.dish-photo{position:relative;aspect-ratio:1;border-radius:14px;overflow:hidden;margin-bottom:8px;background:#120c07}
.dish-photo img,.device-tile-img img{width:100%;height:100%;object-fit:cover;display:block}
.dish-tag{position:absolute;top:8px;left:8px;font-size:9px;font-weight:900;color:#201405;background:rgba(247,211,123,.95);border-radius:999px;padding:3px 7px}
.dish-card b{font-size:14px;letter-spacing:-.02em}
.dish-desc{color:var(--muted);font-size:12px;line-height:1.4}
.dish-price{color:var(--gold2);font-weight:800;font-size:15px;margin-top:4px}
.dish-note{color:var(--dim);font-size:12px;margin:12px 4px 0}
@media(max-width:760px){
  .video-grid{grid-template-columns:1fr}
  .dish-grid{grid-template-columns:repeat(2,1fr)}
}
.reveal{opacity:0;transform:translateY(28px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1);transition-delay:calc(var(--d,0) * 70ms)}
.reveal.in-view{opacity:1;transform:translateY(0)}
@media(prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}}

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
  .metrics{display:none}
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

export default function Landing({ adminUrl }: { n8nBase?: string; adminUrl?: string }) {
  const [openFaq, setOpenFaq] = useState(0);
  const [form, setForm] = useState({ name: "", restaurant: "", email: "", phone: "", plan: "pro" });
  const [formState, setFormState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [formError, setFormError] = useState("");
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  const [demoStep, setDemoStep] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setDemoStep((s) => (s + 1) % HERO_DEMO_STEPS.length), 2400);
    return () => clearInterval(t);
  }, []);

  // Anima cada sección al entrar en pantalla mientras el usuario baja,
  // en vez de que todo aparezca estático de una — le da vida al resto
  // de la página, no solo al tablet animado del hero.
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    if (!els.length) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.classList.add("in-view"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = adminUrl;

  // Registering creates the restaurant right away — no payment step. The
  // account gets a real 30-day trial (trial_ends_at defaults on signup);
  // MercadoPago only re-enters if that trial expires and the owner
  // reactivates from the panel.
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
      if (!res.ok || !data?.ok) throw new Error("sin cuenta creada");
      setFormState("done");
    } catch {
      setFormError("No pudimos crear tu cuenta. Revisa los datos e inténtalo de nuevo.");
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
            <a href="#videos">Míralo en acción</a>
            <a href="#carta">La carta</a>
            <a href="#conectado">Cómo funciona</a>
            <a href="#precios">Planes</a>
            <a href="#faq">Preguntas</a>
            <a className="btn primary" href="#registro">Crear cuenta gratis</a>
          </div>
        </div>
      </nav>

      <header id="top" className="hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">Para restaurantes, cafés y bares</div>
            <h1>Tu restaurante, <span style={{ color: "var(--gold2)" }}>conectado</span> de la mesa a la caja.</h1>
            <p>Tus clientes piden desde un QR con una carta con fotos, la cocina recibe el pedido al instante y tú cobras y emites la boleta desde el mismo sistema. Sin instalar nada y desde $19.990 al mes.</p>
            <div className="cta-row">
              <a className="btn primary" href="#registro">Crear mi cuenta gratis</a>
              <a className="btn ghost" href="#videos">Ver cómo funciona</a>
            </div>
            <div className="trust">
              <span><i className="dot" />30 días gratis · Sin tarjeta</span>
              <span><i className="dot" />Listo en minutos, desde el navegador</span>
              <span><i className="dot" />Mesa, camareros, cocina, caja y kiosco incluidos</span>
            </div>
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
                  {ORDERS.map((o, i) => {
                    const live = i === 0 ? HERO_DEMO_STEPS[demoStep] : null;
                    const status = live?.status ?? o.status;
                    const color = live?.c ?? o.c;
                    return (
                      <div className={`tab-order${live ? " demo-live" : ""}`} key={live ? `${o.id}-${demoStep}` : o.id}>
                        <div className="tab-order-info">
                          <b>{o.id} · {o.mesa}</b>
                          <span>{o.items}</span>
                        </div>
                        <span className="tab-badge" style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}>{status}</span>
                      </div>
                    );
                  })}
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

      </header>

      <section id="videos" className="section">
        <div className="container">
          <div className="section-head reveal">
            <h2>Míralo funcionando, en menos de 2 minutos.</h2>
            <p>Cuatro videos cortos con el sistema real: lo que ve tu cliente, lo que hace tu equipo y cómo cobras.</p>
          </div>
          <div className="video-grid">
            {VIDEOS.map((v, i) => <VideoCard v={v} i={i} key={v.src} />)}
          </div>
          <div style={{ textAlign: "center", marginTop: 28 }}>
            <a className="btn primary" href="#registro">Probarlo gratis 30 días</a>
          </div>
        </div>
      </section>

      <section id="carta" className="section">
        <div className="container split">
          <div>
            <div className="eyebrow">Una carta que da hambre</div>
            <h2>Tus platos, con foto, en el celular de cada cliente.</h2>
            <p style={{ color: "var(--muted)", lineHeight: 1.75, fontSize: 15 }}>Sube la foto de cada plato desde tu celular y listo: aparece en la carta de la mesa, en el kiosco y en el panel. El cliente toca un plato, ve el detalle, los alérgenos y puede dejar una nota para cocina.</p>
            <div className="benefits" style={{ marginTop: 20 }}>
              {[
                "Fotos de tus platos, listas para subir desde el celular",
                "Alérgenos y descripción en cada plato",
                "Notas para cocina por plato: sin cebolla, punto de la carne…",
                "Cambias precios y disponibilidad al instante",
              ].map((b) => <div className="benefit" key={b}><span className="check">{Icons.check}</span><span>{b}</span></div>)}
            </div>
          </div>
          <div>
            <div className="dish-grid">
              {DISHES.map((d, i) => (
                <article className="dish-card reveal" style={{ ["--d" as string]: i }} key={d.img}>
                  <div className="dish-photo"><DishImg name={d.img} alt={d.name} />{d.tag ? <span className="dish-tag">{d.tag}</span> : null}</div>
                  <b>{d.name}</b>
                  <span className="dish-desc">{d.desc}</span>
                  <span className="dish-price">{clp(d.price)}</span>
                </article>
              ))}
            </div>
            <p className="dish-note">Carta de ejemplo con platos ilustrados. En tu cuenta subes tus propias fotos.</p>
          </div>
        </div>
      </section>

      <section id="conectado" className="section">
        <div className="container hub-wrap">
          <div className="section-head reveal">
            <h2>Un sistema. Todo conectado en vivo.</h2>
            <p>Mesa, camareros, cocina, caja y kiosco trabajan sobre el mismo cerebro — misma carta, misma cocina, misma caja, en tiempo real.</p>
          </div>
          <div className="hub">
            <div className="hub-core-wrap reveal">
              <div className="hub-core">
                <span className="hub-badge">Núcleo del sistema</span>
                <h3>HOLU Admin</h3>
                <p>Carta, cocina, caja, empleados, inventario, propinas, reportes y auditoría — el corazón de tu restaurante, siempre conectado con cada canal de venta y cada rol de tu equipo.</p>
              </div>
            </div>

            <div className="hub-flow" />
            <div className="hub-group">
              <div className="hub-group-label">Canales de venta</div>
              <div className="hub-row hub-row-2">
                {salesChannels.map((e, i) => (
                  <div className="hub-spoke reveal" style={{ ["--d" as string]: i }} key={e.key}>
                    <div className="hub-spoke-line" />
                    <div className="hub-card" style={{ borderColor: `${e.color}30`, ["--accent" as string]: `${e.color}59` }}>
                      <span className="hub-icon" style={{ background: `${e.color}18`, color: e.color, boxShadow: `0 0 0 6px ${e.color}12` }}>{Icons[e.icon as keyof typeof Icons]}</span>
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
                {teamRoles.map((e, i) => (
                  <div className="hub-spoke reveal" style={{ ["--d" as string]: i }} key={e.key}>
                    <div className="hub-spoke-line" />
                    <div className="hub-card" style={{ borderColor: `${e.color}30`, ["--accent" as string]: `${e.color}59` }}>
                      <span className="hub-icon" style={{ background: `${e.color}18`, color: e.color, boxShadow: `0 0 0 6px ${e.color}12` }}>{Icons[e.icon as keyof typeof Icons]}</span>
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

      <section className="section">
        <div className="container">
          <div className="section-head reveal">
            <h2>Diseñado para sentirse moderno desde el primer segundo.</h2>
            <p>HOLU no parece un POS antiguo. Se siente como una app moderna diseñada para restaurantes que quieren una operación rápida, limpia y organizada.</p>
          </div>
          <div className="showcase-grid">
            {showcase.map((item, i) => (
              <article className="info-card reveal" key={item.title} style={{ borderColor: `${item.color}28`, ["--d" as string]: i }}>
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
            {benefits.map((b, i) => <div className="benefit reveal" style={{ ["--d" as string]: i }} key={b}><span className="check">{Icons.check}</span><span>{b}</span></div>)}
          </div>
        </div>
      </section>

      <section id="demo" className="section">
        <div className="container">
          <div className="demo-panel">
            <div className="eyebrow">Flujo real</div>
            <h2 style={{ fontSize: "clamp(34px,4vw,48px)", letterSpacing: "-.05em", marginTop: 12 }}>De la mesa a la cocina. Sin caos.</h2>
            <div className="flow-track">
              {flow.map(([number, title, text], i) => (
                <div className="flow-card reveal" style={{ ["--d" as string]: i }} key={number}>
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
            <div className="eyebrow">Empieza gratis, hoy mismo</div>
            <h2 style={{ fontSize: "clamp(36px,5vw,58px)", fontWeight: 700, lineHeight: .92, letterSpacing: "-.05em", margin: "14px 0 18px" }}>
              Crea tu cuenta.{" "}
              <span style={{ color: "var(--green)" }}>Pruébalo</span> en tu propio{" "}
              <span style={{ color: "var(--gold2)" }}>restaurante</span>.
            </h2>
            <p style={{ color: "var(--muted)", lineHeight: 1.75, fontSize: 16, marginBottom: 24 }}>
              Completa tus datos y en minutos tienes tu restaurante funcionando en HOLU: mesas, camareros, cocina y caja conectados en tiempo real. 30 días gratis, sin tarjeta.
            </p>
            <div className="register-benefits">
              {[
                "Tu restaurante funciona completo desde el día uno",
                "Tu cuenta se crea sola, gratis, sin tarjeta",
                "Sin instalación — funciona desde el navegador",
                "30 días para probarlo antes de pagar nada",
              ].map(b => (
                <div className="reg-benefit" key={b}>
                  <span className="reg-check">{Icons.check}</span>
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="register-form-box reveal">
            {formState === "done" ? (
              <div className="form-success">
                <div className="success-icon" style={{ color: "var(--gold2)" }}>{Icons.success}</div>
                <h4>Cuenta creada</h4>
                <p>Te enviamos tu usuario y contraseña a la dirección que registraste. Con eso entras a <span style={{ color: "var(--gold2)" }}>app.holu.pro</span> — tu restaurante ya está creado, con 30 días gratis para probarlo.</p>
                <div style={{ marginTop: 20 }}>
                  <a className="btn primary" href="https://app.holu.pro" target="_blank" rel="noopener noreferrer" style={{ width: "100%", justifyContent: "center" }}>Entrar a mi cuenta →</a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegister}>
                <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.03em", margin: "0 0 6px" }}>Quiero mi cuenta</h3>
                <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 22px", lineHeight: 1.6 }}>Completa tus datos y activa tu cuenta gratis por 30 días, sin tarjeta. Te llegan tus claves por correo y ya puedes entrar.</p>
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
                  {formState === "loading" ? <><span className="spinner" />Creando tu cuenta...</> : "Crear mi cuenta gratis →"}
                </button>
                <p style={{ color: "var(--dim)", fontSize: 12, textAlign: "center", marginTop: 12 }}>30 días gratis · Sin tarjeta de crédito</p>
              </form>
            )}
          </div>
        </div>
      </section>

      <section id="precios" className="section">
        <div className="container">
          <div className="section-head reveal">
            <h2>Un precio. Todo incluido.</h2>
            <p>Mesa, camareros, cocina, caja y kiosco, sin niveles ni letra chica. 30 días gratis antes de pagar nada.</p>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
            <div style={{ display: "flex", gap: 0, background: "rgba(255,255,255,.06)", border: "1px solid var(--line)", borderRadius: 16, padding: 4 }}>
              <button type="button" onClick={() => setBilling("monthly")} style={{ padding: "10px 24px", borderRadius: 12, border: 0, cursor: "pointer", fontWeight: 600, fontSize: 14, transition: ".2s ease", background: billing === "monthly" ? "linear-gradient(135deg,var(--gold),var(--gold2))" : "transparent", color: billing === "monthly" ? "#160f02" : "var(--muted)" }}>Mensual</button>
              <button type="button" onClick={() => setBilling("annual")} style={{ padding: "10px 24px", borderRadius: 12, border: 0, cursor: "pointer", fontWeight: 600, fontSize: 14, transition: ".2s ease", background: billing === "annual" ? "linear-gradient(135deg,var(--gold),var(--gold2))" : "transparent", color: billing === "annual" ? "#160f02" : "var(--muted)" }}>Anual&nbsp;<span style={{ fontSize: 12, fontWeight: 700, color: billing === "annual" ? "#064" : "var(--green)" }}>2 meses gratis</span></button>
            </div>
          </div>
          <div className="tier-grid">
            <article className="tier-card reveal">
              <span className="tag" style={{ position: "static", alignSelf: "flex-start", marginBottom: 8, background: "rgba(52,211,153,.16)", color: "var(--green)" }}>30 días gratis, sin tarjeta</span>
              <h3 className="tier-name">{PLAN.name}</h3>
              <p className="tier-blurb">{PLAN.blurb}</p>
              <div className="tier-price">
                {billing === "monthly"
                  ? <>{clp(PLAN.monthly)}<small> / mes</small></>
                  : <>{clp(PLAN.annual)}<small> / año</small></>}
              </div>
              {billing === "annual" && (
                <p className="tier-annual-note">Equivale a {clp(Math.round(PLAN.annual / 12))}/mes</p>
              )}
              <div className="tier-features">
                {PLAN.features.map((f) => (
                  <div key={f} style={{ color: "var(--muted)" }}>
                    <span style={{ color: "var(--green)", flex: "0 0 auto", marginTop: 2 }}>{Icons.check}</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <p className="tier-roi">Ejemplo: con un ticket promedio de {clp(12000)}, atender solo 6 mesas más por noche gracias a pedidos más rápidos son cerca de {clp(72000)} extra cada noche — HOLU te sale {clp(PLAN.monthly)} al mes.</p>
              <a className="btn wa" href={`${WA}?text=${encodeURIComponent(`Hola, quiero activar HOLU (${billing === "annual" ? `anual ${clp(PLAN.annual)}` : `mensual ${clp(PLAN.monthly)}`})`)}`} target="_blank" rel="noopener noreferrer" style={{ width: "100%", fontSize: 14, padding: "13px 18px" }}>{Icons.message} Activar por WhatsApp</a>
            </article>
          </div>
          <p style={{ textAlign: "center", color: "var(--dim)", fontSize: 13, margin: "20px 0 0" }}>{Icons.check} 30 días gratis, sin tarjeta, para probar el sistema completo en tu propio restaurante.</p>

          <div style={{ marginTop: 56, marginBottom: 24, textAlign: "center" }}>
            <span className="eyebrow">Incluidos en tu plan</span>
            <h3 style={{ fontSize: "clamp(24px,3vw,32px)", fontWeight: 700, letterSpacing: "-.03em", margin: "10px 0 0" }}>Así funciona el Kiosco.</h3>
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
                        <span className="device-tile-img"><DishImg name={it.img} alt={it.name} /></span>
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
          </div>

        </div>
      </section>

      <section id="faq" className="section">
        <div className="container">
          <div className="section-head reveal">
            <h2>Todo lo que normalmente preguntan antes de usar HOLU.</h2>
            <p>Respondemos las preguntas más comunes sobre operación, instalación, QR, cocina y funcionamiento del sistema.</p>
          </div>
          <div className="faq-accordion">
            {faqs.map((faq, index) => (
              <div className="faq-item reveal" style={{ ["--d" as string]: Math.min(index, 5) }} key={faq.q}>
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
            <p>Mesa, camareros, cocina, caja y kiosco — todo por $19.990/mes, con 30 días gratis para probarlo.</p>
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
          <span>Mesas · Camareros · Cocina · Administración · Autoservicio</span>
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
