-- 1. staff_login compared a bcrypt hash against the plaintext PIN, so it could
--    never match and PIN login was broken for every restaurant. Verify properly.
create or replace function public.staff_login(p_restaurant_id text, p_pin text)
returns table(id uuid, name text, role text, shift text, avatar_url text)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
  select s.id, s.name, s.role, s.shift, s.avatar_url
  from staff s
  where s.restaurant_id = p_restaurant_id
    and s.status = 'Activo'
    and s.role <> 'admin'
    and s.pin_hash is not null
    and s.pin_hash = crypt(p_pin, s.pin_hash)
  limit 1;
$function$;

-- 2. Setting a PIN needs the hash produced server-side; the admin panel must
--    never send or store a plaintext PIN. Scoped to the caller's own restaurant.
create or replace function public.set_staff_pin(p_staff_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_restaurant_id text;
  v_count int;
begin
  v_restaurant_id := get_user_restaurant_id();
  if v_restaurant_id is null or v_restaurant_id = '' then
    return false;
  end if;
  if p_pin is null or p_pin !~ '^\d{4,8}$' then
    raise exception 'PIN must be 4 to 8 digits';
  end if;

  update staff
     set pin_hash = crypt(p_pin, gen_salt('bf', 10))
   where id = p_staff_id
     and restaurant_id = v_restaurant_id;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$function$;

revoke all on function public.set_staff_pin(uuid, text) from public, anon;
grant execute on function public.set_staff_pin(uuid, text) to authenticated;

-- 3. table_orders excluded served orders, so a diner watching the QR screen saw
--    their order vanish the moment the kitchen marked it served. Keep them
--    visible; the client app decides how to render a finished order.
create or replace function public.table_orders(p_qr_token text)
returns table(id text, status text, eta_minutes integer, total integer, created_at timestamp with time zone, items jsonb)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select o.id, o.status, o.eta_minutes, o.total, o.created_at,
         coalesce(
           (select jsonb_agg(jsonb_build_object(
              'dish_name', oi.dish_name, 'qty', oi.qty,
              'unit_price', oi.unit_price, 'status', oi.status))
            from order_items oi where oi.order_id = o.id),
           '[]'::jsonb)
  from orders o
  join tables t on t.id = o.table_id and t.restaurant_id = o.restaurant_id
  where t.qr_token = p_qr_token
    and o.created_at > now() - interval '12 hours'
  order by o.created_at desc
  limit 10;
$function$;
