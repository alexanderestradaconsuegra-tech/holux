// HOLU — Aviso de fallos
//
// Se dispara solo cuando un flujo marcado con este "workflow de errores" falla
// en producción (Error Trigger). Decide si vale la pena avisar y arma el mensaje:
//   * Los rechazos esperados (QR inválido, sin sesión, carrito vacío, datos
//     mal formados...) NO avisan: los generan clientes y bots todo el día.
//   * El mismo error (mismo flujo + nodo + mensaje) no se repite en 30 minutos.
// Devuelve { sendable: 'yes'|'no', subject, text, html }. El correo lo manda el
// nodo siguiente; el WhatsApp se intenta acá si Evolution está configurado.

const e = $input.first().json || {};
const wf = e.workflow || {};
const ex = e.execution || {};
const err = ex.error || {};
const msg = String(err.message || 'sin mensaje').replace(/\s+/g, ' ').trim();
const node = String((err.node && err.node.name) || ex.lastNodeExecuted || 'desconocido');

const ESPERADOS = [
  /No autorizado/i, /QR inválido/i, /Missing required field/i, /Invalid (email|role)/i,
  /Password must be/i, /rating must be/i, /items must be/i, /Item inválido/i,
  /Plato no disponible/i, /El carrito está vacío/i, /no configuró su MercadoPago/i,
  /no está tomando pedidos/i, /pedido mínimo/i, /fuera de nuestra zona/i, /Acción no válida/i,
];
if (ESPERADOS.some((r) => r.test(msg))) return [{ json: { sendable: 'no', motivo: 'esperado' } }];

const sd = $getWorkflowStaticData('global');
sd.enviados = sd.enviados || {};
const ahora = Date.now();
for (const k of Object.keys(sd.enviados)) if (ahora - sd.enviados[k] > 6 * 3600000) delete sd.enviados[k];
const clave = `${wf.id}|${node}|${msg.slice(0, 80)}`;
if (sd.enviados[clave] && ahora - sd.enviados[clave] < 30 * 60000) {
  sd.suprimidos = (sd.suprimidos || 0) + 1;
  return [{ json: { sendable: 'no', motivo: 'repetido' } }];
}
sd.enviados[clave] = ahora;

const hora = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });
const link = ex.url || (ex.id && wf.id ? `${($env.N8N_PUBLIC_URL || '').replace(/\/+$/, '')}/workflow/${wf.id}/executions/${ex.id}` : '');
const text = [
  '🚨 HOLU: falló un flujo',
  `Flujo: ${wf.name || wf.id || 'desconocido'}`,
  `Nodo: ${node}`,
  `Error: ${msg.slice(0, 300)}`,
  `Hora: ${hora}`,
  link,
].filter(Boolean).join('\n');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const html = `<pre style="font:14px/1.5 monospace;white-space:pre-wrap">${esc(text)}</pre>`;

// WhatsApp al admin: solo si Evolution está configurado; si falla, el correo igual sale.
const url = ($env.EVOLUTION_API_URL || '').replace(/\/+$/, '');
let whatsapp = 'no configurado';
if (url && $env.EVOLUTION_API_KEY && $env.EVOLUTION_ADMIN_INSTANCE) {
  try {
    await this.helpers.httpRequest({
      method: 'POST', url: `${url}/message/sendText/${$env.EVOLUTION_ADMIN_INSTANCE}`,
      headers: { apikey: $env.EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
      body: { number: '56992103974', text }, json: true, timeout: 15000,
    });
    whatsapp = 'enviado';
  } catch (x) { whatsapp = 'falló'; }
}

return [{ json: { sendable: 'yes', subject: `HOLU: falló ${wf.name || 'un flujo'}`, text, html, whatsapp } }];
