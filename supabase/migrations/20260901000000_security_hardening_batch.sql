-- Security hardening batch (post-audit). Seven independent fixes, grouped in
-- one migration because they were all found and fixed in the same pass; none
-- of them depends on another.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. apply_stock_movement() and recalc_table_bill() never got their own
--    REVOKE. Postgres grants EXECUTE to PUBLIC on every newly created
--    function by default, so with RLS bypassed (both are SECURITY DEFINER)
--    any anon/authenticated caller could POST /rest/v1/rpc/apply_stock_movement
--    or /rpc/recalc_table_bill with an arbitrary p_restaurant_id belonging to
--    someone else's restaurant and move their stock or rewrite their table's
--    bill_total. Neither function is called directly by any client code
--    (admin.jsx, mesa.jsx, kiosco.jsx, delivery.jsx) or by n8n — both are
--    only ever invoked from inside other SECURITY DEFINER trigger functions
--    (order_items_deduct_stock, orders_restore_stock, orders_sync_table_bill),
--    which keep working after this revoke: a SECURITY DEFINER function runs
--    as its owner, and the owner's own EXECUTE right on a function it owns is
--    never affected by a REVOKE against public/anon/authenticated. So there
--    is nothing to re-grant, following the same pattern already used for
--    claim_signup()/mark_signup_provisioned() in
--    20260825161030_pay_before_provision_signups.sql.
revoke all on function public.apply_stock_movement(text, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.recalc_table_bill(text, integer) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. As checked into this repo, reviews had RLS enabled
--    (20260825134018_lock_down_anon_access_and_fix_multitenancy.sql) but its
--    only policies, anon_read_reviews and anon_insert_reviews, were dropped
--    in that same migration and never replaced — on a database built from
--    just this repo's migration history, RLS on with zero policies denies
--    every row to every role, so admin.jsx's `supaGet("reviews?...",
--    authToken)` would silently return 0 rows. Guarded with an existence
--    check because the real database this migration is applied to already
--    carries equivalent policies (auth_own_reviews, mt_reviews — both `for
--    all to authenticated using (restaurant_id = get_user_restaurant_id())`)
--    from a migration that updated the live project directly and was never
--    committed here; this keeps the fix idempotent either way instead of
--    piling on a third redundant policy in production.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reviews'
  ) then
    create policy mt_reviews_read on public.reviews
      for select to authenticated
      using (restaurant_id = get_user_restaurant_id());
  end if;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. whatsapp_sessions_own_restaurant (20260831020000_add_whatsapp_agent_
--    sessions.sql) was created with no `to` clause, which defaults to PUBLIC
--    — anon included — breaking the "to authenticated" pattern every other
--    mt_*/own_restaurant policy in this schema follows. n8n already talks to
--    this table with the service role, which bypasses RLS entirely, so
--    restricting the policy to authenticated changes nothing for it.
drop policy if exists whatsapp_sessions_own_restaurant on public.whatsapp_sessions;
create policy whatsapp_sessions_own_restaurant on public.whatsapp_sessions
  for select to authenticated
  using (restaurant_id = public.get_user_restaurant_id());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. cancel_order() already checks that the order belongs to the caller's
--    own restaurant before voiding it, but it wrote p_staff_id straight into
--    the audit column `cancelled_by` with no check that that staff id
--    belongs to the same restaurant — a caller could attribute the
--    cancellation to any staff uuid that exists anywhere in the database.
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

-- Function signature/REVOKE/GRANT are unchanged from
-- 20260825210000_add_audited_order_cancellation.sql; `create or replace`
-- above keeps the existing grant to authenticated in place.

-- ─────────────────────────────────────────────────────────────────────────
-- 5. set_staff_pin() checked that the target staff id belongs to the
--    caller's own restaurant, but never checked that the CALLER is allowed
--    to reset someone else's PIN — any authenticated staff session could
--    reset any other employee's PIN in the same restaurant.
--
--    This app has no staff row for the restaurant's own admin/owner login:
--    SessionLogin (admin.jsx) signs the owner in by email/password as a
--    plain Supabase Auth user, so that JWT's user_metadata carries only
--    restaurant_id. Employees instead sign in with a PIN through the
--    staff-login edge function (supabase/functions/staff-login/index.ts),
--    which mints a JWT whose user_metadata additionally carries staff_id
--    and staff_role — and that function explicitly excludes role = 'admin'
--    (`.neq("role", "admin")`), so a JWT that carries a staff_id is, by
--    construction, never an admin's. That makes "no staff_id claim at all"
--    the real admin signal in this schema, not a role lookup against the
--    staff table.
create or replace function public.set_staff_pin(p_staff_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_restaurant_id text;
  v_caller_staff_id text;
  v_count int;
begin
  v_restaurant_id := get_user_restaurant_id();
  if v_restaurant_id is null or v_restaurant_id = '' then
    return false;
  end if;
  if p_pin is null or p_pin !~ '^\d{4,8}$' then
    raise exception 'PIN must be 4 to 8 digits';
  end if;

  v_caller_staff_id := auth.jwt() -> 'user_metadata' ->> 'staff_id';

  -- Every employee may always change their own PIN. Anyone changing someone
  -- else's PIN must be the restaurant's admin/owner login, i.e. a JWT with
  -- no staff_id claim at all.
  if v_caller_staff_id is not null and v_caller_staff_id::uuid <> p_staff_id then
    raise exception 'Solo un administrador puede cambiar el PIN de otro empleado.';
  end if;

  update staff
     set pin_hash = crypt(p_pin, gen_salt('bf', 10))
   where id = p_staff_id
     and restaurant_id = v_restaurant_id;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$function$;

-- REVOKE/GRANT are unchanged from
-- 20260825133745_fix_staff_pin_login_and_table_orders.sql; `create or
-- replace` above keeps the existing grant to authenticated in place.

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Nothing stopped an authenticated restaurant session from PATCHing its
--    own restaurants row to set activated_at, trial_ends_at or
--    mp_access_token directly (bypassing the trial/subscription/payment
--    flow entirely). The one existing trigger on this table,
--    reject_demo_identity_changes (20260825180000_lock_down_demo_and_
--    schedule_reset.sql), only protects the demo row's `id` column.
--    Mirrors that trigger's own style: plain plpgsql, no SECURITY DEFINER —
--    raising an exception needs no elevated privilege, and the UPDATE being
--    rejected already carries whatever privilege the authenticated caller
--    has on this table.
create or replace function public.reject_billing_column_tampering()
returns trigger
language plpgsql
as $function$
begin
  if auth.role() = 'authenticated' then
    if new.activated_at is distinct from old.activated_at
       or new.trial_ends_at is distinct from old.trial_ends_at
       or new.mp_access_token is distinct from old.mp_access_token then
      raise exception 'Estas columnas no se pueden modificar desde el panel.';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_reject_billing_tampering on public.restaurants;
create trigger trg_reject_billing_tampering
  before update on public.restaurants
  for each row execute function public.reject_billing_column_tampering();

-- ─────────────────────────────────────────────────────────────────────────
-- 7. claim_signup()'s "already handled" guard only recognized status =
--    'provisioned', which is written by a separate call (mark_signup_
--    provisioned) made after restaurant-onboard — which takes several
--    seconds — finishes. Two close-together MercadoPago notifications for
--    the same preapproval could both lock the row (serialized by `for
--    update`) while it still read as the pre-provisioned state and both get
--    already_done = false, firing restaurant-onboard twice for one signup.
--    Flipping the status to an interim 'provisioning' value inside the same
--    locked transaction, and treating anything other than the fresh
--    'pending' state as already claimed, closes the window: the second
--    caller now blocks on the row lock and then sees 'provisioning', not
--    the original state, so it is correctly told already_done = true.
alter table public.signups drop constraint if exists signups_status_check;
alter table public.signups add constraint signups_status_check
  check (status in ('pending', 'paid', 'provisioning', 'provisioned', 'failed'));

create or replace function public.claim_signup(p_preapproval_id text)
returns table(id text, restaurant_name text, owner_name text, owner_email text,
              phone text, plan text, amount integer, already_done boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v signups%rowtype;
begin
  select * into v from signups where mp_preapproval_id = p_preapproval_id for update;
  if not found then
    return;
  end if;

  if v.status <> 'pending' then
    return query select v.id, v.restaurant_name, v.owner_name, v.owner_email,
                        v.phone, v.plan, v.amount, true;
    return;
  end if;

  update signups set status = 'provisioning' where signups.id = v.id;

  return query select v.id, v.restaurant_name, v.owner_name, v.owner_email,
                      v.phone, v.plan, v.amount, false;
end;
$function$;

-- REVOKE/GRANT are unchanged from 20260825161030_pay_before_provision_
-- signups.sql and 20260825170000_support_resubscription_and_fix_apply_
-- state.sql (public/anon/authenticated revoked, service_role granted);
-- `create or replace` above keeps them in place.
