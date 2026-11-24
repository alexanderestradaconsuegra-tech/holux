-- El registro gratis dejaba entrar al panel al instante a cualquiera que
-- llenara el formulario, sin verificar que el correo fuera real. Esto agrega
-- una verificación por link de correo: la cuenta se crea igual, pero el
-- panel no se abre hasta que el dueño confirma el correo.
alter table public.restaurants
  add column if not exists email_verified_at timestamptz,
  add column if not exists email_verify_token text,
  add column if not exists email_verify_sent_at timestamptz;

create unique index if not exists restaurants_email_verify_token_idx
  on public.restaurants (email_verify_token) where email_verify_token is not null;

-- Restaurantes que ya existían antes de este cambio quedan verificados de
-- entrada — esto es solo para cuentas nuevas de acá en adelante, no para
-- bloquear clientes reales que ya estaban usando el sistema.
update public.restaurants
set email_verified_at = coalesce(created_at, now())
where email_verified_at is null;

-- Si no, el dueño podría PATCHear su propia fila desde el panel autenticado
-- y "verificarse" solo sin tocar el correo. Mismo patrón que ya protege
-- activated_at/trial_ends_at/mp_access_token.
create or replace function public.reject_billing_column_tampering()
returns trigger
language plpgsql
as $function$
begin
  if auth.role() = 'authenticated' then
    if new.activated_at is distinct from old.activated_at
       or new.trial_ends_at is distinct from old.trial_ends_at
       or new.mp_access_token is distinct from old.mp_access_token
       or new.email_verified_at is distinct from old.email_verified_at
       or new.email_verify_token is distinct from old.email_verify_token then
      raise exception 'Estas columnas no se pueden modificar desde el panel.';
    end if;
  end if;
  return new;
end;
$function$;
