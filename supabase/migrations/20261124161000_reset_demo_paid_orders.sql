-- Ventas ahora cuenta solo lo cobrado (orders.paid_at). El demo no tenía
-- ninguna mesa cobrada — sus pedidos "served" son platos entregados en mesas
-- que todavía están comiendo — así que la pestaña Ventas del demo quedaba en
-- $0. Se agregan dos mesas ya cobradas hoy (Mesa 3 y Mesa 5, que siguen
-- libres) para que el demo muestre ventas reales. El resto de reset_demo()
-- queda igual.
create or replace function public.reset_demo()
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  t1 int; t2 int; t3 int; t4 int; t5 int;
  w_marco uuid; w_isa uuid;
begin
  delete from deliveries        where restaurant_id = 'demo';
  delete from delivery_requests where restaurant_id = 'demo';
  delete from table_payments    where restaurant_id = 'demo';
  delete from inventory_movements where restaurant_id = 'demo';
  delete from order_items where order_id in (select id from orders where restaurant_id = 'demo');
  delete from orders        where restaurant_id = 'demo';
  delete from calls         where restaurant_id = 'demo';
  delete from reviews       where restaurant_id = 'demo';
  delete from sessions      where restaurant_id = 'demo';
  delete from cash_movements where restaurant_id = 'demo';
  delete from cash_sessions where restaurant_id = 'demo';
  delete from expenses      where restaurant_id = 'demo';
  delete from inventory     where restaurant_id = 'demo';
  delete from menu_items    where restaurant_id = 'demo';
  delete from tables        where restaurant_id = 'demo';
  delete from staff         where restaurant_id = 'demo';

  insert into staff (restaurant_id, name, email, role, shift, status, pin_hash) values
    ('demo','Valentina Cruz','valentina@demo.cl','admin',   'Full',        'Activo', crypt('4321', gen_salt('bf', 10))),
    ('demo','Marco Ferrán',  'marco@demo.cl',    'camarero','18:00–00:00', 'Activo', crypt('1122', gen_salt('bf', 10))),
    ('demo','Isabella Ruiz', 'isabella@demo.cl', 'camarero','18:00–00:00', 'Activo', crypt('3344', gen_salt('bf', 10))),
    ('demo','Chef Roberto',  'roberto@demo.cl',  'cocina',  'Full',        'Activo', crypt('5566', gen_salt('bf', 10))),
    ('demo','Ana Soto',      'ana@demo.cl',      'caja',    'Full',        'Activo', crypt('7788', gen_salt('bf', 10)));

  insert into tables (restaurant_id, table_number, label, zone, qr_token, status, guests, active, last_activity_at) values
    ('demo',1,'Mesa 1','Salón',  'DEMO-T1','Comiendo',        4, true, now()),
    ('demo',2,'Mesa 2','Salón',  'DEMO-T2','Esperando plato', 2, true, now()),
    ('demo',3,'Mesa 3','Terraza','DEMO-T3','Libre',           0, true, now()),
    ('demo',4,'Mesa 4','Terraza','DEMO-T4','Solicita cobro',  6, true, now()),
    ('demo',5,'Mesa 5','Salón',  'DEMO-T5','Libre',           0, true, now()),
    ('demo',6,'Barra', 'Barra',  'DEMO-BARRA','Libre',        0, true, now());

  insert into menu_items (id, restaurant_id, name, subtitle, category, price, avg_prep_minutes, stock_status, available, visible_client, tags, sort_order) values
    ('demo-d1','demo','Ceviche de reineta','Cítricos, cebolla morada y cilantro','Entradas',    9900, 10,'OK',  true,true,'{TOP}',1),
    ('demo-d2','demo','Empanada de pino',  'Masa casera, horno de barro',        'Entradas',    4500,  8,'OK',  true,true,'{}',2),
    ('demo-d3','demo','Machas a la parmesana','Gratinadas al horno',             'Entradas',   11900, 12,'Bajo',true,true,'{CHEF}',3),
    ('demo-d4','demo','Lomo a lo pobre',   'Papas fritas, cebolla y huevo',      'Principales',15900, 22,'OK',  true,true,'{TOP}',4),
    ('demo-d5','demo','Congrio frito',     'Ensalada chilena',                   'Principales',17900, 20,'OK',  true,true,'{}',5),
    ('demo-d6','demo','Pastel de choclo',  'En greda, con pino tradicional',     'Principales',13900, 25,'OK',  true,true,'{CHEF}',6),
    ('demo-d7','demo','Risotto de camarones','Parmesano y limón',                'Principales',16900, 24,'OK',  true,true,'{}',7),
    ('demo-d8','demo','Mote con huesillo', 'Postre tradicional',                 'Postres',     4900,  5,'OK',  true,true,'{}',8),
    ('demo-d9','demo','Leche asada',       'Caramelo natural',                   'Postres',     5500,  6,'OK',  true,true,'{TOP}',9),
    ('demo-b1','demo','Pisco sour',        'Pisco 35°, limón de pica',           'Bebidas',     6900,  5,'OK',  true,true,'{TOP}',10),
    ('demo-b2','demo','Cerveza artesanal', 'IPA local, 470cc',                   'Bebidas',     5900,  2,'OK',  true,true,'{}',11),
    ('demo-b3','demo','Limonada de menta', 'Jarra 1L',                           'Bebidas',     5500,  4,'OK',  true,true,'{}',12);

  insert into inventory (id, restaurant_id, name, category, stock, unit, min_stock, cost_price, linked_dishes) values
    ('demo-i1','demo','Reineta',     'Pescado',  12,'kg',        6, 8900, '{"Ceviche de reineta"}'),
    ('demo-i2','demo','Camarón',     'Mariscos',  4,'kg',        6,12900, '{"Risotto de camarones"}'),
    ('demo-i3','demo','Choclo',      'Verdura',  18,'kg',        8, 2200, '{"Pastel de choclo"}'),
    ('demo-i4','demo','Pisco 35°',   'Bar',       9,'botellas',  4, 7900, '{"Pisco sour"}'),
    ('demo-i5','demo','Cerveza IPA', 'Bar',      24,'botellas', 12, 2400, '{"Cerveza artesanal"}'),
    ('demo-i6','demo','Papas',       'Verdura',   3,'kg',       10, 1400, '{"Lomo a lo pobre"}');

  -- Must come after menu_items and inventory: recipe_items cascades from both.
  perform seed_demo_recipes();

  select id into t1 from tables where restaurant_id='demo' and table_number=1;
  select id into t2 from tables where restaurant_id='demo' and table_number=2;
  select id into t3 from tables where restaurant_id='demo' and table_number=3;
  select id into t4 from tables where restaurant_id='demo' and table_number=4;
  select id into t5 from tables where restaurant_id='demo' and table_number=5;
  select id into w_marco from staff where restaurant_id='demo' and name='Marco Ferrán';
  select id into w_isa   from staff where restaurant_id='demo' and name='Isabella Ruiz';

  insert into sessions (id, restaurant_id, table_id, qr_token, status) values
    ('DEMO-SES-1','demo',t1,'DEMO-T1','active'),
    ('DEMO-SES-2','demo',t2,'DEMO-T2','active'),
    ('DEMO-SES-4','demo',t4,'DEMO-T4','active');

  insert into orders (id, restaurant_id, session_id, table_id, waiter_id, status, channel, eta_minutes, total, created_at, paid_at) values
    ('DEMO-ORD-1','demo','DEMO-SES-1',t1,w_marco,'prep',    'QR Mesa', 12, 41700, now() - interval '9 minutes',  null),
    ('DEMO-ORD-2','demo','DEMO-SES-2',t2,w_isa,  'plating', 'QR Mesa',  2, 22800, now() - interval '18 minutes', null),
    ('DEMO-ORD-3','demo','DEMO-SES-4',t4,w_marco,'received','QR Mesa', 20, 55600, now() - interval '3 minutes',  null),
    ('DEMO-ORD-4','demo','DEMO-SES-1',t1,w_isa,  'served',  'QR Mesa',  0, 33800, now() - interval '3 hours',    null),
    ('DEMO-ORD-5','demo','DEMO-SES-2',t2,w_marco,'served',  'QR Mesa',  0, 31300, now() - interval '4 hours',    null),
    ('DEMO-ORD-6','demo','DEMO-SES-4',t4,w_isa,  'served','kiosco-barra',0,12800, now() - interval '2 hours',    null),
    -- Mesas que ya pagaron y se fueron: son las que alimentan la pestaña Ventas.
    ('DEMO-ORD-7','demo',null,        t3,w_marco,'served',  'QR Mesa',  0, 51100, now() - interval '2 hours 30 minutes', now() - interval '1 hour 50 minutes'),
    ('DEMO-ORD-8','demo',null,        t5,w_isa,  'served',  'QR Mesa',  0, 34600, now() - interval '1 hour 40 minutes',  now() - interval '55 minutes');

  insert into order_items (order_id, menu_item_id, dish_name, qty, unit_price) values
    ('DEMO-ORD-1','demo-d4','Lomo a lo pobre',      2,15900),
    ('DEMO-ORD-1','demo-b1','Pisco sour',           1, 6900),
    ('DEMO-ORD-1','demo-d2','Empanada de pino',     1, 4500),
    ('DEMO-ORD-2','demo-d6','Pastel de choclo',     1,13900),
    ('DEMO-ORD-2','demo-b2','Cerveza artesanal',    1, 5900),
    ('DEMO-ORD-2','demo-d2','Empanada de pino',     1, 4500),
    ('DEMO-ORD-3','demo-d5','Congrio frito',        2,17900),
    ('DEMO-ORD-3','demo-d1','Ceviche de reineta',   1, 9900),
    ('DEMO-ORD-3','demo-b3','Limonada de menta',    1, 5500),
    ('DEMO-ORD-3','demo-d8','Mote con huesillo',    1, 4900),
    ('DEMO-ORD-4','demo-d4','Lomo a lo pobre',      1,15900),
    ('DEMO-ORD-4','demo-d7','Risotto de camarones', 1,16900),
    ('DEMO-ORD-5','demo-d6','Pastel de choclo',     1,13900),
    ('DEMO-ORD-5','demo-d3','Machas a la parmesana',1,11900),
    ('DEMO-ORD-5','demo-b3','Limonada de menta',    1, 5500),
    ('DEMO-ORD-6','demo-b1','Pisco sour',           1, 6900),
    ('DEMO-ORD-6','demo-b2','Cerveza artesanal',    1, 5900),
    ('DEMO-ORD-7','demo-d4','Lomo a lo pobre',      2,15900),
    ('DEMO-ORD-7','demo-b1','Pisco sour',           2, 6900),
    ('DEMO-ORD-7','demo-d9','Leche asada',          1, 5500),
    ('DEMO-ORD-8','demo-d5','Congrio frito',        1,17900),
    ('DEMO-ORD-8','demo-b2','Cerveza artesanal',    2, 5900),
    ('DEMO-ORD-8','demo-d8','Mote con huesillo',    1, 4900);

  insert into calls (id, restaurant_id, table_id, waiter_id, source, call_type, priority, status, message, created_at) values
    ('DEMO-CALL-1','demo',t4,w_marco,'mesa','Solicita cobro','Alta',   'Pendiente',   'Queremos pedir la cuenta, por favor.',      now() - interval '2 minutes'),
    ('DEMO-CALL-2','demo',t2,w_isa,  'mesa','Alergia',       'Crítica','Pendiente',   'Uno de nosotros es intolerante a lácteos.', now() - interval '1 minute'),
    ('DEMO-CALL-3','demo',t1,w_marco,'mesa','Más pan',       'Normal', 'En atención', '¿Nos traen más pan?',                       now() - interval '6 minutes');

  insert into reviews (restaurant_id, session_id, table_id, waiter_id, rating, comment, source, created_at) values
    ('demo','DEMO-SES-1',t1,w_isa,  5,'Excelente atención, el pastel de choclo estaba perfecto.','table_qr', now() - interval '3 hours'),
    ('demo','DEMO-SES-2',t2,w_marco,5,'Muy rápido el pedido por QR, nos encantó.',               'table_qr', now() - interval '5 hours'),
    ('demo','DEMO-SES-4',t4,w_isa,  4,'Rica comida, faltó un poco de sazón en el congrio.',      'table_qr', now() - interval '1 day'),
    ('demo','DEMO-SES-1',t1,w_marco,3,'La bebida demoró bastante en llegar.',                   'table_qr', now() - interval '2 days');

  -- La caja del turno cuadra con las dos mesas cobradas: Mesa 3 en efectivo,
  -- Mesa 5 con tarjeta, 10% de propina en ambas y un gasto de proveedor.
  insert into cash_sessions (id, restaurant_id, turn, status, opening_cash, cash_total, card_total, transfer_total, tips_total, expenses_total, opened_at)
  values ('DEMO-CASH-1','demo','Noche','open', 50000, 51100, 34600, 0, 8570, 12000, now() - interval '5 hours');

  insert into table_payments (restaurant_id, table_id, cash_session_id, staff_id, amount, tip, method, settled_at, created_at) values
    ('demo', t3, 'DEMO-CASH-1', null, 51100, 5110, 'Efectivo', now() - interval '1 hour 50 minutes', now() - interval '1 hour 50 minutes'),
    ('demo', t5, 'DEMO-CASH-1', null, 34600, 3460, 'Tarjeta',  now() - interval '55 minutes',        now() - interval '55 minutes');

  insert into expenses (restaurant_id, cash_session_id, staff_id, expense_type, detail, amount, created_at)
  values ('demo', 'DEMO-CASH-1', null, 'Proveedor', 'Hielo y limones', 12000, now() - interval '4 hours');

  insert into cash_movements (restaurant_id, session_id, staff_id, action, detail, amount, created_at) values
    ('demo', 'DEMO-CASH-1', null, 'Abrió caja',       'Fondo inicial $50.000 · Turno Noche',          50000, now() - interval '5 hours'),
    ('demo', 'DEMO-CASH-1', null, 'Registró gasto',   'Hielo y limones · $12.000',                   -12000, now() - interval '4 hours'),
    ('demo', 'DEMO-CASH-1', null, 'Cobro registrado', 'Mesa 3 · $51.100 · Efectivo · propina $5.110', 51100, now() - interval '1 hour 50 minutes'),
    ('demo', 'DEMO-CASH-1', null, 'Cobro registrado', 'Mesa 5 · $34.600 · Tarjeta · propina $3.460',  34600, now() - interval '55 minutes');

  return 'demo restaurada';
end;
$function$;
