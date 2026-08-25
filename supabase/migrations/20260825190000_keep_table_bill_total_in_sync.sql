-- Nothing ever added to tables.bill_total — the only write in the whole system
-- set it to 0 when clearing a table. So a table could order $68.400 and press
-- "solicita cobro" while the waiter's screen showed a $0 bill, and since the
-- "Cobrar mesa" button only renders when bill > 0, it never appeared: the
-- order → bill → charge loop was broken in the middle and no table could
-- actually be charged.
--
-- Recomputing in a trigger rather than having each client add it up means the
-- number is right no matter which door the order came through — QR table,
-- kiosk, or n8n — and stays right when the kitchen edits or voids one.
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
             -- Anything still open on this table. A table is zeroed explicitly
             -- when it is charged and freed, so counting served orders here is
             -- what lets a diner keep ordering across several rounds and still
             -- get one bill at the end.
         ), 0)
   where t.restaurant_id = p_restaurant_id
     and t.id = p_table_id;
$function$;

create or replace function public.orders_sync_table_bill()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'DELETE' then
    perform recalc_table_bill(old.restaurant_id, old.table_id);
    return old;
  end if;

  perform recalc_table_bill(new.restaurant_id, new.table_id);
  -- A moved order has to clear the bill it left behind.
  if tg_op = 'UPDATE' and (old.table_id is distinct from new.table_id
                           or old.restaurant_id is distinct from new.restaurant_id) then
    perform recalc_table_bill(old.restaurant_id, old.table_id);
  end if;
  return new;
end;
$function$;

drop trigger if exists orders_bill_sync on public.orders;
create trigger orders_bill_sync
  after insert or update of total, status, table_id, restaurant_id or delete
  on public.orders
  for each row execute function public.orders_sync_table_bill();

-- Backfill every table that already has orders sitting against it.
update tables t
   set bill_total = coalesce((
         select sum(o.total) from orders o
         where o.restaurant_id = t.restaurant_id
           and o.table_id = t.id
           and o.status <> 'cancelled'
       ), 0);
