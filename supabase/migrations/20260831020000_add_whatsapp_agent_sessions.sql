-- Memoria del agente de WhatsApp: una fila por (restaurante, teléfono del
-- cliente). `messages` es el historial que se le pasa a Claude en cada
-- llamada; `cart` es el pedido que el agente va armando en la conversación
-- antes de mandarlo a pagar por el mismo camino que ya usa delivery.jsx.
create table public.whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  phone text not null,
  customer_name text,
  messages jsonb not null default '[]'::jsonb,
  cart jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active','checkout','completed','abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, phone)
);

create index whatsapp_sessions_restaurant_idx on public.whatsapp_sessions(restaurant_id);

alter table public.whatsapp_sessions enable row level security;

-- Same multi-tenant pattern as every other operational table: a restaurant's
-- own authenticated staff can see its conversations (for a future "ver
-- chats" admin view); n8n talks to this table with the service_role key,
-- which bypasses RLS entirely, so no anon/authenticated INSERT policy is
-- needed here.
create policy whatsapp_sessions_own_restaurant on public.whatsapp_sessions
  for select using (restaurant_id = public.get_user_restaurant_id());

create or replace function public.touch_whatsapp_session()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger whatsapp_sessions_touch
  before update on public.whatsapp_sessions
  for each row execute function public.touch_whatsapp_session();
