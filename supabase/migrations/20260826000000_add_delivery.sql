-- Delivery. A delivered order is an ordinary order with no table and
-- channel='delivery', which is what lets it inherit the kitchen board, the
-- audible alert, realtime, the recipe-driven stock deduction, the audited void
-- and the sales reports without any of them being touched.
--
-- What a table order does not have is a customer, an address, and a life after
-- it leaves the kitchen — those live here.

-- The basket before it is paid for. Nothing reaches the kitchen from this
-- table: exactly like signups for subscriptions, the real order is built only
-- once MercadoPago confirms the money, so an abandoned checkout cannot make
-- the kitchen cook for free or deduct stock for food nobody bought.
create table if not exists public.delivery_requests (
  id             text primary key default ('DLV-' || substr(replace(gen_random_uuid()::text,'-',''), 1, 10)),
  restaurant_id  text not null references public.restaurants(id) on delete cascade,
  customer_name  text not null,
  phone          text not null,
  address        text not null,
  address_notes  text,
  items          jsonb not null,
  subtotal       integer not null check (subtotal >= 0),
  delivery_fee   integer not null default 0 check (delivery_fee >= 0),
  total          integer not null check (total >= 0),
  status         text not null default 'pending',
  mp_preference_id text unique,
  mp_payment_id  text,
  order_id       text references public.orders(id) on delete set null,
  -- The customer's only credential for following their order, like a QR token.
  track_token    text not null unique default encode(gen_random_bytes(9), 'hex'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.delivery_requests drop constraint if exists delivery_requests_status_check;
alter table public.delivery_requests add constraint delivery_requests_status_check
  check (status in ('pending', 'paid', 'expired', 'failed'));

drop trigger if exists delivery_requests_set_updated_at on public.delivery_requests;
create trigger delivery_requests_set_updated_at
  before update on public.delivery_requests
  for each row execute function public.set_updated_at();

-- Written by n8n on the service role and read by the customer only through the
-- tracking function, so no browser policy at all.
alter table public.delivery_requests enable row level security;

-- The delivery itself, once it exists. orders.status stays the cooking
-- progress; this is the logistics half, which continues after the kitchen is
-- done and would not fit in the same column.
create table if not exists public.deliveries (
  order_id       text primary key references public.orders(id) on delete cascade,
  restaurant_id  text not null references public.restaurants(id) on delete cascade,
  customer_name  text not null,
  phone          text not null,
  address        text not null,
  address_notes  text,
  delivery_fee   integer not null default 0,
  status         text not null default 'pending',
  track_token    text not null unique,
  dispatched_at  timestamptz,
  delivered_at   timestamptz,
  created_at     timestamptz not null default now()
);

alter table public.deliveries drop constraint if exists deliveries_status_check;
alter table public.deliveries add constraint deliveries_status_check
  check (status in ('pending', 'en_route', 'delivered', 'cancelled'));

create index if not exists deliveries_restaurant_idx on public.deliveries(restaurant_id, created_at desc);
create index if not exists deliveries_open_idx on public.deliveries(restaurant_id) where status in ('pending','en_route');

alter table public.deliveries enable row level security;
drop policy if exists mt_deliveries on public.deliveries;
create policy mt_deliveries on public.deliveries
  for all to authenticated
  using (restaurant_id = get_user_restaurant_id())
  with check (restaurant_id = get_user_restaurant_id());
