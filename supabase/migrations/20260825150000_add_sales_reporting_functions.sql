-- Reporting for the Ventas tab, which until now rendered hardcoded demo
-- figures. Both functions run as the caller (no SECURITY DEFINER), so the
-- per-restaurant RLS policies scope them automatically — there is no
-- restaurant_id argument to get wrong.

create or replace function public.period_start(p_period text)
returns timestamptz
language sql
immutable
as $function$
  select case lower(coalesce(p_period, 'day'))
           when 'year'  then date_trunc('year',  now())
           when 'month' then date_trunc('month', now())
           else              date_trunc('day',   now())
         end;
$function$;

-- Headline numbers. Sales come from served orders so they reconcile with the
-- per-dish breakdown below; tips come from cash_sessions, the only place a tip
-- survives once the table is cleared.
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
    where status = 'served'
      and created_at >= (select ts from since)
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

-- Per-dish sales for the same window. Left joins menu_items so a dish that was
-- sold and later deleted from the carta still shows in the history.
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
  where o.status = 'served'
    and o.created_at >= period_start(p_period)
  group by coalesce(oi.menu_item_id, oi.dish_name),
           coalesce(m.name, oi.dish_name),
           coalesce(m.category, 'Sin categoría')
  order by revenue desc;
$function$;

revoke all on function public.sales_summary(text) from public, anon;
revoke all on function public.dish_sales(text)    from public, anon;
grant execute on function public.sales_summary(text) to authenticated;
grant execute on function public.dish_sales(text)    to authenticated;
