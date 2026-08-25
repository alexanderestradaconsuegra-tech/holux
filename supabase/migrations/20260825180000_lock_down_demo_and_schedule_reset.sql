-- The demo login is meant to be public — anyone can use it to look around
-- without registering. As shipped that meant anyone could also run their real
-- business on it for free forever: full write access, and access_state()
-- treats it as permanently paid (activated_at is set). Two things fix that.

-- 1. Nobody signed in as 'demo' can rebrand it. Without this, one visitor
-- typing their own restaurant's name, RUT and phone into Configuración would
-- point every other prospect's demo — and any real diner they handed a demo
-- QR code to — at their own business, until the next reset.
--
-- auth.role() = 'authenticated' only when the request came through PostgREST
-- with a real user JWT, i.e. exactly the public demo session. Internal calls
-- (migrations, the SQL editor, the cron job below) carry no such role and
-- pass straight through.
create or replace function public.reject_demo_identity_changes()
returns trigger
language plpgsql
as $function$
begin
  if new.id = 'demo' and auth.role() = 'authenticated' then
    raise exception 'La identidad del restaurante demo no se puede modificar.';
  end if;
  return new;
end;
$function$;

drop trigger if exists demo_identity_locked on public.restaurants;
create trigger demo_identity_locked
  before update on public.restaurants
  for each row execute function public.reject_demo_identity_changes();

-- 2. Everything else a visitor touches — menu, staff, tables, a real order
-- taken through a QR someone printed and handed to an actual customer — heals
-- on its own. A restaurant needs continuous, reliable state to run a service;
-- getting wiped every 30 minutes makes the demo useless as a substitute for
-- paying while easily surviving a prospect's walkthrough.
create extension if not exists pg_cron;

select cron.schedule(
  'reset-demo-showroom',
  '*/30 * * * *',
  $$select public.reset_demo();$$
);
