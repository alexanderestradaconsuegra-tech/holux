-- Registration used to create the restaurant, the login and the tables the
-- moment someone submitted the landing form, which handed out working accounts
-- for free. The form now only records the intent to subscribe; the account is
-- built when MercadoPago confirms the money.
create table if not exists public.signups (
  id                text primary key,
  restaurant_name   text not null,
  owner_name        text not null,
  owner_email       text not null,
  phone             text,
  plan              text not null default 'pro',
  amount            integer not null,
  mp_preapproval_id text unique,
  status            text not null default 'pending',
  restaurant_id     text references public.restaurants(id),
  provisioned_at    timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.signups drop constraint if exists signups_status_check;
alter table public.signups add constraint signups_status_check
  check (status in ('pending', 'paid', 'provisioned', 'failed'));

create index if not exists signups_email_idx on public.signups(owner_email);

drop trigger if exists signups_set_updated_at on public.signups;
create trigger signups_set_updated_at
  before update on public.signups
  for each row execute function public.set_updated_at();

-- Nobody reads this from a browser: it is written by n8n on the service role
-- and never exposed. RLS on with no policy means exactly that.
alter table public.signups enable row level security;

-- MercadoPago retries a notification until it gets a 2xx, and sends several
-- for the same subscription, so the provisioning step must be safe to call
-- repeatedly. This hands the signup over exactly once: the first caller gets
-- already_done = false and the work to do, everyone after gets true.
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

  if v.status = 'provisioned' then
    return query select v.id, v.restaurant_name, v.owner_name, v.owner_email,
                        v.phone, v.plan, v.amount, true;
    return;
  end if;

  update signups set status = 'paid' where signups.id = v.id;

  return query select v.id, v.restaurant_name, v.owner_name, v.owner_email,
                      v.phone, v.plan, v.amount, false;
end;
$function$;

create or replace function public.mark_signup_provisioned(p_signup_id text, p_restaurant_id text)
returns boolean
language sql
security definer
set search_path to 'public'
as $function$
  update signups
     set status = 'provisioned',
         restaurant_id = p_restaurant_id,
         provisioned_at = now()
   where id = p_signup_id
  returning true;
$function$;

revoke all on function public.claim_signup(text)                  from public, anon, authenticated;
revoke all on function public.mark_signup_provisioned(text, text) from public, anon, authenticated;

-- Access no longer includes a free trial. A restaurant works while its
-- subscription is authorized, or while it holds a manual courtesy period.
-- A missing trial_ends_at used to read as 'active', which would have left an
-- unpaid account open forever under this model.
create or replace function public.access_state()
returns table(state text, days_left integer, trial_ends_at timestamptz,
              subscription_status text, next_payment_date timestamptz, amount integer)
language sql
stable
set search_path to 'public'
as $function$
  with r as (
    select * from restaurants where id = get_user_restaurant_id()
  ),
  s as (
    select * from subscriptions
    where restaurant_id = get_user_restaurant_id()
    order by case status when 'authorized' then 0 when 'pending' then 1 else 2 end,
             created_at desc
    limit 1
  )
  select
    case
      when (select status from s) = 'authorized'                        then 'active'
      when (select activated_at from r) is not null                     then 'active'
      when coalesce((select trial_ends_at from r), '-infinity') > now() then 'trial'
      else 'expired'
    end,
    greatest(0, ceil(extract(epoch from (coalesce((select trial_ends_at from r), now()) - now())) / 86400)::integer),
    (select trial_ends_at from r),
    (select status from s),
    (select next_payment_date from s),
    (select amount from s);
$function$;

revoke all on function public.access_state() from public, anon;
grant execute on function public.access_state() to authenticated;
