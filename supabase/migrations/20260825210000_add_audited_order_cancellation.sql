-- Voiding an order is the classic way cash walks out of a restaurant: ring it
-- up, take the money, void the order. So a void records who did it and why,
-- and the reason is required — an unexplained void is exactly the one worth
-- looking at.
alter table public.orders add column if not exists cancelled_at   timestamptz;
alter table public.orders add column if not exists cancel_reason  text;
alter table public.orders add column if not exists cancelled_by   uuid references public.staff(id) on delete set null;

-- Does the whole void in one place: stamps the audit trail and flips the
-- status, which fires the existing triggers that return the ingredients to
-- stock and recompute the table's bill. Doing it as one statement means those
-- three things cannot drift apart.
create or replace function public.cancel_order(
  p_order_id  text,
  p_reason    text,
  p_staff_id  uuid default null
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_restaurant_id text;
  v_status text;
begin
  select restaurant_id, status into v_restaurant_id, v_status
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
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Se requiere un motivo para anular el pedido';
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

revoke all on function public.cancel_order(text, text, uuid) from public, anon;
grant execute on function public.cancel_order(text, text, uuid) to authenticated;

-- A cancelled order must not count as revenue. sales_summary and dish_sales
-- filter on status = 'served', so they already exclude it; this index keeps
-- the "what was voided today" lookup cheap for the owner.
create index if not exists orders_cancelled_idx
  on public.orders(restaurant_id, cancelled_at desc)
  where status = 'cancelled';
