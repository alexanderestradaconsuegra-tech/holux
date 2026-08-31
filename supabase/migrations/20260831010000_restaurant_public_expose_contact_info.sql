-- Delivery's footer wants to show the restaurant's address/phone/website
-- (ordinary public business info, same as any storefront), which
-- restaurant_public() didn't return before. mp_access_token stays untouched
-- and unexposed, still selected nowhere in this function.
drop function public.restaurant_public(text);

create function public.restaurant_public(p_id text)
returns table(id text, name text, concept text, google_review_url text, settings jsonb, address text, phone text, website text)
language sql
security definer
set search_path to 'public'
as $function$
  select r.id, r.name, coalesce(r.settings->>'concept', ''), r.google_review_url, r.settings,
         r.address, r.phone, r.website
  from restaurants r
  where r.id = p_id
  limit 1;
$function$;

grant execute on function public.restaurant_public(text) to anon;
