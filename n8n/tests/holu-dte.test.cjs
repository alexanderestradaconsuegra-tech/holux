// Prueba local del nodo Code de n8n/holu-dte.code.js con Supabase y Haulmer simulados.
//   node n8n/tests/holu-dte.test.cjs
// Ejecuta el código real (no una copia): lo envuelve en una función async igual
// que el nodo Code de n8n y le da $input, $env y this.helpers.httpRequest falsos.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const CODE = fs.readFileSync(path.join(__dirname, '..', 'holu-dte.code.js'), 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const RID = 'rest-a';
const TICKET = '11111111-1111-4111-8111-111111111111';
const hoyCL = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });

function makeWorld(over = {}) {
  const w = {
    users: {
      'tok-owner-aaaaaaaaaaaaaaaaaaaa': { id: 'u1', email: 'dueno@a.cl', user_metadata: { restaurant_id: RID } },
      'tok-waiter-aaaaaaaaaaaaaaaaaaa': { id: 'u2', email: 'staff.22222222-2222-4222-8222-222222222222@holu.internal', user_metadata: { restaurant_id: RID, staff_role: 'admin' } },
      // un mozo que se editó su propio user_metadata para decir que es admin de OTRO restaurante
      'tok-spoof-aaaaaaaaaaaaaaaaaaaa': { id: 'u3', email: 'staff.22222222-2222-4222-8222-222222222222@holu.internal', user_metadata: { restaurant_id: 'rest-b', staff_role: 'admin' } },
    },
    staff: [
      { id: '33333333-3333-4333-8333-333333333333', restaurant_id: RID, email: 'dueno@a.cl', role: 'admin', status: 'Activo' },
      { id: '22222222-2222-4222-8222-222222222222', restaurant_id: RID, email: null, role: 'camarero', status: 'Activo' },
    ],
    fiscal: { restaurant_id: RID, activo: true, ambiente: 'pruebas', medios: { efectivo: true, tarjeta: true, transferencia: true, mixto: true }, conectado: true, emisor: { rut: '76123456-7', razonSocial: 'Rest A SpA', giro: 'Restaurantes', direccion: 'Calle 1', comuna: 'Santiago', cdgSIISucur: '123', actividades: [{ giro: 'Restaurantes', codigo: '561000', principal: true }] } },
    apiKey: 'KEY-1234567890123456',
    ticket: { id: TICKET, restaurant_id: RID, total: 20000, tip: 2000, method_label: 'Tarjeta', settled_at: new Date().toISOString(), items: [{ name: 'Lomo', qty: 2, amount: 15000 }, { name: 'Pisco', qty: 1, amount: 5000 }] },
    docs: [],
    haulmer: [],      // llamadas hechas a Haulmer
    supaCalls: [],
    haulmerReply: null,
    ...over,
  };
  return w;
}

async function run(world, body) {
  const helpers = {
    httpRequest: async (o) => {
      const url = new URL(o.url);
      const reply = (statusCode, b) => ({ statusCode, body: b });
      // ---- Haulmer
      if (url.host.endsWith('haulmer.com')) {
        world.haulmer.push({ method: o.method, path: url.pathname, apikey: o.headers.apikey, idem: o.headers['Idempotency-Key'], body: o.body, host: url.host });
        if (world.haulmerReply) { const r = world.haulmerReply(o, url); if (r) return r; }
        if (url.pathname === '/v2/dte/organization') return reply(200, { rut: '76123456-7', razonSocial: 'Rest A SpA', actividades: [{ giro: 'Restaurantes', codigoActividadEconomica: '561000', actividadPrincipal: true }], direccion: 'Calle 1', comuna: 'Santiago', cdgSIISucur: '123' });
        if (url.pathname === '/v2/dte/document' && o.method === 'POST') return reply(200, { TOKEN: 'tok-' + o.body.dte.Encabezado.IdDoc.TipoDTE, FOLIO: o.body.dte.Encabezado.IdDoc.TipoDTE === 39 ? 501 : 77, RESOLUCION: { numero: 80 } });
        if (url.pathname.endsWith('/pdf')) return reply(200, { pdf: 'JVBERi0=' });
        if (url.pathname.endsWith('/json')) return reply(200, { json: { Encabezado: { IdDoc: { FchEmis: hoyCL }, Totales: { MntTotal: 20000 } }, Detalle: [{ MontoItem: 15000, NmbItem: 'Lomo', QtyItem: 2 }, { MontoItem: 5000, NmbItem: 'Pisco', QtyItem: 1 }] } });
        return reply(404, {});
      }
      // ---- Supabase
      world.supaCalls.push(`${o.method} ${url.pathname}${url.search}`);
      if (url.pathname === '/auth/v1/user') {
        const t = (o.headers.Authorization || '').replace('Bearer ', '');
        const u = world.users[t];
        return u ? reply(200, u) : reply(401, { msg: 'invalid' });
      }
      if (url.pathname === '/rest/v1/staff') {
        const q = url.searchParams;
        const get = (k) => (q.get(k) || '').replace(/^eq\./, '');
        const found = world.staff.filter((s) => (!q.get('id') || s.id === get('id')) && (!q.get('restaurant_id') || s.restaurant_id === get('restaurant_id'))
          && (!q.get('email') || s.email === get('email')) && (!q.get('role') || s.role === get('role')) && (!q.get('status') || s.status === get('status')));
        return reply(200, found);
      }
      if (url.pathname === '/rest/v1/restaurant_fiscal') {
        if (o.method === 'PATCH') { Object.assign(world.fiscal, o.body); return reply(204, ''); }
        return reply(200, world.fiscal && url.searchParams.get('restaurant_id') === 'eq.' + world.fiscal.restaurant_id ? [world.fiscal] : []);
      }
      if (url.pathname === '/rest/v1/table_tickets') {
        const ok = url.searchParams.get('id') === 'eq.' + world.ticket.id && url.searchParams.get('restaurant_id') === 'eq.' + world.ticket.restaurant_id;
        return reply(200, ok ? [world.ticket] : []);
      }
      if (url.pathname === '/rest/v1/fiscal_documents') {
        return reply(200, world.docs.filter((d) => url.searchParams.get('restaurant_id') === 'eq.' + d.restaurant_id));
      }
      if (url.pathname === '/rest/v1/rpc/fiscal_get_api_key') return reply(200, world.apiKey);
      if (url.pathname === '/rest/v1/rpc/fiscal_save_config') {
        world.savedConfig = o.body;
        return reply(200, [{ activo: o.body.p_activo, ambiente: o.body.p_ambiente, medios: o.body.p_medios, api_key_last4: o.body.p_api_key ? o.body.p_api_key.slice(-4) : null, conectado: false }]);
      }
      if (url.pathname === '/rest/v1/rpc/fiscal_save_document') {
        const a = o.body;
        const ex = world.docs.find((d) => d.ticket_id === a.p_ticket_id && d.tipo === a.p_tipo);
        if (ex && ex.estado === 'emitida') return reply(200, []);
        const d = { restaurant_id: a.p_restaurant_id, ticket_id: a.p_ticket_id, tipo: a.p_tipo, estado: a.p_estado, folio: a.p_folio, token: a.p_token, ambiente: a.p_ambiente, error: a.p_error };
        world.docs = world.docs.filter((x) => x !== ex).concat(d);
        return reply(200, [{ estado: d.estado, folio: d.folio }]);
      }
      return reply(404, {});
    },
  };
  const fn = new AsyncFunction('$input', '$env', CODE);
  const out = await fn.call({ helpers }, { first: () => ({ json: { body } }) }, { SUPABASE_SERVICE_ROLE_KEY: 'svc-key' });
  return out[0].json;
}

const OWNER = 'tok-owner-aaaaaaaaaaaaaaaaaaaa';
let n = 0, failed = 0;
async function t(name, fn) {
  n++;
  try { await fn(); console.log(`  ok  ${name}`); } catch (e) { failed++; console.log(`  FALLA ${name}\n      ${e.message}`); }
}

(async () => {
  console.log('Autenticación y permisos');
  await t('acción desconocida -> 400', async () => { const r = await run(makeWorld(), { access_token: OWNER, action: 'borrar_todo' }); assert.equal(r.http, 400); });
  await t('sin token -> 401', async () => { const r = await run(makeWorld(), { action: 'probar' }); assert.equal(r.http, 401); });
  await t('token inválido -> 401', async () => { const r = await run(makeWorld(), { access_token: 'x'.repeat(30), action: 'probar' }); assert.equal(r.http, 401); });
  await t('ticket_id mal formado -> 400', async () => { const r = await run(makeWorld(), { access_token: OWNER, action: 'emitir', ticket_id: "1' or '1'='1" }); assert.equal(r.http, 400); });
  await t('mozo (staff real sin rol admin) no configura', async () => {
    const w = makeWorld({ users: { 'tok-waiter-aaaaaaaaaaaaaaaaaaa': { id: 'u2', email: 'staff.22222222-2222-4222-8222-222222222222@holu.internal', user_metadata: { restaurant_id: RID, staff_role: 'admin' } } } });
    const r = await run(w, { access_token: 'tok-waiter-aaaaaaaaaaaaaaaaaaa', action: 'config_save', data: {} });
    assert.equal(r.http, 403, 'aunque su user_metadata diga admin, la base dice camarero');
  });
  await t('mozo SÍ puede emitir boleta', async () => {
    const w = makeWorld({ users: { 'tok-waiter-aaaaaaaaaaaaaaaaaaa': { id: 'u2', email: 'staff.22222222-2222-4222-8222-222222222222@holu.internal', user_metadata: { restaurant_id: RID } } } });
    const r = await run(w, { access_token: 'tok-waiter-aaaaaaaaaaaaaaaaaaa', action: 'emitir', ticket_id: TICKET });
    assert.equal(r.out.resultado, 'emitida');
  });
  await t('mozo no puede anular', async () => {
    const w = makeWorld({ users: { 'tok-waiter-aaaaaaaaaaaaaaaaaaa': { id: 'u2', email: 'staff.22222222-2222-4222-8222-222222222222@holu.internal', user_metadata: { restaurant_id: RID } } } });
    const r = await run(w, { access_token: 'tok-waiter-aaaaaaaaaaaaaaaaaaa', action: 'anular', ticket_id: TICKET });
    assert.equal(r.http, 403);
  });
  await t('usuario que se cambió el restaurant_id en su metadata queda fuera', async () => {
    const r = await run(makeWorld(), { access_token: 'tok-spoof-aaaaaaaaaaaaaaaaaaaa', action: 'emitir', ticket_id: TICKET });
    assert.equal(r.http, 403);
  });
  await t('un dueño no ve cobros de otro restaurante', async () => {
    const w = makeWorld({ ticket: { ...makeWorld().ticket, restaurant_id: 'rest-b' } });
    const r = await run(w, { access_token: OWNER, action: 'emitir', ticket_id: TICKET });
    assert.equal(r.out.error, 'El cobro no existe');
    assert.equal(w.haulmer.length, 0);
  });

  console.log('Configuración');
  await t('clave con formato raro se rechaza sin tocar la base', async () => {
    const w = makeWorld(); const r = await run(w, { access_token: OWNER, action: 'config_save', data: { api_key: "abc'; drop table" } });
    assert.equal(r.out.resultado, 'error'); assert.ok(!w.savedConfig);
  });
  await t('guarda config con clave nueva (solo manda lo saneado)', async () => {
    const w = makeWorld(); const r = await run(w, { access_token: OWNER, action: 'config_save', data: { activo: true, ambiente: 'produccion', medios: { efectivo: false }, api_key: 'KEY-NUEVA-12345678' } });
    assert.equal(r.out.resultado, 'ok');
    assert.equal(w.savedConfig.p_restaurant_id, RID);
    assert.equal(w.savedConfig.p_ambiente, 'produccion');
    assert.deepEqual(w.savedConfig.p_medios, { efectivo: false, tarjeta: true, transferencia: true, mixto: true });
    assert.equal(r.out.config.api_key_last4, '5678');
    assert.ok(!JSON.stringify(r.out).includes('KEY-NUEVA'), 'la clave no vuelve en la respuesta');
  });
  await t('ambiente inválido cae a pruebas', async () => {
    const w = makeWorld(); await run(w, { access_token: OWNER, action: 'config_save', data: { ambiente: 'hackeo' } });
    assert.equal(w.savedConfig.p_ambiente, 'pruebas');
  });
  await t('probar conexión ok guarda el emisor', async () => {
    const w = makeWorld({ fiscal: { ...makeWorld().fiscal, conectado: false, emisor: null } });
    const r = await run(w, { access_token: OWNER, action: 'probar' });
    assert.equal(r.out.resultado, 'ok'); assert.equal(r.out.emisor.rut, '76123456-7');
    assert.equal(w.fiscal.conectado, true); assert.equal(w.haulmer[0].host, 'dev-api.haulmer.com');
  });
  await t('probar con clave rechazada da mensaje claro', async () => {
    const w = makeWorld({ haulmerReply: () => ({ statusCode: 401, body: {} }) });
    const r = await run(w, { access_token: OWNER, action: 'probar' });
    assert.match(r.out.error, /no es válida para este ambiente \(pruebas\)/);
  });
  await t('probar sin clave guardada', async () => {
    const r = await run(makeWorld({ apiKey: null }), { access_token: OWNER, action: 'probar' });
    assert.match(r.out.error, /Primero guarda la clave/);
  });

  console.log('Emitir boleta');
  await t('camino feliz: payload DTE correcto', async () => {
    const w = makeWorld(); const r = await run(w, { access_token: OWNER, action: 'emitir', ticket_id: TICKET });
    assert.deepEqual(r.out, { resultado: 'emitida', folio: 501 });
    const h = w.haulmer.find((x) => x.method === 'POST');
    const enc = h.body.dte.Encabezado;
    assert.equal(enc.IdDoc.TipoDTE, 39); assert.equal(enc.IdDoc.FchEmis, hoyCL);
    assert.equal(enc.Totales.MntTotal, 20000); assert.equal(enc.Totales.MntNeto, 16807); assert.equal(enc.Totales.IVA, 3193);
    assert.equal(enc.Emisor.RUTEmisor, '76123456-7');
    assert.equal(h.idem, `holu-${RID}-${TICKET}`);
    assert.equal(h.apikey, 'KEY-1234567890123456');
    const lines = h.body.dte.Detalle;
    assert.equal(lines.reduce((s, l) => s + l.MontoItem, 0), 20000);
    assert.equal(lines[0].QtyItem * lines[0].PrcItem, lines[0].MontoItem);
    assert.equal(w.docs[0].estado, 'emitida'); assert.equal(w.docs[0].folio, 501);
  });
  await t('la propina NO entra a la boleta', async () => {
    const w = makeWorld(); await run(w, { access_token: OWNER, action: 'emitir', ticket_id: TICKET });
    assert.equal(w.haulmer.find((x) => x.method === 'POST').body.dte.Encabezado.Totales.MntTotal, 20000);
  });
  await t('si las líneas no suman el total, se prorratea y cuadra al peso', async () => {
    const w = makeWorld({ ticket: { ...makeWorld().ticket, total: 20001, items: [{ name: 'A', qty: 3, amount: 10000 }, { name: 'B', qty: 1, amount: 10000 }] } });
    await run(w, { access_token: OWNER, action: 'emitir', ticket_id: TICKET });
    const d = w.haulmer.find((x) => x.method === 'POST').body.dte;
    assert.equal(d.Detalle.reduce((s, l) => s + l.MontoItem, 0), 20001);
    assert.equal(d.Encabezado.Totales.MntTotal, 20001);
    for (const l of d.Detalle) assert.equal(Math.round(l.QtyItem * l.PrcItem), l.MontoItem);
  });
  await t('ticket sin líneas emite una sola línea "Consumo"', async () => {
    const w = makeWorld({ ticket: { ...makeWorld().ticket, items: [] } });
    await run(w, { access_token: OWNER, action: 'emitir', ticket_id: TICKET });
    const d = w.haulmer.find((x) => x.method === 'POST').body.dte;
    assert.equal(d.Detalle.length, 1); assert.equal(d.Detalle[0].NmbItem, 'Consumo');
  });
  await t('nombres con caracteres de control se limpian', async () => {
    const w = makeWorld({ ticket: { ...makeWorld().ticket, items: [{ name: 'Lomo\u0000\n<script>', qty: 1, amount: 20000 }] } });
    await run(w, { access_token: OWNER, action: 'emitir', ticket_id: TICKET });
    assert.ok(!/[\u0000-\u001f]/.test(w.haulmer.find((x) => x.method === 'POST').body.dte.Detalle[0].NmbItem));
  });
  await t('ya emitida: no vuelve a llamar al proveedor', async () => {
    const w = makeWorld(); w.docs.push({ restaurant_id: RID, ticket_id: TICKET, tipo: 39, estado: 'emitida', folio: 9, token: 't' });
    const r = await run(w, { access_token: OWNER, action: 'emitir', ticket_id: TICKET });
    assert.deepEqual(r.out, { resultado: 'ya_emitida', folio: 9 }); assert.equal(w.haulmer.length, 0);
  });
  await t('facturación inactiva -> omitida', async () => {
    const w = makeWorld({ fiscal: { ...makeWorld().fiscal, activo: false } });
    const r = await run(w, { access_token: OWNER, action: 'emitir', ticket_id: TICKET });
    assert.equal(r.out.resultado, 'omitida'); assert.equal(w.haulmer.length, 0);
  });
  await t('sin conexión probada -> omitida', async () => {
    const r = await run(makeWorld({ fiscal: { ...makeWorld().fiscal, conectado: false } }), { access_token: OWNER, action: 'emitir', ticket_id: TICKET });
    assert.equal(r.out.resultado, 'omitida');
  });
  await t('medio de pago sin boleta -> omitida', async () => {
    const w = makeWorld({ fiscal: { ...makeWorld().fiscal, medios: { efectivo: true, tarjeta: false, transferencia: true, mixto: true } } });
    const r = await run(w, { access_token: OWNER, action: 'emitir', ticket_id: TICKET });
    assert.equal(r.out.resultado, 'omitida'); assert.match(r.out.error, /medio de pago/);
  });
  await t('pago mixto respeta su propio interruptor', async () => {
    const w = makeWorld({ ticket: { ...makeWorld().ticket, method_label: 'Mixto' }, fiscal: { ...makeWorld().fiscal, medios: { efectivo: true, tarjeta: true, transferencia: true, mixto: false } } });
    assert.equal((await run(w, { access_token: OWNER, action: 'emitir', ticket_id: TICKET })).out.resultado, 'omitida');
  });
  await t('cobro de otro día -> omitida', async () => {
    const w = makeWorld({ ticket: { ...makeWorld().ticket, settled_at: new Date(Date.now() - 3 * 86400000).toISOString() } });
    const r = await run(w, { access_token: OWNER, action: 'emitir', ticket_id: TICKET });
    assert.equal(r.out.resultado, 'omitida'); assert.equal(w.haulmer.length, 0);
  });
  await t('reintento duplicado (OF-06): recupera el folio del original', async () => {
    const w = makeWorld({ haulmerReply: (o, url) => {
      if (url.pathname === '/v2/dte/document' && o.method === 'POST') return { statusCode: 400, body: { error: { code: 'OF-06', details: [{ field: 'token', issue: 'tok-previo' }] } } };
      if (url.pathname.endsWith('/status')) return { statusCode: 200, body: { folio: 444 } };
    } });
    const r = await run(w, { access_token: OWNER, action: 'emitir', ticket_id: TICKET });
    assert.deepEqual(r.out, { resultado: 'emitida', folio: 444 }); assert.equal(w.docs[0].token, 'tok-previo');
  });
  await t('error del proveedor: queda guardado como error y se informa', async () => {
    const w = makeWorld({ haulmerReply: (o, url) => (url.pathname === '/v2/dte/document' ? { statusCode: 400, body: { error: { message: 'Folios agotados', details: [{ field: 'caf', issue: 'sin folios' }] } } } : null) });
    const r = await run(w, { access_token: OWNER, action: 'emitir', ticket_id: TICKET });
    assert.equal(r.out.resultado, 'error'); assert.match(r.out.error, /Folios agotados/);
    assert.equal(w.docs[0].estado, 'error');
  });
  await t('reintentar después de un error y ahora sí emite', async () => {
    const w = makeWorld(); w.docs.push({ restaurant_id: RID, ticket_id: TICKET, tipo: 39, estado: 'error', error: 'x' });
    const r = await run(w, { access_token: OWNER, action: 'emitir', ticket_id: TICKET });
    assert.equal(r.out.resultado, 'emitida'); assert.equal(w.docs.find((d) => d.tipo === 39).estado, 'emitida');
  });
  await t('producción usa api.haulmer.com', async () => {
    const w = makeWorld({ fiscal: { ...makeWorld().fiscal, ambiente: 'produccion' } });
    await run(w, { access_token: OWNER, action: 'emitir', ticket_id: TICKET });
    assert.equal(w.haulmer.find((x) => x.method === 'POST').host, 'api.haulmer.com');
  });

  console.log('PDF y anulación');
  await t('pdf de una boleta emitida', async () => {
    const w = makeWorld(); w.docs.push({ restaurant_id: RID, ticket_id: TICKET, tipo: 39, estado: 'emitida', folio: 9, token: 'tok-9', ambiente: 'pruebas' });
    const r = await run(w, { access_token: OWNER, action: 'pdf', ticket_id: TICKET });
    assert.deepEqual(r.out, { resultado: 'ok', pdf: 'JVBERi0=', folio: 9 });
  });
  await t('pdf sin boleta emitida', async () => {
    const r = await run(makeWorld(), { access_token: OWNER, action: 'pdf', ticket_id: TICKET });
    assert.equal(r.out.resultado, 'error');
  });
  await t('anular emite nota de crédito en neto con referencia a la boleta', async () => {
    const w = makeWorld(); w.docs.push({ restaurant_id: RID, ticket_id: TICKET, tipo: 39, estado: 'emitida', folio: 501, token: 'tok-39', ambiente: 'pruebas' });
    const r = await run(w, { access_token: OWNER, action: 'anular', ticket_id: TICKET });
    assert.deepEqual(r.out, { resultado: 'emitida', folio: 77 });
    const d = w.haulmer.find((x) => x.method === 'POST').body.dte;
    assert.equal(d.Encabezado.IdDoc.TipoDTE, 61);
    assert.equal(d.Encabezado.Totales.MntNeto, 16807); assert.equal(d.Encabezado.Totales.MntTotal, 20000);
    assert.equal(d.Detalle.reduce((s, l) => s + l.MontoItem, 0), 16807, 'las líneas de la NC suman el neto');
    assert.equal(d.Referencia[0].FolioRef, '501'); assert.equal(d.Referencia[0].TpoDocRef, '39');
    assert.ok(w.docs.find((x) => x.tipo === 61 && x.estado === 'emitida'));
  });
  await t('anular dos veces no duplica la nota', async () => {
    const w = makeWorld(); w.docs.push({ restaurant_id: RID, ticket_id: TICKET, tipo: 39, estado: 'emitida', folio: 501, token: 't' }, { restaurant_id: RID, ticket_id: TICKET, tipo: 61, estado: 'emitida', folio: 77 });
    const r = await run(w, { access_token: OWNER, action: 'anular', ticket_id: TICKET });
    assert.equal(r.out.resultado, 'ya_anulada'); assert.equal(w.haulmer.length, 0);
  });
  await t('anular sin boleta -> sin_boleta', async () => {
    const r = await run(makeWorld(), { access_token: OWNER, action: 'anular', ticket_id: TICKET });
    assert.equal(r.out.resultado, 'sin_boleta');
  });

  console.log(`\n${n - failed}/${n} pruebas pasaron`);
  process.exit(failed ? 1 : 0);
})();
