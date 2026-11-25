// Video 1: lo que ve y hace el cliente (carta de la mesa). Uso: node mesa-qr.cjs  (mesa en :5199, landing en :3111)
const { record, compose, json } = require('./lib.cjs');
const IMG = 'http://127.0.0.1:3111/platos/';
const M = (id, category, name, subtitle, price, img, extra = {}) => ({ id, restaurant_id: 'demo', category, name, subtitle, description: null, price, avg_prep_minutes: 12, kcal: null, tags: [], allergens: [], wine_pair: null, image_url: img ? `${IMG}${img}.svg` : null, stock_status: 'OK', available: true, visible_client: true, sort_order: 1, ...extra });
const MENU = [
  M('d1', 'Entradas', 'Ceviche de reineta', 'Cítricos, cebolla morada y cilantro', 9900, 'ceviche', { tags: ['TOP'], description: 'Reineta fresca marinada en jugo de limón de pica con cebolla morada, cilantro y ají. Se sirve frío.', allergens: ['Pescado'] }),
  M('d2', 'Entradas', 'Empanada de pino', 'Masa casera, horno de barro', 4500, 'empanada', { allergens: ['Gluten', 'Huevo'] }),
  M('d4', 'Principales', 'Lomo a lo pobre', 'Papas fritas, cebolla y huevo', 15900, 'lomo', { tags: ['TOP'], allergens: ['Huevo'] }),
  M('d6', 'Principales', 'Pastel de choclo', 'En greda, con pino tradicional', 13900, 'pastel', { tags: ['CHEF'], allergens: ['Huevo'] }),
  M('d9', 'Postres', 'Leche asada', 'Caramelo natural', 5500, 'leche', { tags: ['TOP'], allergens: ['Lácteos', 'Huevo'] }),
  M('b1', 'Bebidas', 'Pisco sour', 'Pisco 35°, limón de pica', 6900, 'pisco', { tags: ['TOP'], allergens: ['Huevo'] }),
  M('b3', 'Bebidas', 'Limonada de menta', 'Jarra 1L', 5500, 'limonada', { allergens: ['ninguno'] }),
];
(async () => {
  let sent = null;
  const r = await record({
    name: 'mesa-qr', viewport: { width: 430, height: 932 },
    setupContext: async (ctx) => {
      await ctx.route('**/*.supabase.co/**', (route) => {
        const u = route.request().url();
        if (u.includes('/rpc/resolve_qr')) return route.fulfill(json([{ table_id: 5, table_number: 2, label: 'Mesa 2', zone: 'Salón', restaurant_id: 'demo', active: true, restaurant_name: 'Restaurante Demo', concept: 'Cocina chilena de autor' }]));
        if (u.includes('/rpc/restaurant_public')) return route.fulfill(json([{ settings: {} }]));
        if (u.includes('/rpc/table_orders')) return route.fulfill(json(sent ? [{ id: 'ORD-4f2a91c3', status: 'prep', eta_minutes: 15, created_at: new Date().toISOString(), items: sent }] : []));
        if (u.includes('/rest/v1/menu_items')) return route.fulfill(json(MENU));
        return route.fulfill(json([]));
      });
      await ctx.route(/n8n-n8n.*order-create/, (route) => { const b = route.request().postDataJSON(); sent = b.items.map((i) => { const m = MENU.find((x) => x.id === i.menu_item_id); return { dish_name: m.name, qty: i.qty, unit_price: m.price }; }); route.fulfill(json({ ok: true, orderId: 'ORD-4f2a91c3' })); });
      await ctx.route(/fonts\.g/, (route) => route.abort());
    },
    scene: async (page, cap, sleep) => {
      await page.goto('http://127.0.0.1:5199/?qr=DEMO-T2', { waitUntil: 'load' });
      await page.waitForSelector('.hero h1');
      cap('El cliente escanea el QR de su mesa'); await sleep(3);
      await page.click('.hero .cta'); await page.waitForSelector('.dish');
      cap('Ve tu carta con fotos, por categoría'); await sleep(1.2);
      await page.evaluate(() => document.querySelector('.screen').scrollTo({ top: 420, behavior: 'smooth' })); await sleep(1.8);
      await page.evaluate(() => document.querySelector('.screen').scrollTo({ top: 0, behavior: 'smooth' })); await sleep(1.2);
      await page.click('.dish:has-text("Ceviche") .dish-body'); await page.waitForSelector('.sheet');
      cap('Toca un plato: detalle y alérgenos'); await sleep(3.2);
      cap('Agrega una nota para cocina');
      await page.click('.sheet textarea'); await page.keyboard.type('Sin cebolla, por favor', { delay: 70 }); await sleep(1);
      await page.click('.sheet .btn.primary'); await sleep(0.9);
      cap('Suma lo que quiera, con un toque');
      await page.click('.dish:has-text("Pisco sour") .add'); await sleep(1);
      await page.click('.dish:has-text("Empanada") .add'); await sleep(1.4);
      await page.click('.floating-cart'); await page.waitForSelector('.drawer.open');
      cap('Revisa y envía el pedido a cocina'); await sleep(3);
      await page.click('.drawer .btn.primary');
      cap('Se envía a cocina al instante');
      await page.waitForSelector('.status-card');
      cap('Y sigue su pedido en vivo'); await sleep(3.8);
    },
  });
  console.log('grabado', r.total.toFixed(1) + 's', r.caps.map((c) => `${c.start.toFixed(1)}-${c.end.toFixed(1)} ${c.text}`).join(' | '));
  console.log(compose({ name: 'mesa-qr', webm: r.webm, caps: r.caps, layout: 'phone' }));
})().catch((e) => { console.error('ERR', e.message.slice(0, 400)); process.exit(1); });
