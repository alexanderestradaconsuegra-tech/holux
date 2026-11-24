-- La función clp() (formato de pesos) quedó sin search_path fijo; solo usa funciones
-- de pg_catalog, así que un search_path vacío es seguro.
alter function public.clp(integer) set search_path = '';
