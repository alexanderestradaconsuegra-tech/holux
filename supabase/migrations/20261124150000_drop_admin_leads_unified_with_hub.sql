-- admin_leads quedó redundante: ya existía una integración con el Hub de
-- Autix (Hub - Armar evento signup / Hub - Enviar evento en el workflow
-- combinado) que cumple el mismo rol de CRM, cross-producto. Se unifica en
-- un solo lugar en vez de mantener dos.
drop table if exists public.admin_leads;
