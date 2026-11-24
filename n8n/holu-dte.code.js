// HOLU — Boleta electrónica (Tuu / Haulmer)
//
// Un solo nodo Code con toda la lógica, igual que el agente de WhatsApp: menos
// nodos que cablear a mano y se puede probar entero con un arnés local (ver
// n8n/README-boleta-electronica.md). Basado en el módulo DTE de Merka POS.
//
// Entrada (webhook POST holu-dte):
//   { access_token, action, ticket_id?, data? }
// Acciones: config_save, probar, emitir, pdf, anular.
// Siempre responde { http, out } — `out.resultado` dice cómo terminó.
//
// Seguridad: el access_token es el JWT de la sesión del panel. Se valida
// contra Supabase (/auth/v1/user) y, además, se comprueba en la tabla staff
// que esa persona realmente trabaja en el restaurante que dice: el
// user_metadata de un usuario lo puede editar él mismo, así que NO se confía
// en él para decidir a qué restaurante ni con qué rol se actúa.

const SUPA = 'https://nlwrkumlrudfgsdnhfhw.supabase.co';
const SVC = $env.SUPABASE_SERVICE_ROLE_KEY;
const HAULMER = { pruebas: 'https://dev-api.haulmer.com', produccion: 'https://api.haulmer.com' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = ['config_save', 'probar', 'emitir', 'pdf', 'anular'];
const ADMIN_ONLY = ['config_save', 'probar', 'anular'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const done = (http, out) => [{ json: { http, out } }];

const input = $input.first().json || {};
const body = input.body && typeof input.body === 'object' ? input.body : {};
const action = String(body.action || '');
const token = typeof body.access_token === 'string' ? body.access_token.trim() : '';
const ticketId = String(body.ticket_id || '');
const data = body.data && typeof body.data === 'object' ? body.data : {};

if (!ACTIONS.includes(action)) return done(400, { resultado: 'error', error: 'Acción no válida' });
if (!token || token.length < 20) return done(401, { resultado: 'error', error: 'Sesión inválida. Vuelve a ingresar.' });
if (['emitir', 'pdf', 'anular'].includes(action) && !UUID_RE.test(ticketId)) {
  return done(400, { resultado: 'error', error: 'Cobro no válido' });
}

// Llamada HTTP con reintentos ante 429/5xx. Nunca lanza: devuelve { statusCode, body }.
const call = async (opts, tries = 4) => {
  let last = { statusCode: 0, body: {} };
  for (let i = 0; i < tries; i++) {
    try {
      const r = await this.helpers.httpRequest({ json: true, timeout: 30000, ignoreHttpStatusErrors: true, returnFullResponse: true, ...opts });
      if (r.statusCode === 429 || r.statusCode >= 500) { last = r; await sleep(1200 * (i + 1)); continue; }
      return r;
    } catch (err) {
      last = { statusCode: 0, body: { error: { message: String(err && err.message || err) } } };
      await sleep(1200 * (i + 1));
    }
  }
  return last;
};

const supa = (method, path, payload, extraHeaders) => call({
  method,
  url: SUPA + path,
  headers: Object.assign({ apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' }, extraHeaders || {}),
  body: payload,
}, 2);
const rpc = (fn, args) => supa('POST', '/rest/v1/rpc/' + fn, args);
const rows = (r) => (r && r.statusCode >= 200 && r.statusCode < 300 && Array.isArray(r.body)) ? r.body : [];

// ── 1. ¿Quién llama? ────────────────────────────────────────────────────────
const who = await call({
  method: 'GET',
  url: SUPA + '/auth/v1/user',
  headers: { apikey: SVC, Authorization: 'Bearer ' + token },
}, 2);
const user = who.body || {};
if (who.statusCode !== 200 || !user.id) {
  return done(401, { resultado: 'error', error: 'Sesión inválida. Vuelve a ingresar.' });
}

const claimedRid = String((user.app_metadata && user.app_metadata.restaurant_id) || (user.user_metadata && user.user_metadata.restaurant_id) || '');
if (!claimedRid || !/^[A-Za-z0-9._-]{1,80}$/.test(claimedRid)) {
  return done(403, { resultado: 'error', error: 'Tu cuenta no está asociada a un restaurante' });
}

// Fuente de verdad del rol y del restaurante: la tabla staff.
const email = String(user.email || '').toLowerCase();
let staff;
const internal = email.match(/^staff\.([0-9a-f-]{36})@holu\.internal$/);
if (internal) {
  staff = rows(await supa('GET', `/rest/v1/staff?id=eq.${internal[1]}&restaurant_id=eq.${encodeURIComponent(claimedRid)}&status=eq.Activo&select=id,role&limit=1`))[0];
} else {
  staff = rows(await supa('GET', `/rest/v1/staff?restaurant_id=eq.${encodeURIComponent(claimedRid)}&email=eq.${encodeURIComponent(email)}&role=eq.admin&status=eq.Activo&select=id,role&limit=1`))[0];
}
if (!staff) return done(403, { resultado: 'error', error: 'No tienes permiso en este restaurante' });
const rid = claimedRid;
const isAdmin = staff.role === 'admin';
if (ADMIN_ONLY.includes(action) && !isAdmin) {
  return done(403, { resultado: 'error', error: 'Solo el administrador puede hacer esto' });
}

// ── Datos del restaurante ───────────────────────────────────────────────────
const getFiscal = async () => rows(await supa('GET', `/rest/v1/restaurant_fiscal?restaurant_id=eq.${encodeURIComponent(rid)}&select=*&limit=1`))[0] || null;
const getKey = async () => {
  const r = await rpc('fiscal_get_api_key', { p_restaurant_id: rid });
  return (r.statusCode === 200 && typeof r.body === 'string' && r.body) ? r.body : null;
};
const hoyCL = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
const errMsg = (r, fallback) => {
  const b = (r && r.body) || {};
  const m = b.error ? `${b.error.message || ''} ${(b.error.details || []).map((x) => `${x.field}: ${x.issue}`).join('; ')}`.trim() : (b.message || (r && r.statusCode ? `Error ${r.statusCode}` : ''));
  return clean(m, 300) || fallback;
};

// ── config_save ─────────────────────────────────────────────────────────────
if (action === 'config_save') {
  const ambiente = data.ambiente === 'produccion' ? 'produccion' : 'pruebas';
  const m = data.medios && typeof data.medios === 'object' ? data.medios : {};
  const medios = { efectivo: m.efectivo !== false, tarjeta: m.tarjeta !== false, transferencia: m.transferencia !== false, mixto: m.mixto !== false };
  const key = data.api_key == null ? '' : String(data.api_key).trim();
  if (key && !/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
    return done(200, { resultado: 'error', error: 'La clave de API no tiene el formato esperado' });
  }
  const r = await rpc('fiscal_save_config', {
    p_restaurant_id: rid, p_activo: data.activo === true, p_ambiente: ambiente, p_medios: medios, p_api_key: key || null,
  });
  const row = rows(r)[0];
  if (!row) return done(200, { resultado: 'error', error: 'No se pudo guardar la configuración' });
  return done(200, { resultado: 'ok', config: row });
}

// ── probar ──────────────────────────────────────────────────────────────────
if (action === 'probar') {
  const fiscal = await getFiscal();
  const key = await getKey();
  if (!key) return done(200, { resultado: 'error', error: 'Primero guarda la clave de la API' });
  const base = HAULMER[fiscal && fiscal.ambiente] || HAULMER.pruebas;
  const r = await call({ method: 'GET', url: base + '/v2/dte/organization', headers: { apikey: key } }, 3);
  const o = r.body || {};
  if (r.statusCode === 401 || r.statusCode === 403) {
    return done(200, { resultado: 'error', error: 'La clave no es válida para este ambiente (' + (fiscal && fiscal.ambiente === 'produccion' ? 'producción' : 'pruebas') + ')' });
  }
  if (r.statusCode !== 200 || !o.rut) {
    return done(200, { resultado: 'error', error: 'No se pudo conectar con el proveedor. Intenta de nuevo en un momento.' });
  }
  const acts = Array.isArray(o.actividades) ? o.actividades : [];
  const principal = acts.find((a) => a.actividadPrincipal) || acts[0] || {};
  const emisor = {
    rut: o.rut, razonSocial: o.razonSocial, giro: principal.giro || o.glosaDescriptiva || '',
    direccion: o.direccion || '', comuna: o.comuna || '', cdgSIISucur: o.cdgSIISucur || '',
    actividades: acts.slice(0, 10).map((a) => ({ giro: a.giro, codigo: a.codigoActividadEconomica, principal: !!a.actividadPrincipal })),
  };
  await supa('PATCH', `/rest/v1/restaurant_fiscal?restaurant_id=eq.${encodeURIComponent(rid)}`,
    { conectado: true, conectado_at: new Date().toISOString(), emisor, updated_at: new Date().toISOString() },
    { Prefer: 'return=minimal' });
  return done(200, { resultado: 'ok', emisor });
}

// ── Las demás acciones trabajan sobre un cobro (ticket) de este restaurante ──
const ticket = rows(await supa('GET', `/rest/v1/table_tickets?id=eq.${ticketId}&restaurant_id=eq.${encodeURIComponent(rid)}&select=*&limit=1`))[0];
if (!ticket) return done(200, { resultado: 'error', error: 'El cobro no existe' });
const docs = rows(await supa('GET', `/rest/v1/fiscal_documents?ticket_id=eq.${ticketId}&restaurant_id=eq.${encodeURIComponent(rid)}&select=*`));
const boleta = docs.find((d) => d.tipo === 39) || null;
const nota = docs.find((d) => d.tipo === 61) || null;

// ── pdf ─────────────────────────────────────────────────────────────────────
if (action === 'pdf') {
  if (!boleta || boleta.estado !== 'emitida' || !boleta.token) return done(200, { resultado: 'error', error: 'Este cobro no tiene boleta emitida' });
  const key = await getKey();
  if (!key) return done(200, { resultado: 'error', error: 'No hay clave de API guardada' });
  const base = HAULMER[boleta.ambiente] || HAULMER.pruebas;
  const r = await call({ method: 'GET', url: `${base}/v2/dte/document/${encodeURIComponent(boleta.token)}/pdf`, headers: { apikey: key } });
  const b = r.body || {};
  if (r.statusCode === 200 && b.pdf) return done(200, { resultado: 'ok', pdf: b.pdf, folio: boleta.folio });
  return done(200, { resultado: 'error', error: 'No se pudo obtener el PDF de la boleta' });
}

const fiscal = await getFiscal();
const key = await getKey();

// Recupera folio/pdf de un documento que el proveedor ya tenía (reintento).
const recoverFolio = async (base, tk) => {
  await sleep(600);
  const s = await call({ method: 'GET', url: `${base}/v2/dte/document/${tk}/status`, headers: { apikey: key } });
  let folio = s.body && s.body.folio;
  if (!folio) {
    const j = await call({ method: 'GET', url: `${base}/v2/dte/document/${tk}/json`, headers: { apikey: key } });
    const doc = j.body && j.body.json;
    folio = doc && doc.Encabezado && doc.Encabezado.IdDoc && doc.Encabezado.IdDoc.Folio;
  }
  return folio;
};

const save = async (tipo, estado, extra) => {
  const e = extra || {};
  const r = await rpc('fiscal_save_document', {
    p_restaurant_id: rid, p_ticket_id: ticketId, p_tipo: tipo, p_estado: estado,
    p_folio: e.folio != null ? e.folio : null, p_token: e.token || null, p_resolucion: e.resolucion || null,
    p_ambiente: e.ambiente || null, p_error: e.error || null,
  });
  return rows(r)[0] || null;
};

// ── emitir (boleta, tipo 39) ────────────────────────────────────────────────
if (action === 'emitir') {
  if (boleta && boleta.estado === 'emitida') return done(200, { resultado: 'ya_emitida', folio: boleta.folio });
  if (!fiscal || !fiscal.activo || !fiscal.conectado || !key || !fiscal.emisor) {
    return done(200, { resultado: 'omitida', error: 'La facturación electrónica no está activa' });
  }
  const mm = String(ticket.method_label || '').toLowerCase();
  const medio = mm.startsWith('mixto') ? 'mixto' : mm.includes('efectivo') ? 'efectivo' : mm.includes('tarjeta') ? 'tarjeta' : mm.includes('transfer') ? 'transferencia' : '';
  if (!medio || (fiscal.medios || {})[medio] !== true) return done(200, { resultado: 'omitida', error: 'El medio de pago no lleva boleta' });

  // La boleta sale con la fecha de hoy: solo se emite para cobros de hoy.
  const hoy = hoyCL();
  const fCobro = new Date(ticket.settled_at).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  if (fCobro !== hoy) return done(200, { resultado: 'omitida', error: 'Cobro de otra fecha: no se emite boleta' });

  const total = Math.round(Number(ticket.total) || 0);
  if (total <= 0) return done(200, { resultado: 'omitida', error: 'Cobro sin monto' });

  // Líneas: los montos ya incluyen IVA. Si no suman el total, se prorratea la diferencia.
  let items = ticket.items;
  if (typeof items === 'string') { try { items = JSON.parse(items); } catch (e) { items = []; } }
  items = Array.isArray(items) ? items : [];
  let lines = items.map((it) => ({
    name: clean(it.name || 'Producto', 80) || 'Producto',
    qty: Number(it.qty) || 1,
    amount: Math.max(0, Math.round(Number(it.amount) || 0)),
  })).filter((l) => l.amount > 0);
  if (!lines.length) lines = [{ name: 'Consumo', qty: 1, amount: total }];
  const suma = lines.reduce((s, l) => s + l.amount, 0);
  if (suma !== total) {
    const exact = lines.map((l) => l.amount + (total - suma) * (l.amount / suma));
    const floor = exact.map((x) => Math.floor(x));
    let rest = total - floor.reduce((s, x) => s + x, 0);
    exact.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { floor[i] += 1; rest -= 1; } });
    lines.forEach((l, i) => { l.amount = floor[i]; });
  }
  const detalle = lines.map((l, i) => {
    let qty = l.qty, name = l.name, und = null;
    if (!Number.isInteger(qty)) und = 'KG';
    let prc = Math.round(l.amount / qty);
    if (Math.round(qty * prc) !== l.amount) {
      name = clean(`${l.name} x ${qty}${und ? ' ' + und.toLowerCase() : ''}`, 80); qty = 1; prc = l.amount; und = null;
    }
    const row = { NroLinDet: i + 1, NmbItem: name, QtyItem: qty, PrcItem: prc, MontoItem: l.amount };
    if (und) row.UnmdItem = und;
    return row;
  });
  const neto = Math.round(total / 1.19);
  const e = fiscal.emisor;
  const dte = {
    response: ['FOLIO', 'RESOLUCION', 'PDF', '80MM'],
    dte: {
      Encabezado: {
        IdDoc: { TipoDTE: 39, Folio: 0, FchEmis: hoy, IndServicio: '3' },
        Emisor: { RUTEmisor: e.rut, RznSocEmisor: clean(e.razonSocial, 100), GiroEmisor: clean(e.giro, 80), CdgSIISucur: e.cdgSIISucur, DirOrigen: clean(e.direccion, 70), CmnaOrigen: clean(e.comuna, 20) },
        Receptor: { RUTRecep: '66666666-6' },
        Totales: { MntNeto: neto, IVA: total - neto, MntTotal: total, TotalPeriodo: total, VlrPagar: total },
      },
      Detalle: detalle,
    },
  };

  const base = HAULMER[fiscal.ambiente] || HAULMER.pruebas;
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  let r = await call({ method: 'POST', url: base + '/v2/dte/document', headers: Object.assign({ 'Idempotency-Key': `holu-${rid}-${ticketId}` }, headers), body: dte });
  let b = r.body || {};
  let tk = b.TOKEN, folio = b.FOLIO, resolucion = b.RESOLUCION;
  if (r.statusCode === 400 && b.error && b.error.code === 'OF-06') {
    // Ya se había emitido (reintento): el proveedor devuelve el token del original.
    const det = (b.error.details || []).find((x) => x.field === 'token');
    tk = det && det.issue;
    if (tk) { folio = await recoverFolio(base, tk); r = { statusCode: 200 }; }
  }
  if (r.statusCode === 200 && tk) {
    const saved = await save(39, 'emitida', { folio: folio != null ? Number(folio) : null, token: tk, resolucion, ambiente: fiscal.ambiente });
    return done(200, { resultado: 'emitida', folio: saved && saved.folio != null ? saved.folio : (folio != null ? Number(folio) : null) });
  }
  const msg = errMsg(r, 'No se pudo emitir la boleta');
  await save(39, 'error', { error: msg, ambiente: fiscal.ambiente });
  return done(200, { resultado: 'error', error: msg });
}

// ── anular (nota de crédito, tipo 61) ───────────────────────────────────────
if (action === 'anular') {
  if (nota && nota.estado === 'emitida') return done(200, { resultado: 'ya_anulada', folio: nota.folio });
  if (!boleta || boleta.estado !== 'emitida' || !boleta.token) return done(200, { resultado: 'sin_boleta' });
  if (!fiscal || !fiscal.conectado || !key || !fiscal.emisor) {
    return done(200, { resultado: 'error', error: 'La facturación electrónica no está activa: no se puede emitir la nota de crédito' });
  }
  const base = HAULMER[boleta.ambiente || fiscal.ambiente] || HAULMER.pruebas;
  const headers = { apikey: key, 'Content-Type': 'application/json' };

  // La nota de crédito copia la boleta emitida (los montos de la nota van en neto, sin IVA).
  const j = await call({ method: 'GET', url: `${base}/v2/dte/document/${encodeURIComponent(boleta.token)}/json`, headers: { apikey: key } });
  const orig = j.body && j.body.json;
  if (j.statusCode !== 200 || !orig || !orig.Detalle || !orig.Encabezado) {
    return done(200, { resultado: 'error', error: 'No se pudo leer la boleta original en el proveedor' });
  }
  const total = Math.round(Number(orig.Encabezado.Totales && orig.Encabezado.Totales.MntTotal) || 0);
  if (total <= 0) return done(200, { resultado: 'error', error: 'La boleta original no tiene monto' });
  const neto = Math.round(total / 1.19);
  const brutos = orig.Detalle.map((l) => Math.max(0, Math.round(Number(l.MontoItem) || 0)));
  const sumaB = brutos.reduce((s, x) => s + x, 0) || 1;
  const exact = brutos.map((x) => neto * (x / sumaB));
  const nets = exact.map((x) => Math.floor(x));
  let rest = neto - nets.reduce((s, x) => s + x, 0);
  exact.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { nets[i] += 1; rest -= 1; } });
  const detalle = orig.Detalle.map((l, i) => {
    let qty = Number(l.QtyItem) || 1, name = clean(l.NmbItem, 80) || 'Producto', und = l.UnmdItem || null;
    let prc = Math.round(nets[i] / qty);
    if (Math.round(qty * prc) !== nets[i]) { name = clean(`${name} x ${qty}${und ? ' ' + String(und).toLowerCase() : ''}`, 80); qty = 1; prc = nets[i]; und = null; }
    const row = { NroLinDet: i + 1, NmbItem: name, QtyItem: qty, PrcItem: prc, MontoItem: nets[i] };
    if (und) row.UnmdItem = und;
    return row;
  });
  const hoy = hoyCL();
  const fchRef = (orig.Encabezado.IdDoc && orig.Encabezado.IdDoc.FchEmis) || hoy;
  const e = fiscal.emisor;
  const acteco = (Array.isArray(e.actividades) && (e.actividades.find((a) => a.principal) || e.actividades[0]) || {}).codigo;
  const dte = {
    response: ['FOLIO', 'RESOLUCION'],
    dte: {
      Encabezado: {
        IdDoc: { TipoDTE: 61, Folio: 0, FchEmis: hoy },
        Emisor: { RUTEmisor: e.rut, RznSoc: clean(e.razonSocial, 100), GiroEmis: clean(e.giro, 80), Acteco: acteco, DirOrigen: clean(e.direccion, 70), CmnaOrigen: clean(e.comuna, 20), CdgSIISucur: e.cdgSIISucur },
        Receptor: { RUTRecep: '66666666-6', RznSocRecep: 'Consumidor final', GiroRecep: 'Particular', DirRecep: 'Sin direccion', CmnaRecep: clean(e.comuna, 20) || 'Santiago' },
        Totales: { MntNeto: neto, TasaIVA: '19', IVA: total - neto, MntTotal: total },
      },
      Detalle: detalle,
      Referencia: [{ NroLinRef: 1, TpoDocRef: '39', FolioRef: String(boleta.folio), FchRef: fchRef, CodRef: 1, RazonRef: 'Anula boleta' }],
    },
  };
  let r = await call({ method: 'POST', url: base + '/v2/dte/document', headers: Object.assign({ 'Idempotency-Key': `holu-nc-${rid}-${ticketId}` }, headers), body: dte });
  let b = r.body || {};
  let tk = b.TOKEN, folio = b.FOLIO, resolucion = b.RESOLUCION;
  if (r.statusCode === 400 && b.error && b.error.code === 'OF-06') {
    const det = (b.error.details || []).find((x) => x.field === 'token');
    tk = det && det.issue;
    if (tk) {
      await sleep(600);
      const s = await call({ method: 'GET', url: `${base}/v2/dte/document/${tk}/status`, headers: { apikey: key } });
      folio = s.body && s.body.folio;
      r = { statusCode: 200 };
    }
  }
  if (r.statusCode === 200 && tk) {
    const saved = await save(61, 'emitida', { folio: folio != null ? Number(folio) : null, token: tk, resolucion, ambiente: boleta.ambiente || fiscal.ambiente });
    return done(200, { resultado: 'emitida', folio: saved && saved.folio != null ? saved.folio : (folio != null ? Number(folio) : null) });
  }
  const msg = errMsg(r, 'No se pudo emitir la nota de crédito');
  await save(61, 'error', { error: msg, ambiente: boleta.ambiente || fiscal.ambiente });
  return done(200, { resultado: 'error', error: msg });
}

return done(400, { resultado: 'error', error: 'Acción no válida' });
