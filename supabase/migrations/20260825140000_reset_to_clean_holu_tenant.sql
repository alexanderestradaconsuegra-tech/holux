-- Pre-launch reset. 'nido' was a throwaway test tenant and every order in the
-- database came from the demo path (all 82 pointed at table_id 7, a table that
-- exists in neither restaurant), so none of it is worth carrying into launch.
-- 'holu' keeps its record and its four QR tables; everything transactional goes.
--
-- A full copy of every tenant table was taken into schema backup_20260825
-- immediately before this ran, and can be dropped once launch is confirmed:
--   drop schema backup_20260825 cascade;

-- ── Transactional data, both tenants ────────────────────────────────────────
delete from public.order_items;
delete from public.orders;
delete from public.calls;
delete from public.messages;
delete from public.reviews;
delete from public.sessions;
delete from public.cash_movements;
delete from public.cash_sessions;
delete from public.expenses;
delete from public.pin_attempts;

-- ── The nido tenant itself ──────────────────────────────────────────────────
delete from public.inventory   where restaurant_id = 'nido';
delete from public.menu_items  where restaurant_id = 'nido';
delete from public.tables      where restaurant_id = 'nido';
delete from public.staff       where restaurant_id = 'nido';
delete from public.restaurants where id = 'nido';

-- ── holu's tables go back to an idle floor ──────────────────────────────────
update public.tables
   set status = 'Libre',
       guests = 0,
       bill_total = 0,
       tip_accepted = false,
       tip_amount = 0,
       waiter_id = null,
       last_activity_at = now()
 where restaurant_id = 'holu';

-- The six nido logins (marco@nido.cl and friends) were removed separately:
--   delete from auth.users where email like '%@nido.cl';
