-- The service tables were already in the supabase_realtime publication, but
-- all of them sat at the default replica identity: an UPDATE ships only the
-- changed columns and a DELETE ships only the primary key. Realtime has to
-- evaluate each subscriber's RLS policy against the row before delivering it,
-- and restaurant_id — the column every one of those policies is built on —
-- is not part of the key, so those events could not be scoped and were
-- dropped. FULL ships the whole row, which is what makes them deliverable.
alter table public.orders      replica identity full;
alter table public.order_items replica identity full;
alter table public.calls       replica identity full;
alter table public.tables      replica identity full;
