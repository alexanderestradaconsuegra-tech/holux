// Videos 2-4 (panel): camarero toma pedidos, cocina y caja. Uso: node panel-videos.cjs [camarero|cocina|caja]
// Necesita el panel en :5198 (`VITE_FORCE_VIEW=admin npx vite --port 5198`) y la landing en :3111 (ilustraciones).
const { record, compose, json, fakeJwt } = require('./lib.cjs');
const M = (id, category, name, subtitle, price, extra = {}) => ({ id, restaurant_id: 'demo', category, name, subtitle, description: null, price, avg_prep_minutes: 12, kcal: null, tags: [], allergens: [], wine_pair: null, image_url: null, stock_status: 'OK', available: true, visible_client: true, sort_order: 1, ...extra });
const MENU = [M('d1', 'Entradas', 'Ceviche de reineta', 'Cítricos', 9900), M('d2', 'Entradas', 'Empanada de pino', 'Horno de barro', 4500), M('d4', 'Principales', 'Lomo a lo pobre', 'Papas', 15900), M('d6', 'Principales', 'Pastel de choclo', 'En greda', 13900), M('d9', 'Postres', 'Leche asada', 'Caramelo', 5500), M('b1', 'Bebidas', 'Pisco sour', 'Pisco 35', 6900)];
const T = (id, n, extra = {}) => ({ id, restaurant_id: 'demo', table_number: n, label: `Mesa ${n}`, zone: 'Salón', qr_token: `DEMO-T${n}`, status: 'Libre', guests: 0, waiter_id: null, bill_total: 0, tip_accepted: false, tip_amount: 0, active: true, ...extra });
const O = (id, table, status, items, notes = null, mins = 3) => ({ id, restaurant_id: 'demo', table_id: table, waiter_id: null, status, priority: 'Normal', channel: 'QR Mesa', eta_minutes: 15, notes, total: items.reduce((s, i) => s + i[1] * i[2], 0), created_at: new Date(Date.now() - mins * 60000).toISOString(), order_items: items.map((i, k) => ({ id: k, dish_name: i[0], qty: i[2], unit_price: i[1], status: 'pending' })) });

function state0() {
  return {
    tables: [T(1, 1, { status: 'Comiendo', guests: 3, bill_total: 28400 }), T(2, 2, { status: 'Esperando plato', guests: 2, bill_total: 54100 }), T(3, 3), T(4, 4, { status: 'Solicita cobro', guests: 4, bill_total: 68400 }), T(5, 5)],
    orders: [O('ORD-7c1e04a2', 1, 'received', [['Lomo a lo pobre', 15900, 1], ['Pisco sour', 6900, 2]], 'Lomo bien cocido', 2), O('ORD-3b9d52f0', 4, 'received', [['Pastel de choclo', 13900, 2], ['Empanada de pino', 4500, 2]], null, 1), O('ORD-91a6e7d5', 2, 'prep', [['Ceviche de reineta', 9900, 2]], 'Sin cebolla', 6)],
    cashOpen: false, cash: { cash_total: 0, card_total: 0, transfer_total: 0, tips_total: 0, expenses_total: 0, opening_cash: 0 },
  };
}
const session = (st) => ({ id: 'CASH-1', status: 'open', turn: 'Noche', opened_at: new Date(Date.now() - 3600e3).toISOString(), ...st.cash });

async function ctxSetup(ctx, role, st, staffId) {
  const tok = fakeJwt(role, staffId);
  await ctx.addInitScript(([j, r, id, nm]) => {
    localStorage.setItem('holu:session', JSON.stringify({ access_token: j, refresh_token: 'r', restaurant_id: 'demo', email: 'demo@holu.pro', expires_at: Date.now() + 7200e3 }));
    sessionStorage.setItem('holu:staff', JSON.stringify({ id, name: nm, role: r }));
  }, [tok, role, staffId || 'a1', role === 'cocina' ? 'Chef Roberto' : role === 'camarero' ? 'Isabella Ruiz' : 'Valentina Cruz']);
  await ctx.route(/fonts\.g|n8n-n8n.*holu-dte/, (r) => r.request().url().includes('holu-dte') ? r.fulfill(json({ resultado: 'omitida' })) : r.abort());
  await ctx.route('**/*.supabase.co/**', async (route) => {
    const req = route.request(); const u = req.url(); const m = req.method();
    if (u.includes('/rpc/staff_create_order')) {
      const b = req.postDataJSON(); const total = b.p_items.reduce((s, i) => s + MENU.find((x) => x.id === i.menu_item_id).price * i.qty, 0);
      let tid = b.p_table_id; if (tid == null) { tid = 77; if (!st.tables.some((t) => t.id === 77)) st.tables.push(T(77, 9, { label: 'Mostrador', zone: 'Mostrador' })); }
      st.tables = st.tables.map((t) => t.id === tid ? { ...t, status: 'Pedido nuevo', bill_total: (t.bill_total || 0) + total } : t);
      st.orders.unshift(O('ORD-' + Math.random().toString(16).slice(2, 10), tid, 'received', b.p_items.map((i) => { const d = MENU.find((x) => x.id === i.menu_item_id); return [d.name, d.price, i.qty]; }), b.p_items.map((i) => i.note).filter(Boolean).join(' | ') || null, 0));
      return route.fulfill(json({ order_id: 'ORD-1a2b3c4d', table_id: tid, table_label: st.tables.find((t) => t.id === tid).label, total }));
    }
    if (u.includes('/rpc/table_bill_status')) { const t = st.tables.find((x) => x.id === +JSON.parse(req.postData()).p_table_id); return route.fulfill(json([{ bill: t.bill_total, paid: 0, remaining: t.bill_total, tip_paid: 0 }])); }
    if (u.includes('/rpc/pay_table_part')) { const b = req.postDataJSON(); const t = st.tables.find((x) => x.id === b.p_table_id); if (b.p_method === 'Tarjeta') st.cash.card_total += b.p_amount; else if (b.p_method === 'Efectivo') st.cash.cash_total += b.p_amount; else st.cash.transfer_total += b.p_amount; st.cash.tips_total += b.p_tip || 0; t.bill_total = 0; t.status = 'Libre'; st.orders = st.orders.filter((o) => o.table_id !== t.id); return route.fulfill(json([{ paid: b.p_amount, remaining: 0, settled: true, ticket_id: 'TK-1' }])); }
    if (u.includes('/rpc/cash_session_expected')) return route.fulfill(json(st.cash.opening_cash + st.cash.cash_total));
    if (u.includes('/rest/v1/cash_sessions')) { if (m === 'POST') { const b = req.postDataJSON(); st.cashOpen = true; st.cash.opening_cash = b.opening_cash || 0; return route.fulfill(json([session(st)])); } return route.fulfill(json(st.cashOpen ? [session(st)] : [])); }
    if (u.includes('/rest/v1/orders')) {
      if (m === 'PATCH') { const id = (u.match(/id=eq\.([^&]+)/) || [])[1]; const b = req.postDataJSON(); st.orders = st.orders.map((o) => o.id === id ? { ...o, status: b.status || o.status } : o); return route.fulfill(json([])); }
      if (u.includes('paid_at=is.null')) { const tid = +(u.match(/table_id=eq\.(\d+)/) || [])[1]; return route.fulfill(json(st.orders.filter((o) => o.table_id === tid))); }
      return route.fulfill(json(st.orders));
    }
    if (u.includes('/rest/v1/tables')) { const mm = u.match(/[?&]id=eq\.(\d+)/); if (m === 'PATCH') return route.fulfill(json([])); return route.fulfill(json(mm ? st.tables.filter((t) => t.id === +mm[1]) : st.tables)); }
    if (u.includes('/rest/v1/menu_items')) return route.fulfill(json(MENU));
    if (u.includes('/rest/v1/restaurants')) return route.fulfill(json([{ name: 'Restaurante Demo', email_verified_at: '2026-01-01T00:00:00Z', settings: {}, activated_at: '2026-01-01T00:00:00Z', trial_ends_at: '2027-01-01T00:00:00Z' }]));
    if (u.includes('/rest/v1/staff')) return route.fulfill(json([{ id: 'a1', name: 'Valentina Cruz', role: 'admin', shift: 'Full', status: 'Activo' }, { id: 's2', name: 'Isabella Ruiz', role: 'camarero', shift: 'Noche', status: 'Activo' }, { id: 's3', name: 'Chef Roberto', role: 'cocina', shift: 'Full', status: 'Activo' }]));
    return route.fulfill(json([]));
  });
}
const nav = (page, label) => page.locator('.side button, nav button, aside button, .sidebar button, .nav button, button').filter({ hasText: new RegExp(`^${label}$`) }).first().click();

const SCENES = {
  camarero: async (page, cap, sleep) => {
    await page.goto('http://127.0.0.1:5198/', { waitUntil: 'load' }); await sleep(1.2);
    await nav(page, 'Mesas'); await page.waitForSelector('.table-card');
    cap('Elige la mesa del cliente'); await sleep(2.6);
    await page.locator('.table-card', { hasText: 'Mesa 3' }).getByRole('button', { name: 'Tomar pedido' }).click(); await page.waitForSelector('.modal');
    cap('Toca los platos que pidió'); await sleep(1.2);
    for (const n of ['Ceviche de reineta', 'Ceviche de reineta', 'Lomo a lo pobre', 'Pisco sour']) { await page.getByRole('button', { name: `Agregar ${n}` }).click(); await sleep(0.8); }
    cap('Agrega una nota para cocina'); await page.getByLabel('Nota para Ceviche de reineta').click(); await page.keyboard.type('Sin cebolla', { delay: 80 }); await sleep(1.4);
    cap('Envíalo a cocina: el precio lo calcula el sistema'); await sleep(2.2);
    await page.getByRole('button', { name: /Enviar a cocina/ }).click(); await page.waitForSelector('text=Pedido enviado a cocina');
    cap('Listo: la cocina ya lo está viendo'); await sleep(3);
    await page.getByRole('button', { name: 'Listo' }).click(); await sleep(0.8);
    cap('¿Cliente sin mesa? Vende en el mostrador'); await page.getByRole('button', { name: 'Venta de mostrador' }).click(); await page.waitForSelector('.modal'); await sleep(1.4);
    await page.getByRole('button', { name: 'Agregar Empanada de pino' }).click(); await sleep(0.7); await page.getByRole('button', { name: 'Agregar Pisco sour' }).click(); await sleep(1.2);
    await page.getByRole('button', { name: /Enviar a cocina/ }).click(); await page.waitForSelector('text=Pedido enviado a cocina');
    cap('Y cóbralo en el momento'); await sleep(3);
  },
  cocina: async (page, cap, sleep) => {
    await page.goto('http://127.0.0.1:5198/', { waitUntil: 'load' }); await page.waitForSelector('.kitchen-ticket'); await sleep(0.8);
    cap('Los pedidos llegan a la pantalla de cocina'); await sleep(3);
    cap('Con las notas de cada plato'); await sleep(2.6);
    cap('Marca "Preparando" y la mesa ve el avance');
    await page.locator('.kitchen-ticket', { hasText: 'ORD-7c1e04a2' }).getByRole('button', { name: 'Preparando' }).click(); await sleep(2.6);
    await page.locator('.kitchen-ticket', { hasText: 'ORD-3b9d52f0' }).getByRole('button', { name: 'Preparando' }).click(); await sleep(1.2);
    cap('Cuando está listo, se avisa al camarero');
    await page.locator('.kitchen-ticket', { hasText: 'ORD-91a6e7d5' }).getByRole('button', { name: 'Listo para servir' }).click(); await sleep(3.6);
  },
  caja: async (page, cap, sleep) => {
    await page.goto('http://127.0.0.1:5198/', { waitUntil: 'load' }); await sleep(1);
    await nav(page, 'Caja'); await page.waitForSelector('text=Fondo inicial', { state: 'attached' });
    cap('Abre la caja con el fondo inicial'); await sleep(1.4);
    await page.fill('input[placeholder="Fondo inicial"]', '20000'); await sleep(1);
    await page.getByRole('button', { name: 'Abrir caja' }).first().click(); await sleep(2.2);
    await nav(page, 'Mesas'); await page.waitForSelector('.table-card'); await sleep(0.8);
    cap('Cuando el cliente pide la cuenta, cóbrala');
    await page.locator('.table-card', { hasText: 'Mesa 4' }).getByRole('button', { name: 'Atender' }).click(); await sleep(1.4);
    await page.getByRole('button', { name: /Cobrar mesa/ }).click(); await page.waitForSelector('.modal'); await sleep(1.6);
    cap('Propina y medio de pago: efectivo, tarjeta o transferencia');
    await page.locator('.modal button', { hasText: /^\+ \$/ }).first().click().catch(() => {}); await sleep(1);
    await page.locator('.modal button', { hasText: 'Tarjeta' }).first().click(); await sleep(2);
    cap('¿Pagan varios? Divide la cuenta');
    await page.getByRole('button', { name: 'Dividir la cuenta' }).click(); await sleep(2.8);
    await page.getByRole('button', { name: 'Dividir la cuenta' }).click().catch(() => {}); await sleep(0.8);
    cap('Cobra y la mesa queda libre');
    await page.locator('.modal button.primary, .modal .btn.primary').last().click(); await sleep(3);
    await nav(page, 'Caja'); await sleep(0.6);
    cap('Todo queda en la caja del turno, con su cuadre'); await sleep(4);
  },
};

(async () => {
  const which = process.argv[2] ? [process.argv[2]] : ['camarero', 'cocina', 'caja'];
  for (const k of which) {
    const st = state0();
    const role = k === 'cocina' ? 'cocina' : k === 'camarero' ? 'admin' : 'admin';
    const r = await record({ name: k, viewport: { width: 1280, height: 680 }, setupContext: (ctx) => ctxSetup(ctx, role, st, role === 'cocina' ? 's3' : 'a1'), scene: SCENES[k] });
    console.log(k, 'grabado', r.total.toFixed(1) + 's');
    console.log(compose({ name: k, webm: r.webm, caps: r.caps, layout: 'wide' }));
  }
})().catch((e) => { console.error('ERR', e.message.slice(0, 500)); process.exit(1); });
