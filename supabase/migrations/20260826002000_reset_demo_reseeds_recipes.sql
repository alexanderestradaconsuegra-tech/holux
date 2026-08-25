-- reset_demo() deletes the demo's menu_items and inventory, and recipe_items
-- cascades from both — so every run silently wiped the recipes. Since the reset
-- runs every 30 minutes, the demo's stock stopped moving on sale for good after
-- the first tick, leaving exactly the decorative "stock bajo" badges that
-- adding recipes was meant to fix.
--
-- The seed is its own function called as the last step of the reset, after
-- menu_items and inventory exist, so the two can never drift apart again.
-- reset_demo() itself is recreated in full in this migration with that call
-- added, plus deletes for the delivery and split-payment tables.
create or replace function public.seed_demo_recipes()
returns void
language sql
security definer
set search_path to 'public'
as $function$
  insert into recipe_items (restaurant_id, menu_item_id, inventory_id, qty_per_unit) values
    ('demo','demo-d1','demo-i1',0.25),   -- Ceviche             -> 250 g reineta
    ('demo','demo-d7','demo-i2',0.18),   -- Risotto             -> 180 g camaron
    ('demo','demo-d6','demo-i3',0.40),   -- Pastel de choclo    -> 400 g choclo
    ('demo','demo-b1','demo-i4',0.10),   -- Pisco sour          -> 0,1 botella
    ('demo','demo-b2','demo-i5',1),      -- Cerveza artesanal   -> 1 botella
    ('demo','demo-d4','demo-i6',0.30)    -- Lomo a lo pobre     -> 300 g papas
  on conflict (menu_item_id, inventory_id) do update set qty_per_unit = excluded.qty_per_unit;
$function$;

revoke all on function public.seed_demo_recipes() from public, anon, authenticated;
grant execute on function public.seed_demo_recipes() to service_role;
