-- Boleta electrónica (Tuu / Haulmer) para HOLU.
--
-- Mismo diseño que el módulo DTE de Merka POS: cada restaurante trae su propia
-- clave de API (nunca una compartida), se guarda cifrada, y la emisión pasa por
-- un workflow de n8n que habla con la API del proveedor. Acá vive la parte de
-- datos:
--   * table_tickets    : una fila por mesa cobrada (el "documento" que se boletea)
--   * restaurant_fiscal: configuración por restaurante (sin la clave)
--   * fiscal_documents : boletas (39) y notas de crédito (61) emitidas
--   * la clave API vive en Supabase Vault, solo legible con service_role

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Un ticket por cada mesa cobrada. Foto del consumo al momento de pagar:
--    después los pedidos pueden cambiar, pero la boleta sale de esto.
create table if not exists public.table_tickets (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   text not null references public.restaurants(id) on delete cascade,
  table_id        integer,
  label           text,
  total           integer not null check (total >= 0),   -- consumo con IVA, sin propina
  tip             integer not null default 0 check (tip >= 0),
  method_label    text not null,                         -- Efectivo | Tarjeta | Transferencia | Mixto
  items           jsonb not null default '[]'::jsonb,    -- [{name, qty, amount}]
  staff_id        uuid references public.staff(id) on delete set null,
  cash_session_id text,
  settled_at      timestamptz not null default now()
);

create index if not exists table_tickets_restaurant_settled_idx
  on public.table_tickets (restaurant_id, settled_at desc);

alter table public.table_tickets enable row level security;
drop policy if exists mt_table_tickets on public.table_tickets;
create policy mt_table_tickets on public.table_tickets
  for select to authenticated
  using (restaurant_id = get_user_restaurant_id());

revoke all on public.table_tickets from anon, authenticated;
grant select on public.table_tickets to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Configuración fiscal por restaurante. La clave API NO está acá.
create table if not exists public.restaurant_fiscal (
  restaurant_id  text primary key references public.restaurants(id) on delete cascade,
  activo         boolean not null default false,
  ambiente       text not null default 'pruebas' check (ambiente in ('pruebas', 'produccion')),
  medios         jsonb not null default '{"efectivo":true,"tarjeta":true,"transferencia":true,"mixto":true}'::jsonb,
  api_key_last4  text,
  conectado      boolean not null default false,
  conectado_at   timestamptz,
  emisor         jsonb,
  updated_at     timestamptz not null default now()
);

alter table public.restaurant_fiscal enable row level security;
drop policy if exists mt_restaurant_fiscal on public.restaurant_fiscal;
create policy mt_restaurant_fiscal on public.restaurant_fiscal
  for select to authenticated
  using (restaurant_id = get_user_restaurant_id());

revoke all on public.restaurant_fiscal from anon, authenticated;
grant select on public.restaurant_fiscal to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Documentos emitidos. El token del proveedor no se le entrega al panel.
create table if not exists public.fiscal_documents (
  id            bigserial primary key,
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  ticket_id     uuid not null references public.table_tickets(id) on delete cascade,
  tipo          integer not null check (tipo in (39, 61)),   -- 39 boleta, 61 nota de crédito
  estado        text not null check (estado in ('emitida', 'error')),
  folio         bigint,
  token         text,
  resolucion    jsonb,
  ambiente      text,
  error         text,
  intentos      integer not null default 1,
  emitido_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (restaurant_id, ticket_id, tipo)
);

create index if not exists fiscal_documents_ticket_idx on public.fiscal_documents (ticket_id);

alter table public.fiscal_documents enable row level security;
drop policy if exists mt_fiscal_documents on public.fiscal_documents;
create policy mt_fiscal_documents on public.fiscal_documents
  for select to authenticated
  using (restaurant_id = get_user_restaurant_id());

revoke all on public.fiscal_documents from anon, authenticated;
grant select (id, restaurant_id, ticket_id, tipo, estado, folio, error, ambiente, emitido_at, updated_at)
  on public.fiscal_documents to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Funciones que solo usa n8n (service_role). Ni el panel ni anon pueden
--    llamarlas: una clave de API de un restaurante no se lee ni se escribe
--    desde el navegador.

-- Guarda la configuración. Si llega una clave nueva se cifra en Vault y la
-- conexión queda como "sin probar"; cambiar de ambiente también obliga a
-- volver a probar (una clave de pruebas no sirve en producción).
create or replace function public.fiscal_save_config(
  p_restaurant_id text,
  p_activo        boolean,
  p_ambiente      text,
  p_medios        jsonb,
  p_api_key       text default null
)
returns table(activo boolean, ambiente text, medios jsonb, api_key_last4 text,
              conectado boolean, conectado_at timestamptz, emisor jsonb)
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
declare
  v_name   text := 'dte_key:' || p_restaurant_id;
  v_secret uuid;
  v_prev   text;
  v_new_key boolean := coalesce(trim(p_api_key), '') <> '';
begin
  if not exists (select 1 from restaurants where id = p_restaurant_id) then
    raise exception 'Restaurante no encontrado';
  end if;
  if p_ambiente not in ('pruebas', 'produccion') then
    raise exception 'Ambiente inválido';
  end if;

  if v_new_key then
    select id into v_secret from vault.secrets where name = v_name;
    if v_secret is null then
      perform vault.create_secret(trim(p_api_key), v_name, 'Clave API Tuu/Haulmer de ' || p_restaurant_id);
    else
      perform vault.update_secret(v_secret, trim(p_api_key));
    end if;
  end if;

  select rf.ambiente into v_prev from restaurant_fiscal rf where rf.restaurant_id = p_restaurant_id;

  insert into restaurant_fiscal as rf (restaurant_id, activo, ambiente, medios, api_key_last4, conectado, updated_at)
  values (p_restaurant_id, coalesce(p_activo, false), p_ambiente,
          coalesce(p_medios, '{"efectivo":true,"tarjeta":true,"transferencia":true,"mixto":true}'::jsonb),
          case when v_new_key then right(trim(p_api_key), 4) end, false, now())
  on conflict (restaurant_id) do update set
    activo        = coalesce(p_activo, rf.activo),
    ambiente      = p_ambiente,
    medios        = coalesce(p_medios, rf.medios),
    api_key_last4 = case when v_new_key then right(trim(p_api_key), 4) else rf.api_key_last4 end,
    conectado     = case when v_new_key or (v_prev is not null and v_prev <> p_ambiente) then false else rf.conectado end,
    conectado_at  = case when v_new_key or (v_prev is not null and v_prev <> p_ambiente) then null  else rf.conectado_at end,
    emisor        = case when v_new_key or (v_prev is not null and v_prev <> p_ambiente) then null  else rf.emisor end,
    updated_at    = now();

  return query
    select rf.activo, rf.ambiente, rf.medios, rf.api_key_last4, rf.conectado, rf.conectado_at, rf.emisor
      from restaurant_fiscal rf where rf.restaurant_id = p_restaurant_id;
end;
$function$;

-- La clave descifrada, solo para armar la llamada al proveedor.
create or replace function public.fiscal_get_api_key(p_restaurant_id text)
returns text
language sql
stable
security definer
set search_path to 'public', 'vault'
as $function$
  select ds.decrypted_secret
    from vault.decrypted_secrets ds
   where ds.name = 'dte_key:' || p_restaurant_id
   limit 1;
$function$;

-- Registra la emisión. Un documento ya emitido nunca se pisa: un reintento o
-- un doble clic no puede convertir una boleta válida en "error" ni cambiar su
-- folio.
create or replace function public.fiscal_save_document(
  p_restaurant_id text,
  p_ticket_id     uuid,
  p_tipo          integer,
  p_estado        text,
  p_folio         bigint,
  p_token         text,
  p_resolucion    jsonb,
  p_ambiente      text,
  p_error         text
)
returns table(estado text, folio bigint)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_estado not in ('emitida', 'error') then
    raise exception 'Estado inválido';
  end if;
  if not exists (select 1 from table_tickets t where t.id = p_ticket_id and t.restaurant_id = p_restaurant_id) then
    raise exception 'Ticket no encontrado';
  end if;

  return query
  insert into fiscal_documents as d (restaurant_id, ticket_id, tipo, estado, folio, token, resolucion, ambiente, error, intentos, emitido_at)
  values (p_restaurant_id, p_ticket_id, p_tipo, p_estado, p_folio, p_token, p_resolucion, p_ambiente,
          p_error, 1, case when p_estado = 'emitida' then now() end)
  on conflict (restaurant_id, ticket_id, tipo) do update set
    estado     = excluded.estado,
    folio      = coalesce(excluded.folio, d.folio),
    token      = coalesce(excluded.token, d.token),
    resolucion = coalesce(excluded.resolucion, d.resolucion),
    ambiente   = coalesce(excluded.ambiente, d.ambiente),
    error      = excluded.error,
    intentos   = d.intentos + 1,
    emitido_at = coalesce(d.emitido_at, excluded.emitido_at),
    updated_at = now()
  where d.estado <> 'emitida'
  returning d.estado, d.folio;
end;
$function$;

revoke all on function public.fiscal_save_config(text, boolean, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.fiscal_get_api_key(text)                              from public, anon, authenticated;
revoke all on function public.fiscal_save_document(text, uuid, integer, text, bigint, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.fiscal_save_config(text, boolean, text, jsonb, text) to service_role;
grant execute on function public.fiscal_get_api_key(text)                              to service_role;
grant execute on function public.fiscal_save_document(text, uuid, integer, text, bigint, text, jsonb, text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. pay_table_part ahora deja un ticket al cerrar la mesa y devuelve su id,
--    para que el panel pida la boleta de ese cobro. El resto de la lógica es
--    la misma de 20261124160000. Cambia el tipo de retorno, así que hay que
--    recrearla.
drop function if exists public.pay_table_part(integer, integer, integer, text, uuid);

create function public.pay_table_part(
  p_table_id integer,
  p_amount   integer,
  p_tip      integer default 0,
  p_method   text default 'Efectivo',
  p_staff_id uuid default null
)
returns table(paid integer, remaining integer, settled boolean, ticket_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rid          text := get_user_restaurant_id();
  v_bill         integer;
  v_label        text;
  v_paid         integer;
  v_tip          integer := greatest(0, coalesce(p_tip, 0));
  v_cash_session text;
  v_items        jsonb;
  v_methods      text[];
  v_tips_total   integer;
  v_ticket       uuid;
begin
  if v_rid is null or v_rid = '' then
    raise exception 'Sesión inválida';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;
  if p_method is null or p_method not in ('Efectivo', 'Tarjeta', 'Transferencia') then
    raise exception 'Método de pago inválido';
  end if;

  select bill_total, coalesce(label, 'Mesa ' || table_number)
    into v_bill, v_label
    from tables
   where id = p_table_id and restaurant_id = v_rid
   for update;
  if not found then
    raise exception 'Mesa no encontrada';
  end if;
  if coalesce(v_bill, 0) <= 0 then
    raise exception 'Esta mesa no tiene nada pendiente por cobrar';
  end if;

  select id into v_cash_session
    from cash_sessions
   where restaurant_id = v_rid and status = 'open'
   order by opened_at desc
   limit 1
   for update;
  if v_cash_session is null then
    raise exception 'La caja está cerrada. Ábrela antes de cobrar.';
  end if;

  if p_staff_id is not null and not exists (
    select 1 from staff where id = p_staff_id and restaurant_id = v_rid
  ) then
    p_staff_id := null;
  end if;

  select coalesce(sum(tp.amount), 0) into v_paid
    from table_payments tp
   where tp.restaurant_id = v_rid and tp.table_id = p_table_id and tp.settled_at is null;

  if p_amount > v_bill - v_paid then
    raise exception 'El monto % supera lo que falta por pagar (%)', clp(p_amount), clp(v_bill - v_paid);
  end if;

  insert into table_payments (restaurant_id, table_id, cash_session_id, staff_id, amount, tip, method)
  values (v_rid, p_table_id, v_cash_session, p_staff_id, p_amount, v_tip, p_method);

  update cash_sessions
     set cash_total     = cash_total     + case when p_method = 'Efectivo'      then p_amount else 0 end,
         card_total     = card_total     + case when p_method = 'Tarjeta'       then p_amount else 0 end,
         transfer_total = transfer_total + case when p_method = 'Transferencia' then p_amount else 0 end,
         tips_total     = tips_total + v_tip
   where id = v_cash_session;

  insert into cash_movements (restaurant_id, session_id, staff_id, action, detail, amount)
  values (v_rid, v_cash_session, p_staff_id, 'Cobro registrado',
          format('%s · %s · %s', v_label, clp(p_amount), p_method)
            || case when v_tip > 0 then format(' · propina %s', clp(v_tip)) else '' end,
          p_amount);

  v_paid := v_paid + p_amount;

  if v_paid >= v_bill then
    -- Foto del consumo, tomada antes de marcar los pedidos como pagados.
    select coalesce(jsonb_agg(jsonb_build_object('name', x.dish_name, 'qty', x.qty, 'amount', x.amount)
                              order by x.dish_name), '[]'::jsonb)
      into v_items
      from (
        select oi.dish_name, sum(oi.qty)::integer as qty, sum(oi.qty * oi.unit_price)::integer as amount
          from orders o
          join order_items oi on oi.order_id = o.id
         where o.restaurant_id = v_rid and o.table_id = p_table_id
           and o.paid_at is null and o.status <> 'cancelled'
         group by oi.dish_name, oi.unit_price
      ) x;

    select array_agg(distinct tp.method), coalesce(sum(tp.tip), 0)::integer
      into v_methods, v_tips_total
      from table_payments tp
     where tp.restaurant_id = v_rid and tp.table_id = p_table_id and tp.settled_at is null;

    insert into table_tickets (restaurant_id, table_id, label, total, tip, method_label, items, staff_id, cash_session_id)
    values (v_rid, p_table_id, v_label, v_bill, v_tips_total,
            case when array_length(v_methods, 1) = 1 then v_methods[1] else 'Mixto' end,
            v_items, p_staff_id, v_cash_session)
    returning id into v_ticket;

    update calls set status = 'Resuelto', resolved_at = now()
     where restaurant_id = v_rid and table_id = p_table_id and status <> 'Resuelto';
    update orders set paid_at = now()
     where restaurant_id = v_rid and table_id = p_table_id
       and paid_at is null and status <> 'cancelled';
    update tables set status = 'Libre', guests = 0, bill_total = 0,
                      tip_accepted = false, tip_amount = 0, waiter_id = null
     where restaurant_id = v_rid and id = p_table_id;
    update table_payments set settled_at = now()
     where restaurant_id = v_rid and table_id = p_table_id and settled_at is null;

    return query select v_paid, 0, true, v_ticket;
    return;
  end if;

  return query select v_paid, (v_bill - v_paid), false, null::uuid;
end;
$function$;

revoke all on function public.pay_table_part(integer, integer, integer, text, uuid) from public, anon;
grant execute on function public.pay_table_part(integer, integer, integer, text, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. reset_demo() también borra los tickets del demo (y con ellos sus boletas).
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
  delete from table_tickets     where restaurant_id = 'demo';
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
