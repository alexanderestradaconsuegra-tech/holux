-- A table could only ever be paid in one shot, by one person, with one method.
-- Four people splitting a bill — routine here — had no path through the system
-- at all. Each payment is now its own row, so a table can be settled in pieces
-- by different people paying different ways.
create table if not exists public.table_payments (
  id            bigserial primary key,
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  table_id      integer not null,
  session_id    text,
  cash_session_id text,
  staff_id      uuid references public.staff(id) on delete set null,
  amount        integer not null check (amount > 0),
  tip           integer not null default 0 check (tip >= 0),
  method        text not null check (method in ('Efectivo','Tarjeta','Transferencia')),
  settled_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- The open bill is "payments taken since this table was last settled", so
-- clearing a table starts a fresh tab rather than needing the rows deleted.
create index if not exists table_payments_open_idx
  on public.table_payments(restaurant_id, table_id, created_at desc)
  where settled_at is null;

alter table public.table_payments enable row level security;
drop policy if exists mt_table_payments on public.table_payments;
create policy mt_table_payments on public.table_payments
  for select to authenticated
  using (restaurant_id = get_user_restaurant_id());

-- One payment against a table. Returns what is still owed so the cashier can
-- see it immediately, and settles the table itself the moment it reaches zero:
-- taking the money, closing the orders and freeing the table have to happen
-- together or a half-paid table could be released.
--
-- The bare `return` in the settled branch matters: `return query` appends to
-- the result set and keeps going, so without it the function returned two rows
-- — {settled: true} then {settled: false} — and a client reading the last one
-- would ask a fully paid table to pay again.
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
  v_rid  text := get_user_restaurant_id();
  v_bill integer;
  v_paid integer;
  v_col  text;
  v_cash_session text;
begin
  if v_rid is null or v_rid = '' then
    raise exception 'Sesión inválida';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  select bill_total into v_bill
  from tables where id = p_table_id and restaurant_id = v_rid;
  if v_bill is null then
    raise exception 'Mesa no encontrada';
  end if;

  select id into v_cash_session
  from cash_sessions where restaurant_id = v_rid and status = 'open'
  order by opened_at desc limit 1;

  insert into table_payments (restaurant_id, table_id, cash_session_id, staff_id, amount, tip, method)
  values (v_rid, p_table_id, v_cash_session, p_staff_id, p_amount, greatest(0, coalesce(p_tip, 0)), p_method);

  v_col := case p_method when 'Tarjeta' then 'card_total'
                         when 'Transferencia' then 'transfer_total'
                         else 'cash_total' end;
  perform increment_cash_session(v_col, p_amount, greatest(0, coalesce(p_tip, 0)), v_rid);

  insert into cash_movements (restaurant_id, session_id, staff_id, action, detail, amount)
  select v_rid, v_cash_session, p_staff_id, 'Cobro registrado',
         format('Mesa %s · %s · %s', p_table_id, p_amount, p_method), p_amount
  where v_cash_session is not null;

  select coalesce(sum(tp.amount), 0) into v_paid
  from table_payments tp
  where tp.restaurant_id = v_rid and tp.table_id = p_table_id and tp.settled_at is null;

  if v_paid >= v_bill then
    update calls  set status = 'Resuelto', resolved_at = now()
     where restaurant_id = v_rid and table_id = p_table_id and status <> 'Resuelto';
    update orders set status = 'served'
     where restaurant_id = v_rid and table_id = p_table_id and status not in ('served','cancelled');
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

-- What a cashier needs on screen mid-split: how much is already in.
create or replace function public.table_paid_so_far(p_table_id integer)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(sum(amount), 0)::integer
  from table_payments
  where restaurant_id = get_user_restaurant_id()
    and table_id = p_table_id
    and settled_at is null;
$function$;

revoke all on function public.table_paid_so_far(integer) from public, anon;
grant execute on function public.table_paid_so_far(integer) to authenticated;
