-- La carta del demo ahora trae detalle del plato y alérgenos, para que la hoja de
-- detalle de la mesa se vea completa en las demostraciones.
--
-- reset_demo() vuelve a sembrar menu_items cada 30 minutos, así que no basta con un
-- UPDATE: se agrega a la propia función, justo después del insert de la carta.
-- Los alérgenos son los de una receta típica de cada plato y solo valen para el demo.
-- "ninguno" = el restaurante declara que no tiene alérgenos comunes (distinto de
-- dejarlo vacío, que la mesa muestra como "sin información").

do $outer$
declare
  d text;
  marker text := E'\n\n  insert into inventory (id, restaurant_id, name, category, stock, unit, min_stock, cost_price, linked_dishes) values';
  extra text := $q$

  -- demo-alergenos
  update menu_items m
     set description = v.det, allergens = v.alg
    from (values
      ('demo-d1', 'Reineta fresca marinada en jugo de limón de pica con cebolla morada, cilantro y ají. Se sirve frío.', '{Pescado}'::text[]),
      ('demo-d2', 'Masa casera rellena de pino de carne, cebolla, huevo duro, aceituna y pasas, horneada en horno de barro.', '{Gluten,Huevo}'),
      ('demo-d3', 'Machas frescas gratinadas al horno con queso parmesano y mantequilla.', '{Mariscos,Lácteos}'),
      ('demo-d4', 'Lomo liso a la plancha con papas fritas, cebolla caramelizada y dos huevos fritos.', '{Huevo}'),
      ('demo-d5', 'Filete de congrio dorado en harina, acompañado de ensalada chilena.', '{Pescado,Gluten}'),
      ('demo-d6', 'Pino de carne, pollo, huevo y aceituna cubierto con pasta de choclo, gratinado en greda.', '{Huevo}'),
      ('demo-d7', 'Arroz cremoso con camarones, parmesano y ralladura de limón.', '{Mariscos,Lácteos}'),
      ('demo-d8', 'Postre tradicional chileno: mote de trigo y huesillo en su almíbar de durazno.', '{Gluten}'),
      ('demo-d9', 'Flan casero de leche y huevo, horneado y bañado en caramelo natural.', '{Lácteos,Huevo}'),
      ('demo-b1', 'Pisco de 35°, jugo de limón de pica, azúcar y clara de huevo batida.', '{Huevo}'),
      ('demo-b2', 'Cerveza IPA local de 470 cc.', '{Gluten}'),
      ('demo-b3', 'Limonada natural con hojas de menta fresca. Jarra de 1 litro.', '{ninguno}')
    ) as v(id, det, alg)
   where m.id = v.id and m.restaurant_id = 'demo';
$q$;
begin
  select pg_get_functiondef(oid) into d
    from pg_proc where proname = 'reset_demo' and pronamespace = 'public'::regnamespace;
  if d is null then
    raise exception 'No existe reset_demo()';
  end if;
  if position('demo-alergenos' in d) = 0 then
    if position(marker in d) = 0 then
      raise exception 'No se encontró el punto de inserción en reset_demo()';
    end if;
    execute replace(d, marker, extra || marker);
  end if;
end
$outer$;

-- Lo mismo sobre la carta que ya está cargada ahora.
update menu_items m
   set description = v.det, allergens = v.alg
  from (values
    ('demo-d1', 'Reineta fresca marinada en jugo de limón de pica con cebolla morada, cilantro y ají. Se sirve frío.', '{Pescado}'::text[]),
    ('demo-d2', 'Masa casera rellena de pino de carne, cebolla, huevo duro, aceituna y pasas, horneada en horno de barro.', '{Gluten,Huevo}'),
    ('demo-d3', 'Machas frescas gratinadas al horno con queso parmesano y mantequilla.', '{Mariscos,Lácteos}'),
    ('demo-d4', 'Lomo liso a la plancha con papas fritas, cebolla caramelizada y dos huevos fritos.', '{Huevo}'),
    ('demo-d5', 'Filete de congrio dorado en harina, acompañado de ensalada chilena.', '{Pescado,Gluten}'),
    ('demo-d6', 'Pino de carne, pollo, huevo y aceituna cubierto con pasta de choclo, gratinado en greda.', '{Huevo}'),
    ('demo-d7', 'Arroz cremoso con camarones, parmesano y ralladura de limón.', '{Mariscos,Lácteos}'),
    ('demo-d8', 'Postre tradicional chileno: mote de trigo y huesillo en su almíbar de durazno.', '{Gluten}'),
    ('demo-d9', 'Flan casero de leche y huevo, horneado y bañado en caramelo natural.', '{Lácteos,Huevo}'),
    ('demo-b1', 'Pisco de 35°, jugo de limón de pica, azúcar y clara de huevo batida.', '{Huevo}'),
    ('demo-b2', 'Cerveza IPA local de 470 cc.', '{Gluten}'),
    ('demo-b3', 'Limonada natural con hojas de menta fresca. Jarra de 1 litro.', '{ninguno}')
  ) as v(id, det, alg)
 where m.id = v.id and m.restaurant_id = 'demo';
