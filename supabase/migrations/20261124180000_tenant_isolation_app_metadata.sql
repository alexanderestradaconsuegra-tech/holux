-- Aislamiento entre restaurantes: el restaurante y el rol de un usuario salen
-- de app_metadata (solo lo escribe el servidor), no de user_metadata.
--
-- get_user_restaurant_id() leía auth.jwt() -> 'user_metadata' ->> 'restaurant_id'
-- y user_metadata lo puede editar el propio usuario (PUT /auth/v1/user). Probado
-- en vivo (24 nov. 2026): un usuario del demo se cambió el restaurant_id a otro
-- restaurante, volvió a iniciar sesión y vio sus filas. Cualquier usuario
-- autenticado —un registro de prueba o un mozo— podía leer y escribir los datos
-- de cualquier restaurante.
--
-- Orden: primero se rellena app_metadata de los usuarios que ya existen y recién
-- después se cambian las funciones, para no dejar a nadie sin acceso. Los
-- tokens emitidos antes de este cambio no traen app_metadata: esos usuarios
-- tienen que volver a iniciar sesión (el panel ya los manda al login).

-- 1. Personal con login por PIN: restaurante, rol e id salen de la tabla staff
--    (la fuente de verdad), nunca de lo que diga el metadata.
update auth.users u
   set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('restaurant_id', s.restaurant_id, 'role', s.role, 'staff_id', s.id)
  from public.staff s
 where u.email = 'staff.' || s.id::text || '@holu.internal';

-- 2. Dueños (login con correo): hoy hay uno por restaurante, creado por el
--    registro o a mano; su restaurante se toma del user_metadata original.
update auth.users u
   set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('restaurant_id', u.raw_user_meta_data ->> 'restaurant_id', 'role', 'admin')
 where u.email not like 'staff.%@holu.internal'
   and u.raw_user_meta_data ? 'restaurant_id'
   and (u.raw_app_meta_data ->> 'restaurant_id') is null
   and exists (select 1 from public.restaurants r where r.id = u.raw_user_meta_data ->> 'restaurant_id');

-- 3. Desde ahora solo cuenta app_metadata.
create or replace function public.get_user_restaurant_id()
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'restaurant_id', '');
$function$;

-- set_staff_pin decidía "¿es administrador?" mirando si el JWT NO traía staff_id
-- en user_metadata: un mozo podía borrarse ese campo, pasar por administrador y
-- cambiar el PIN de cualquiera (incluido el del dueño). Ahora: o es el dueño
-- (sin staff_id en app_metadata), o su rol de servidor es admin, o solo cambia
-- el suyo.
create or replace function public.set_staff_pin(p_staff_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_restaurant_id   text;
  v_caller_staff_id text;
  v_caller_role     text;
  v_count           int;
begin
  v_restaurant_id := get_user_restaurant_id();
  if v_restaurant_id is null or v_restaurant_id = '' then
    return false;
  end if;
  if p_pin is null or p_pin !~ '^\d{4,8}$' then
    raise exception 'PIN must be 4 to 8 digits';
  end if;

  v_caller_staff_id := auth.jwt() -> 'app_metadata' ->> 'staff_id';
  v_caller_role     := auth.jwt() -> 'app_metadata' ->> 'role';

  if v_caller_staff_id is not null
     and coalesce(v_caller_role, '') <> 'admin'
     and v_caller_staff_id::uuid <> p_staff_id then
    raise exception 'Solo un administrador puede cambiar el PIN de otro empleado.';
  end if;

  update staff
     set pin_hash = crypt(p_pin, gen_salt('bf', 10))
   where id = p_staff_id
     and restaurant_id = v_restaurant_id;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$function$;
