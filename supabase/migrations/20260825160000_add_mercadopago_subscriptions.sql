-- Recurring billing through MercadoPago's preapproval API. One row per
-- restaurant; MercadoPago owns the truth about whether it is being paid and
-- tells us through its webhook, so nothing here is written by the browser.
create table if not exists public.subscriptions (
  id                  bigserial primary key,
  restaurant_id       text not null references public.restaurants(id) on delete cascade,
  mp_preapproval_id   text unique,
  status              text not null default 'pending',
  plan                text not null default 'pro',
  amount              integer not null,
  currency            text not null default 'CLP',
  payer_email         text,
  next_payment_date   timestamptz,
  last_payment_at     timestamptz,
  cancelled_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- MercadoPago's own vocabulary, so the webhook can store what it receives
-- without translating and drifting out of sync.
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('pending', 'authorized', 'paused', 'cancelled'));

create index if not exists subscriptions_restaurant_idx on public.subscriptions(restaurant_id);
create unique index if not exists subscriptions_one_live_per_restaurant
  on public.subscriptions(restaurant_id) where status in ('pending', 'authorized');

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

-- The owner may read their own billing state. Writes belong to the n8n
-- workflow on the service role: a restaurant must not be able to mark itself
-- paid, so there is deliberately no insert or update policy here.
drop policy if exists mt_subscriptions_read on public.subscriptions;
create policy mt_subscriptions_read on public.subscriptions
  for select to authenticated
  using (restaurant_id = get_user_restaurant_id());

-- Single source of truth for "can this restaurant use the system today".
-- Manual activation still wins, then a live subscription, then the trial.
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
      when (select activated_at from r) is not null            then 'active'
      when (select status from s) = 'authorized'               then 'active'
      when (select trial_ends_at from r) is null               then 'active'
      when (select trial_ends_at from r) > now()               then 'trial'
      else 'expired'
    end,
    greatest(0, ceil(extract(epoch from ((select trial_ends_at from r) - now())) / 86400)::integer),
    (select trial_ends_at from r),
    (select status from s),
    (select next_payment_date from s),
    (select amount from s);
$function$;

revoke all on function public.access_state() from public, anon;
grant execute on function public.access_state() to authenticated;
