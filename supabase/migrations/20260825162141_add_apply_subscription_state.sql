-- The account is created by the restaurant-onboard flow, which mints its own
-- restaurant id — not the signup id. Rather than have the webhook carry the
-- right id down two different branches, it looks the id up from the signup and
-- writes the subscription in one place.
--
-- Safe to call repeatedly: MercadoPago sends a notification per event and
-- retries until it gets a 2xx.
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
  v signups%rowtype;
begin
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
          case when p_status = 'cancelled'  then now() end)
  on conflict (mp_preapproval_id) do update
    set status            = excluded.status,
        next_payment_date = coalesce(excluded.next_payment_date, subscriptions.next_payment_date),
        last_payment_at   = coalesce(excluded.last_payment_at,   subscriptions.last_payment_at),
        cancelled_at      = case when excluded.status = 'cancelled' then now() end;

  return v.restaurant_id;
end;
$function$;

revoke all on function public.apply_subscription_state(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_subscription_state(text, text, timestamptz) to service_role;

-- These are called by the n8n billing workflow, which authenticates as the
-- service role. Revoking from PUBLIC earlier also took away the only grant they
-- had, so name the role explicitly rather than relying on an implicit one.
grant execute on function public.claim_signup(text)                  to service_role;
grant execute on function public.mark_signup_provisioned(text, text) to service_role;
grant execute on function public.reset_demo()                        to service_role;
