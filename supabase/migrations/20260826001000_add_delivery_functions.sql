-- Turns a paid basket into a real order. MercadoPago retries a notification
-- until it gets a 2xx and sends several per payment, so this has to be safe to
-- call repeatedly: the first call does the work, every one after returns the
-- same order id and cooks nothing twice.
create or replace function public.claim_delivery_payment(
  p_request_id    text,
  p_mp_payment_id text default null
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r delivery_requests%rowtype;
  v_order_id text;
  it jsonb;
begin
  select * into r from delivery_requests where id = p_request_id for update;
  if not found then
    return 'not_found';
  end if;

  -- Already provisioned: hand back the same order rather than making another.
  if r.status = 'paid' and r.order_id is not null then
    return r.order_id;
  end if;

  v_order_id := 'ORD-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  -- No table_id: this is what marks it as not belonging to the floor, and is
  -- why the bill trigger leaves it alone.
  insert into orders (id, restaurant_id, table_id, status, channel, total, notes, eta_minutes)
  values (v_order_id, r.restaurant_id, null, 'received', 'delivery', r.total,
          nullif(concat_ws(' · ', r.customer_name, r.phone, r.address, r.address_notes), ''), 40);

  -- Inserting the lines is what deducts the ingredients, so it happens here —
  -- after the money — and not when the basket was filled.
  for it in select * from jsonb_array_elements(r.items)
  loop
    insert into order_items (order_id, menu_item_id, dish_name, qty, unit_price)
    values (v_order_id,
            it->>'menu_item_id',
            it->>'dish_name',
            greatest(1, coalesce((it->>'qty')::integer, 1)),
            greatest(0, coalesce((it->>'unit_price')::integer, 0)));
  end loop;

  insert into deliveries (order_id, restaurant_id, customer_name, phone, address,
                          address_notes, delivery_fee, status, track_token)
  values (v_order_id, r.restaurant_id, r.customer_name, r.phone, r.address,
          r.address_notes, r.delivery_fee, 'pending', r.track_token);

  update delivery_requests
     set status = 'paid', order_id = v_order_id,
         mp_payment_id = coalesce(p_mp_payment_id, mp_payment_id)
   where id = r.id;

  return v_order_id;
end;
$function$;

revoke all on function public.claim_delivery_payment(text, text) from public, anon, authenticated;
grant execute on function public.claim_delivery_payment(text, text) to service_role;

-- What the customer sees while they wait. The token is their only credential,
-- so this exposes the progress and nothing else — no other order, no phone
-- number, no address back to them. Runs as definer precisely so that anon
-- needs no read access to orders.
create or replace function public.track_delivery(p_token text)
returns table(
  status          text,
  kitchen_status  text,
  placed_at       timestamptz,
  eta_minutes     integer,
  total           integer,
  delivery_fee    integer,
  restaurant_name text,
  items           jsonb
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select d.status,
         o.status,
         o.created_at,
         o.eta_minutes,
         o.total,
         d.delivery_fee,
         rest.name,
         coalesce((
           select jsonb_agg(jsonb_build_object('dish_name', oi.dish_name, 'qty', oi.qty))
           from order_items oi where oi.order_id = o.id
         ), '[]'::jsonb)
  from deliveries d
  join orders o        on o.id = d.order_id
  join restaurants rest on rest.id = d.restaurant_id
  where d.track_token = p_token
  limit 1;
$function$;

grant execute on function public.track_delivery(text) to anon, authenticated;

-- Marking a delivery on its way, then delivered. Kept as a function so the
-- timestamps are stamped consistently and a restaurant cannot touch another's.
create or replace function public.set_delivery_status(p_order_id text, p_status text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rid text := get_user_restaurant_id();
begin
  if p_status not in ('pending', 'en_route', 'delivered', 'cancelled') then
    raise exception 'Estado de reparto inválido: %', p_status;
  end if;

  update deliveries
     set status        = p_status,
         dispatched_at = case when p_status = 'en_route' then coalesce(dispatched_at, now()) else dispatched_at end,
         delivered_at  = case when p_status = 'delivered' then now() else delivered_at end
   where order_id = p_order_id
     and restaurant_id = v_rid;

  if not found then
    return 'not_found';
  end if;

  -- A delivered order is finished in the kitchen too, so it stops sitting on
  -- the board forever.
  if p_status = 'delivered' then
    update orders set status = 'served'
     where id = p_order_id and restaurant_id = v_rid and status not in ('served','cancelled');
  end if;

  return p_status;
end;
$function$;

revoke all on function public.set_delivery_status(text, text) from public, anon;
grant execute on function public.set_delivery_status(text, text) to authenticated;
