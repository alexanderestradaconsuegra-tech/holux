// node n8n/tests/holu-aviso-fallos.test.cjs
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const CODE = fs.readFileSync(path.join(__dirname, '..', 'holu-aviso-fallos.code.js'), 'utf8');
const AF = Object.getPrototypeOf(async function () {}).constructor;

function mundo(env = {}) {
  const sd = {}; const wa = [];
  const helpers = { httpRequest: async (o) => { if (env.WA_FALLA) throw new Error('x'); wa.push(o); return {}; } };
  const run = async (evento) => {
    const fn = new AF('$input', '$env', '$getWorkflowStaticData', CODE);
    const out = await fn.call({ helpers }, { first: () => ({ json: evento }) }, env, () => sd);
    return out[0].json;
  };
  return { run, wa, sd };
}
const ev = (message, extra = {}) => ({ workflow: { id: 'wf1', name: 'HOLU - Delivery (MercadoPago Checkout)' }, execution: { id: '99', error: { message, node: { name: 'Insert Call1' } }, ...extra } });
let n = 0, fallas = 0;
const t = async (nombre, f) => { n++; try { await f(); console.log('  ok  ' + nombre); } catch (e) { fallas++; console.log('  FALLA ' + nombre + ': ' + e.message); } };

(async () => {
  await t('un error inesperado avisa, con flujo, nodo, error y enlace', async () => {
    const { run } = mundo({ N8N_PUBLIC_URL: 'https://n8n.x/' });
    const r = await run(ev('The value in the "JSON Body" field is not valid JSON'));
    assert.equal(r.sendable, 'yes');
    assert.match(r.text, /Flujo: HOLU - Delivery/); assert.match(r.text, /Nodo: Insert Call1/); assert.match(r.text, /not valid JSON/);
    assert.match(r.text, /https:\/\/n8n\.x\/workflow\/wf1\/executions\/99/);
    assert.equal(r.subject, 'HOLU: falló HOLU - Delivery (MercadoPago Checkout)');
  });
  for (const m of ['No autorizado [line 6]', 'QR inválido', 'Missing required field: name', 'El carrito está vacío', 'Plato no disponible: x', 'rating must be an integer between 1 and 5', 'Este restaurante todavía no configuró su MercadoPago para delivery.', 'Invalid email address'])
    await t('no avisa por rechazo esperado: ' + m.slice(0, 40), async () => assert.equal((await mundo().run(ev(m))).sendable, 'no'));
  await t('el mismo error no se repite en 30 min, otro error sí', async () => {
    const { run } = mundo();
    assert.equal((await run(ev('Supabase 500 boom'))).sendable, 'yes');
    const rep = await run(ev('Supabase 500 boom')); assert.equal(rep.sendable, 'no'); assert.equal(rep.motivo, 'repetido');
    assert.equal((await run(ev('Otro error distinto'))).sendable, 'yes');
  });
  await t('después de 30 min vuelve a avisar', async () => {
    const { run, sd } = mundo();
    await run(ev('boom')); for (const k in sd.enviados) sd.enviados[k] -= 31 * 60000;
    assert.equal((await run(ev('boom'))).sendable, 'yes');
  });
  await t('el HTML escapa el mensaje del error', async () => {
    const r = await mundo().run(ev('<script>alert(1)</script>'));
    assert.ok(!r.html.includes('<script>')); assert.ok(r.html.includes('&lt;script&gt;'));
  });
  await t('con Evolution configurado manda WhatsApp al 56992103974', async () => {
    const { run, wa } = mundo({ EVOLUTION_API_URL: 'https://evo.x/', EVOLUTION_API_KEY: 'k', EVOLUTION_ADMIN_INSTANCE: 'adm' });
    const r = await run(ev('boom')); assert.equal(r.whatsapp, 'enviado');
    assert.equal(wa[0].url, 'https://evo.x/message/sendText/adm'); assert.equal(wa[0].body.number, '56992103974');
  });
  await t('si el WhatsApp falla, el aviso por correo igual sale', async () => {
    const r = await mundo({ EVOLUTION_API_URL: 'https://evo.x', EVOLUTION_API_KEY: 'k', EVOLUTION_ADMIN_INSTANCE: 'adm', WA_FALLA: 1 }).run(ev('boom'));
    assert.equal(r.sendable, 'yes'); assert.equal(r.whatsapp, 'falló');
  });
  await t('sin Evolution configurado no intenta WhatsApp', async () => {
    const { run, wa } = mundo(); const r = await run(ev('boom'));
    assert.equal(r.whatsapp, 'no configurado'); assert.equal(wa.length, 0);
  });
  await t('un evento vacío no revienta', async () => assert.equal((await mundo().run({})).sendable, 'yes'));
  console.log(`\n${n - fallas}/${n} pruebas pasaron`); process.exit(fallas ? 1 : 0);
})();
