-- inventory.linked_dishes held dish *names* and no quantities, so nothing could
-- be deducted from it: stock only ever moved when someone typed a new number by
-- hand, which made the "stock bajo" warnings decorative. A recipe says how much
-- of an ingredient one portion consumes, which is what makes automatic
-- deduction possible.
create table if not exists public.recipe_items (
  id            bigserial primary key,
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  menu_item_id  text not null references public.menu_items(id) on delete cascade,
  inventory_id  text not null references public.inventory(id) on delete cascade,
  qty_per_unit  numeric not null check (qty_per_unit > 0),
  created_at    timestamptz not null default now(),
  unique (menu_item_id, inventory_id)
);

create index if not exists recipe_items_restaurant_idx on public.recipe_items(restaurant_id);

alter table public.recipe_items enable row level security;
drop policy if exists mt_recipe_items on public.recipe_items;
create policy mt_recipe_items on public.recipe_items
  for all to authenticated
  using (restaurant_id = get_user_restaurant_id())
  with check (restaurant_id = get_user_restaurant_id());

-- Every movement is recorded, so a count that drifts can be traced back to the
-- order that moved it rather than just appearing wrong.
create table if not exists public.inventory_movements (
  id            bigserial primary key,
  restaurant_id text not null,
  inventory_id  text not null references public.inventory(id) on delete cascade,
  order_id      text,
  qty           numeric not null,
  reason        text not null,
  created_at    timestamptz not null default now()
);

create index if not exists inventory_movements_item_idx on public.inventory_movements(inventory_id, created_at desc);

alter table public.inventory_movements enable row level security;
drop policy if exists mt_inventory_movements on public.inventory_movements;
create policy mt_inventory_movements on public.inventory_movements
  for select to authenticated
  using (restaurant_id = get_user_restaurant_id());

-- Moves stock and leaves a trail. Clamps at zero rather than refusing: the
-- stock column has a >= 0 constraint, and a kitchen that has more lettuce than
-- the system thinks must never be stopped from cooking by a failed insert.
-- The movement still records the full amount asked for, so the discrepancy
-- stays visible instead of being silently rounded away.
create or replace function public.apply_stock_movement(
  p_restaurant_id text,
  p_inventory_id  text,
  p_qty           numeric,
  p_order_id      text,
  p_reason        text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update inventory
     set stock = greatest(0, stock + p_qty)
   where id = p_inventory_id
     and restaurant_id = p_restaurant_id;

  if found then
    insert into inventory_movements (restaurant_id, inventory_id, order_id, qty, reason)
    values (p_restaurant_id, p_inventory_id, p_order_id, p_qty, p_reason);
  end if;
end;
$function$;

-- Deduct when the line hits the order: that is the moment the kitchen commits
-- to cooking it, and it is the only event guaranteed to happen exactly once
-- whichever door the order came through.
create or replace function public.order_items_deduct_stock()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_restaurant_id text;
  r record;
begin
  select restaurant_id into v_restaurant_id from orders where id = new.order_id;
  if v_restaurant_id is null then
    return new;
  end if;

  for r in
    select inventory_id, qty_per_unit
    from recipe_items
    where menu_item_id = new.menu_item_id
      and restaurant_id = v_restaurant_id
  loop
    perform apply_stock_movement(
      v_restaurant_id, r.inventory_id,
      -(r.qty_per_unit * new.qty), new.order_id,
      format('Venta: %s x%s', new.dish_name, new.qty)
    );
  end loop;

  return new;
end;
$function$;

drop trigger if exists order_items_stock_sync on public.order_items;
create trigger order_items_stock_sync
  after insert on public.order_items
  for each row execute function public.order_items_deduct_stock();

-- A voided order puts its ingredients back.
create or replace function public.orders_restore_stock()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
begin
  if new.status <> 'cancelled' or old.status = 'cancelled' then
    return new;
  end if;

  for r in
    select ri.inventory_id, ri.qty_per_unit, oi.qty, oi.dish_name
    from order_items oi
    join recipe_items ri on ri.menu_item_id = oi.menu_item_id
                        and ri.restaurant_id = new.restaurant_id
    where oi.order_id = new.id
  loop
    perform apply_stock_movement(
      new.restaurant_id, r.inventory_id,
      r.qty_per_unit * r.qty, new.id,
      format('Anulación: %s x%s', r.dish_name, r.qty)
    );
  end loop;

  return new;
end;
$function$;

drop trigger if exists orders_stock_restore on public.orders;
create trigger orders_stock_restore
  after update of status on public.orders
  for each row execute function public.orders_restore_stock();
