-- Toma de pedidos por el personal (mesa o mostrador) desde el panel.
--
-- Hasta hoy un pedido solo podía nacer del QR o del kiosco, así que un cliente sin
-- celular, o una venta de mostrador, no tenía por dónde entrar. Esta función crea el
-- pedido con la sesión del propio usuario (app_metadata):
--   * el restaurante sale del JWT, nunca de un parámetro;
--   * los precios y nombres se leen de menu_items, el panel solo manda id y cantidad;
--   * solo admin, camarero y caja (no cocina);
--   * el camarero queda como waiter_id del pedido;
--   * los triggers existentes siguen haciendo el resto: cuenta de la mesa y stock.
-- p_table_id = null  ->  "Mostrador": mesa especial (zona 'Mostrador') que se crea sola
-- la primera vez y se cobra con el mismo pay_table_part que cualquier mesa.
-- p_items = [{ "menu_item_id": "...", "qty": 2, "note": "sin cebolla" }, ...]

create or replace function public.staff_create_order(
  p_table_id integer,
  p_items    jsonb,
  p_notes    text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rest    text := public.get_user_restaurant_id();
  v_role    text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  v_staff   uuid;
  v_table   record;
  v_item    jsonb;
  v_menu    record;
  v_qty     int;
  v_note    text;
  v_lines   jsonb := '[]'::jsonb;
  v_total   int := 0;
  v_notes   text[] := '{}';
  v_general text;
  v_order   text;
  v_session text;
  v_channel text;
begin
  if v_rest is null or v_rest = '' then
    raise exception 'Sin sesión';
  end if;
  if v_role not in ('admin', 'camarero', 'caja') then
    raise exception 'No autorizado';
  end if;

  v_staff := nullif(auth.jwt() -> 'app_metadata' ->> 'staff_id', '')::uuid;
  if v_staff is not null
     and not exists (select 1 from staff where id = v_staff and restaurant_id = v_rest) then
    raise exception 'No autorizado';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 40 then
    raise exception 'El pedido debe tener entre 1 y 40 platos';
  end if;

  -- Mesa o mostrador
  if p_table_id is null then
    perform pg_advisory_xact_lock(hashtext('mostrador:' || v_rest));
    select * into v_table from tables
     where restaurant_id = v_rest and zone = 'Mostrador' and active order by id limit 1;
    if not found then
      insert into tables (restaurant_id, table_number, label, zone, qr_token, status, guests, active)
      values (v_rest,
              coalesce((select max(table_number) from tables where restaurant_id = v_rest), 0) + 1,
              'Mostrador', 'Mostrador',
              v_rest || '-mostrador-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10),
              'Libre', 0, true)
      returning * into v_table;
    end if;
    v_channel := 'Mostrador';
  else
    select * into v_table from tables
     where id = p_table_id and restaurant_id = v_rest and active;
    if not found then
      raise exception 'Mesa no encontrada';
    end if;
    v_channel := case v_role when 'camarero' then 'Camarero' when 'caja' then 'Caja' else 'Administración' end;
  end if;

  -- Líneas con precio y nombre reales
  for v_item in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'Plato inválido';
    end if;
    v_qty := case when (v_item ->> 'qty') ~ '^\d{1,2}$' then (v_item ->> 'qty')::int else 0 end;
    if v_qty < 1 or v_qty > 50 then
      raise exception 'Cantidad inválida';
    end if;
    select id, name, price into v_menu from menu_items
     where id = v_item ->> 'menu_item_id' and restaurant_id = v_rest and available;
    if not found then
      raise exception 'Plato no disponible: %', left(coalesce(v_item ->> 'menu_item_id', ''), 40);
    end if;
    v_note := nullif(btrim(regexp_replace(coalesce(v_item ->> 'note', ''), '\s+', ' ', 'g')), '');
    if v_note is not null then
      v_notes := v_notes || (v_menu.name || ': ' || left(v_note, 120));
    end if;
    v_lines := v_lines || jsonb_build_object('id', v_menu.id, 'name', v_menu.name, 'price', v_menu.price, 'qty', v_qty);
    v_total := v_total + v_menu.price * v_qty;
  end loop;

  v_general := nullif(btrim(regexp_replace(coalesce(p_notes, ''), '\s+', ' ', 'g')), '');
  if v_general is not null then
    v_notes := v_notes || left(v_general, 200);
  end if;

  select id into v_session from sessions
   where table_id = v_table.id and restaurant_id = v_rest and status = 'active'
   order by started_at desc limit 1;

  insert into orders (restaurant_id, session_id, table_id, waiter_id, status, priority, channel, eta_minutes, notes, total)
  values (v_rest, v_session, v_table.id, case when v_role = 'camarero' then v_staff end,
          'received', 'Normal', v_channel, 18,
          nullif(left(array_to_string(v_notes, ' | '), 500), ''), v_total)
  returning id into v_order;

  insert into order_items (order_id, menu_item_id, dish_name, qty, unit_price, status)
  select v_order, l ->> 'id', l ->> 'name', (l ->> 'qty')::int, (l ->> 'price')::int, 'pending'
    from jsonb_array_elements(v_lines) l;

  update tables
     set status = 'Pedido nuevo', last_activity_at = now(), guests = greatest(coalesce(guests, 0), 1)
   where id = v_table.id;

  return jsonb_build_object('order_id', v_order, 'table_id', v_table.id, 'table_label', v_table.label, 'total', v_total);
end;
$function$;

revoke all on function public.staff_create_order(integer, jsonb, text) from public, anon;
grant execute on function public.staff_create_order(integer, jsonb, text) to authenticated;
