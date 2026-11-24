-- Caja: separa "servido" de "pagado", deja un solo camino de cobro y hace que
-- el arqueo de cierre quede guardado.
--
-- Hasta ahora orders.status = 'served' significaba dos cosas a la vez: "el
-- plato llegó a la mesa" (lo marca la cocina o el camarero) y "la mesa pagó"
-- (lo marcaba el cobro). Eso hacía que:
--   * Ventas contara como cobrado todo plato entregado, aunque nadie hubiera
--     pagado todavía.
--   * recalc_table_bill no pudiera distinguir lo pagado de lo pendiente, así
--     que sumaba todos los pedidos que la mesa tuvo en su historia: el segundo
--     grupo que se sentaba heredaba la cuenta del primero.
-- Ahora el pago vive en su propia columna, orders.paid_at, y status queda
-- solo para la cocina.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. orders.paid_at
alter table public.orders add column if not exists paid_at timestamptz;

-- Una sola vez, para los pedidos que ya existían: se dan por pagados los de
-- delivery (se crean recién después de que MercadoPago confirma el pago), los
-- de mesas que hoy están libres (alguien ya las cobró) y los de más de 12
-- horas (ninguna mesa sigue abierta tanto tiempo). Lo que queda sin pagar es
-- solo la cuenta de quienes están sentados ahora.
update public.orders o
   set paid_at = coalesce(o.updated_at, o.created_at)
 where o.paid_at is null
   and o.status <> 'cancelled'
   and (
         o.table_id is null
      or o.created_at < now() - interval '12 hours'
      or exists (select 1 from public.tables t
                  where t.id = o.table_id
                    and t.restaurant_id = o.restaurant_id
                    and t.status = 'Libre')
   );

-- Pagos parciales que quedaron colgando en mesas ya libres (pasaba cuando se
-- cobraba una parte dividida y después "todo junto" por el camino viejo, que
-- no los cerraba). Sin esto se le descontarían al próximo grupo de esa mesa.
update public.table_payments tp
   set settled_at = now()
 where tp.settled_at is null
   and exists (select 1 from public.tables t
                where t.id = tp.table_id
                  and t.restaurant_id = tp.restaurant_id
                  and t.status = 'Libre');

create index if not exists orders_open_bill_idx
  on public.orders (restaurant_id, table_id)
  where paid_at is null and status <> 'cancelled';

create index if not exists orders_paid_at_idx
  on public.orders (restaurant_id, paid_at)
  where paid_at is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. La cuenta de la mesa es solo lo que falta pagar.
create or replace function public.recalc_table_bill(p_restaurant_id text, p_table_id integer)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update tables t
     set bill_total = coalesce((
           select sum(o.total)
           from orders o
           where o.restaurant_id = p_restaurant_id
             and o.table_id = p_table_id
             and o.status <> 'cancelled'
             and o.paid_at is null
         ), 0)
   where t.restaurant_id = p_restaurant_id
     and t.id = p_table_id;
$function$;

select public.recalc_table_bill(restaurant_id, id) from public.tables;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Arqueo: lo esperado, lo contado y la diferencia quedan guardados.
alter table public.cash_sessions
  add column if not exists expected_cash   integer,
  add column if not exists counted_cash    integer,
  add column if not exists cash_difference integer;

-- Formato de peso chileno para los textos del historial de caja ($12.345).
create or replace function public.clp(p_amount integer)
returns text
language sql
immutable
as $function$
  select '$' || replace(to_char(coalesce(p_amount, 0), 'FM999,999,999,990'), ',', '.');
$function$;

-- El efectivo que debería haber en el cajón. Solo efectivo: tarjeta y
-- transferencia no pasan por el cajón, así que sumarlas (como hacía el panel)
-- garantizaba una diferencia en cada cierre. Incluye las propinas pagadas en
-- efectivo, que sí quedan en el cajón, y descuenta los gastos del turno.
create or replace function public.cash_session_expected(p_session_id text)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select (cs.opening_cash + cs.cash_total - cs.expenses_total
          + coalesce((select sum(tp.tip)
                        from table_payments tp
                       where tp.cash_session_id = cs.id
                         and tp.method = 'Efectivo'), 0))::integer
    from cash_sessions cs
   where cs.id = p_session_id
     and cs.restaurant_id = get_user_restaurant_id();
$function$;

revoke all on function public.cash_session_expected(text) from public, anon;
grant execute on function public.cash_session_expected(text) to authenticated;

-- Cerrar caja. Antes el panel hacía un PATCH con los totales que tenía en
-- pantalla, lo que borraba cualquier cobro hecho desde otro dispositivo
-- mientras tanto, y no guardaba ni lo contado ni la diferencia. Ahora la base
-- calcula lo esperado y no toca los totales: esos solo los mueve un cobro.
create or replace function public.close_cash_session(p_counted integer, p_staff_id uuid default null)
returns table(expected integer, counted integer, difference integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rid      text := get_user_restaurant_id();
  v_session  text;
  v_expected integer;
begin
  if v_rid is null or v_rid = '' then
    raise exception 'Sesión inválida';
  end if;
  if p_counted is null or p_counted < 0 then
    raise exception 'Ingresa el efectivo que contaste en caja';
  end if;

  select id into v_session
    from cash_sessions
   where restaurant_id = v_rid and status = 'open'
   order by opened_at desc
   limit 1
   for update;
  if v_session is null then
    raise exception 'No hay una caja abierta';
  end if;

  if p_staff_id is not null and not exists (
    select 1 from staff where id = p_staff_id and restaurant_id = v_rid
  ) then
    p_staff_id := null;
  end if;

  v_expected := cash_session_expected(v_session);

  update cash_sessions
     set status          = 'closed',
         closed_at       = now(),
         closed_by       = p_staff_id,
         expected_cash   = v_expected,
         counted_cash    = p_counted,
         cash_difference = p_counted - v_expected
   where id = v_session;

  insert into cash_movements (restaurant_id, session_id, staff_id, action, detail, amount)
  values (v_rid, v_session, p_staff_id, 'Cerró caja',
          format('Efectivo esperado %s · contado %s · diferencia %s',
                 clp(v_expected), clp(p_counted),
                 case when p_counted - v_expected < 0
                      then '-' || clp(v_expected - p_counted)
                      else clp(p_counted - v_expected) end),
          0);

  return query select v_expected, p_counted, p_counted - v_expected;
end;
$function$;

revoke all on function public.close_cash_session(integer, uuid) from public, anon;
grant execute on function public.close_cash_session(integer, uuid) to authenticated;

-- Registrar un gasto. Antes el gasto se guardaba, pero expenses_total solo se
-- actualizaba en la base al cerrar (con el número de pantalla), así que el
-- esperado de la base nunca lo descontaba.
create or replace function public.add_cash_expense(
  p_type     text,
  p_detail   text,
  p_amount   integer,
  p_staff_id uuid default null
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rid     text := get_user_restaurant_id();
  v_session text;
  v_id      text;
begin
  if v_rid is null or v_rid = '' then
    raise exception 'Sesión inválida';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;
  if coalesce(trim(p_detail), '') = '' then
    raise exception 'Describe en qué fue el gasto';
  end if;

  select id into v_session
    from cash_sessions
   where restaurant_id = v_rid and status = 'open'
   order by opened_at desc
   limit 1
   for update;
  if v_session is null then
    raise exception 'La caja está cerrada. Ábrela antes de registrar un gasto.';
  end if;

  if p_staff_id is not null and not exists (
    select 1 from staff where id = p_staff_id and restaurant_id = v_rid
  ) then
    p_staff_id := null;
  end if;

  insert into expenses (restaurant_id, cash_session_id, staff_id, expense_type, detail, amount)
  values (v_rid, v_session, p_staff_id, coalesce(nullif(trim(p_type), ''), 'Caja'), trim(p_detail), p_amount)
  returning id into v_id;

  update cash_sessions set expenses_total = expenses_total + p_amount where id = v_session;

  insert into cash_movements (restaurant_id, session_id, staff_id, action, detail, amount)
  values (v_rid, v_session, p_staff_id, 'Registró gasto',
          format('%s · %s', trim(p_detail), clp(p_amount)), -p_amount);

  return v_id;
end;
$function$;

revoke all on function public.add_cash_expense(text, text, integer, uuid) from public, anon;
grant execute on function public.add_cash_expense(text, text, integer, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Un solo camino de cobro. "Cobrar todo junto" y "dividir la cuenta" pasan
--    los dos por acá; el panel ya no suma totales ni libera mesas por su cuenta.
--
-- Cambios respecto de la versión anterior:
--   * Bloquea la fila de la mesa (for update): dos dispositivos cobrando la
--     misma mesa a la vez ahora esperan su turno en vez de leer el mismo saldo.
--   * Rechaza cobrar con la caja cerrada: antes el pago quedaba sin turno y sin
--     movimiento en el historial.
--   * Rechaza un monto mayor a lo que falta (antes solo lo validaba el panel).
--   * p_amount es solo consumo; la propina va aparte en p_tip. Al cerrar la
--     mesa marca orders.paid_at en vez de cambiar status a 'served', así que un
--     pedido pagado que todavía está en cocina sigue en la pantalla de cocina.
create or replace function public.pay_table_part(
  p_table_id integer,
  p_amount   integer,
  p_tip      integer default 0,
  p_method   text default 'Efectivo',
  p_staff_id uuid default null
)
returns table(paid integer, remaining integer, settled boolean)
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

    return query select v_paid, 0, true;
    return;
  end if;

  return query select v_paid, (v_bill - v_paid), false;
end;
$function$;

revoke all on function public.pay_table_part(integer, integer, integer, text, uuid) from public, anon;
grant execute on function public.pay_table_part(integer, integer, integer, text, uuid) to authenticated;

-- Lo que el modal de cobro necesita al abrirse: cuánto es la cuenta, cuánto
-- ya se pagó en este turno de mesa y si la propina ya se cobró. Antes el modal
-- llevaba lo pagado solo en su memoria: si se cerraba a mitad de una división,
-- al reabrirlo aparecía todo pendiente y la propina se cobraba otra vez.
create or replace function public.table_bill_status(p_table_id integer)
returns table(bill integer, paid integer, remaining integer, tip_paid integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select t.bill_total,
         coalesce(p.paid, 0)::integer,
         greatest(0, t.bill_total - coalesce(p.paid, 0))::integer,
         coalesce(p.tip, 0)::integer
    from tables t
    left join lateral (
      select sum(tp.amount) as paid, sum(tp.tip) as tip
        from table_payments tp
       where tp.restaurant_id = t.restaurant_id
         and tp.table_id = t.id
         and tp.settled_at is null
    ) p on true
   where t.id = p_table_id
     and t.restaurant_id = get_user_restaurant_id();
$function$;

revoke all on function public.table_bill_status(integer) from public, anon;
grant execute on function public.table_bill_status(integer) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Ventas cuentan lo cobrado (paid_at), no lo entregado.
create or replace function public.sales_summary(p_period text default 'day')
returns table(sales bigint, tips bigint, tickets bigint, avg_ticket bigint)
language sql
stable
set search_path to 'public'
as $function$
  with since as (select period_start(p_period) as ts),
  o as (
    select coalesce(sum(total), 0)::bigint as sales,
           count(distinct coalesce(session_id, id))::bigint as tickets
    from orders
    where paid_at is not null
      and status <> 'cancelled'
      and paid_at >= (select ts from since)
  ),
  t as (
    select coalesce(sum(tips_total), 0)::bigint as tips
    from cash_sessions
    where opened_at >= (select ts from since)
  )
  select o.sales,
         t.tips,
         o.tickets,
         case when o.tickets > 0 then (o.sales / o.tickets)::bigint else 0::bigint end
  from o, t;
$function$;

create or replace function public.dish_sales(p_period text default 'day')
returns table(
  menu_item_id text,
  dish_name    text,
  category     text,
  sold         bigint,
  revenue      bigint,
  avg_prep     integer,
  stock_status text
)
language sql
stable
set search_path to 'public'
as $function$
  select coalesce(oi.menu_item_id, oi.dish_name)      as menu_item_id,
         coalesce(m.name, oi.dish_name)               as dish_name,
         coalesce(m.category, 'Sin categoría')        as category,
         sum(oi.qty)::bigint                          as sold,
         sum(oi.qty * oi.unit_price)::bigint          as revenue,
         coalesce(max(m.avg_prep_minutes), 0)         as avg_prep,
         coalesce(max(m.stock_status), 'OK')          as stock_status
  from order_items oi
  join orders o      on o.id = oi.order_id
  left join menu_items m on m.id = oi.menu_item_id
  where o.paid_at is not null
    and o.status <> 'cancelled'
    and o.paid_at >= period_start(p_period)
  group by coalesce(oi.menu_item_id, oi.dish_name),
           coalesce(m.name, oi.dish_name),
           coalesce(m.category, 'Sin categoría')
  order by revenue desc;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Un pedido ya cobrado no se puede anular: la plata ya está en la caja y
--    sacarlo de Ventas descuadraría el cierre. Las devoluciones son otro flujo
--    (todavía no existe).
create or replace function public.cancel_order(p_order_id text, p_reason text, p_staff_id uuid default null)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_restaurant_id text;
  v_status        text;
  v_paid_at       timestamptz;
begin
  select restaurant_id, status, paid_at into v_restaurant_id, v_status, v_paid_at
  from orders where id = p_order_id;

  if v_restaurant_id is null then
    return 'not_found';
  end if;
  -- Only the order's own restaurant may void it, even though this runs as
  -- definer and bypasses RLS.
  if v_restaurant_id <> get_user_restaurant_id() then
    return 'forbidden';
  end if;
  if v_status = 'cancelled' then
    return 'already_cancelled';
  end if;
  if v_paid_at is not null then
    return 'already_paid';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Se requiere un motivo para anular el pedido';
  end if;

  -- cancelled_by is an audit column: it may only name a staff member of this
  -- same restaurant. A staff id from anywhere else is dropped rather than
  -- failing the whole cancellation, so a stale/forged id just records the
  -- void as unattributed instead of being rejected.
  if p_staff_id is not null and not exists (
    select 1 from staff where id = p_staff_id and restaurant_id = v_restaurant_id
  ) then
    p_staff_id := null;
  end if;

  update orders
     set status        = 'cancelled',
         cancelled_at  = now(),
         cancel_reason = trim(p_reason),
         cancelled_by  = p_staff_id
   where id = p_order_id;

  return 'cancelled';
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Delivery se crea recién cuando MercadoPago confirma el pago, así que el
--    pedido nace pagado.
create or replace function public.claim_delivery_payment(p_request_id text, p_mp_payment_id text default null)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r delivery_requests%rowtype;
  v_order_id text;
  it jsonb;
begin
  select * into r from delivery_requests where id = p_request_id for update;
  if not found then
    return 'not_found';
  end if;

  -- Already provisioned: hand back the same order rather than making another.
  if r.status = 'paid' and r.order_id is not null then
    return r.order_id;
  end if;

  v_order_id := 'ORD-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  -- No table_id: this is what marks it as not belonging to the floor, and is
  -- why the bill trigger leaves it alone.
  insert into orders (id, restaurant_id, table_id, status, channel, total, notes, eta_minutes, paid_at)
  values (v_order_id, r.restaurant_id, null, 'received', 'delivery', r.total,
          nullif(concat_ws(' · ', r.customer_name, r.phone, r.address, r.address_notes), ''), 40, now());

  -- Inserting the lines is what deducts the ingredients, so it happens here —
  -- after the money — and not when the basket was filled.
  for it in select * from jsonb_array_elements(r.items)
  loop
    insert into order_items (order_id, menu_item_id, dish_name, qty, unit_price)
    values (v_order_id,
            it->>'menu_item_id',
            it->>'dish_name',
            greatest(1, coalesce((it->>'qty')::integer, 1)),
            greatest(0, coalesce((it->>'unit_price')::integer, 0)));
  end loop;

  insert into deliveries (order_id, restaurant_id, customer_name, phone, address,
                          address_notes, delivery_fee, status, track_token)
  values (v_order_id, r.restaurant_id, r.customer_name, r.phone, r.address,
          r.address_notes, r.delivery_fee, 'pending', r.track_token);

  update delivery_requests
     set status = 'paid', order_id = v_order_id,
         mp_payment_id = coalesce(p_mp_payment_id, mp_payment_id)
   where id = r.id;

  return v_order_id;
end;
$function$;
