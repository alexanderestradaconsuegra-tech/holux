-- A restaurant whose subscription lapsed resubscribes from inside the panel,
-- not from the landing: it already has a restaurant_id, so it skips signups
-- and claim_signup entirely — those exist only to hand a brand-new account to
-- restaurant-onboard once, and this account already exists.
--
-- Safe to call twice in a row (a double click, or the panel retrying): any
-- stale pending row for the restaurant is cleared before the fresh one goes in.
create or replace function public.start_resubscription(
  p_restaurant_id text,
  p_preapproval_id text,
  p_payer_email text,
  p_plan text,
  p_amount integer
)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  delete from subscriptions where restaurant_id = p_restaurant_id and status = 'pending';
  insert into subscriptions (restaurant_id, mp_preapproval_id, status, plan, amount, currency, payer_email)
  values (p_restaurant_id, p_preapproval_id, 'pending', p_plan, p_amount, 'CLP', p_payer_email);
$function$;

revoke all on function public.start_resubscription(text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.start_resubscription(text, text, text, text, integer) to service_role;

-- apply_subscription_state assumed every notification traced back to a
-- signups row, which is only true for a first-time signup. A resubscription
-- writes straight into subscriptions with no signups row at all, so that
-- lookup found nothing and every renewal after the first would have been
-- silently dropped. Update the existing row when there is one; only fall back
-- to the signup-driven path — the one that hands a new account over exactly
-- once — when this preapproval has never been seen before.
create or replace function public.apply_subscription_state(
  p_preapproval_id    text,
  p_status            text,
  p_next_payment_date timestamptz default null
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_restaurant_id text;
  v signups%rowtype;
begin
  update subscriptions
     set status            = p_status,
         next_payment_date = coalesce(p_next_payment_date, next_payment_date),
         last_payment_at   = case when p_status = 'authorized' then now() else last_payment_at end,
         cancelled_at      = case when p_status = 'cancelled'  then now() else cancelled_at end
   where mp_preapproval_id = p_preapproval_id
  returning restaurant_id into v_restaurant_id;

  if found then
    return v_restaurant_id;
  end if;

  select * into v from signups where mp_preapproval_id = p_preapproval_id;
  if not found or v.restaurant_id is null then
    -- The subscription exists but the account has not been built yet; there is
    -- nothing to attach it to until provisioning finishes.
    return 'no_restaurant_yet';
  end if;

  insert into subscriptions (restaurant_id, mp_preapproval_id, status, plan, amount,
                             currency, payer_email, next_payment_date,
                             last_payment_at, cancelled_at)
  values (v.restaurant_id, p_preapproval_id, p_status, v.plan, v.amount,
          'CLP', v.owner_email, p_next_payment_date,
          case when p_status = 'authorized' then now() end,
          case when p_status = 'cancelled'  then now() end);

  return v.restaurant_id;
end;
$function$;
