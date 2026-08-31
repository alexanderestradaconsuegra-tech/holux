-- Each restaurant charges its OWN delivery customers into its OWN MercadoPago
-- account, not a shared platform account. This column holds that credential.
-- It is deliberately separate from `settings` (which restaurant_public() and
-- the delivery page both read) so it is never exposed to anon/public callers.
alter table public.restaurants
  add column if not exists mp_access_token text;

comment on column public.restaurants.mp_access_token is
  'MercadoPago Access Token used to charge THIS restaurant''s own delivery orders. Private: never selected by restaurant_public() or any anon-facing function.';
