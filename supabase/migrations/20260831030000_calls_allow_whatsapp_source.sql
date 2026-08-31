-- The WhatsApp ordering agent escalates to a human by inserting into `calls`
-- (same inbox the admin already watches for table calls), but the source
-- check only allowed 'mesa'/'cocina' — a WhatsApp escalation would have
-- silently failed the insert (swallowed by the agent's own try/catch) while
-- still telling the customer someone would reach out.
alter table public.calls drop constraint calls_source_check;
alter table public.calls add constraint calls_source_check
  check (source = any (array['mesa'::text, 'cocina'::text, 'whatsapp'::text]));
