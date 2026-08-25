-- The anon key ships inside every browser bundle, so an anon policy is a public
-- grant. These handed the whole tenant base to anyone holding it, and the read
-- policies that were scoped at all were pinned to the literal id 'holu', which
-- made every other restaurant's data invisible to its own diners.
--
-- The QR app now reaches everything it needs through SECURITY DEFINER functions
-- (resolve_qr, table_orders, open_table_session, restaurant_public, staff_login)
-- and all writes arrive from n8n on the service role, so anon needs exactly one
-- table policy: the public menu.

-- ── Money and stock: were world-readable AND world-writable ──────────────────
drop policy if exists anon_cash_movements on public.cash_movements;
drop policy if exists anon_cash_sessions  on public.cash_sessions;
drop policy if exists anon_expenses       on public.expenses;
drop policy if exists anon_inventory      on public.inventory;

-- ── Tables: anyone could rewrite any restaurant's floor state ────────────────
drop policy if exists anon_update_tables       on public.tables;
drop policy if exists tables_anon_select       on public.tables;
drop policy if exists anon_read_active_tables  on public.tables;
drop policy if exists anon_read_tables_by_qr   on public.tables;

-- ── Restaurants: the full customer list was public ───────────────────────────
drop policy if exists "anon read restaurants"  on public.restaurants;
drop policy if exists restaurants_anon_select  on public.restaurants;

-- ── Staff: leaked names and roles across every tenant ────────────────────────
drop policy if exists "anon read active employees" on public.staff;

-- ── Orders / calls / reviews / sessions: 'holu'-pinned reads, open writes ────
drop policy if exists anon_read_orders        on public.orders;
drop policy if exists anon_update_orders      on public.orders;
drop policy if exists anon_insert_orders      on public.orders;
drop policy if exists anon_read_order_items   on public.order_items;
drop policy if exists anon_insert_order_items on public.order_items;
drop policy if exists anon_read_calls         on public.calls;
drop policy if exists anon_update_calls       on public.calls;
drop policy if exists anon_insert_calls       on public.calls;
drop policy if exists anon_read_reviews       on public.reviews;
drop policy if exists anon_insert_reviews     on public.reviews;
drop policy if exists anon_insert_sessions    on public.sessions;

-- ── Authenticated policies that ignored the tenant entirely ──────────────────
-- Each of these sat next to a correct auth_own_*/mt_* policy and, being
-- permissive, OR'd the scoping away.
drop policy if exists inventory_auth_all                 on public.inventory;
drop policy if exists tables_auth_all                    on public.tables;
drop policy if exists "authenticated manage restaurants" on public.restaurants;
drop policy if exists "authenticated manage staff"       on public.staff;

-- The sales pipeline is not tenant data; only the service role should see it.
drop policy if exists auth_all_prospects on public.prospects;

-- ── reviews had RLS switched off completely ─────────────────────────────────
alter table public.reviews enable row level security;

-- ── The QR app's only remaining direct read ─────────────────────────────────
drop policy if exists anon_read_menu_items on public.menu_items;
create policy anon_read_menu_items on public.menu_items
  for select to anon
  using (visible_client = true and available = true);

-- ── Make the diner-facing entry points explicit ─────────────────────────────
grant execute on function public.resolve_qr(text)                  to anon;
grant execute on function public.table_orders(text)                to anon;
grant execute on function public.open_table_session(text, integer) to anon;
grant execute on function public.restaurant_public(text)           to anon;
grant execute on function public.staff_login(text, text)           to anon;
