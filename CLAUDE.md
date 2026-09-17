# HOLU — cómo trabajar en este repo

SaaS para restaurantes (QR de mesa, admin/POS, cocina, kiosco, delivery, agente de WhatsApp)
sobre Supabase + n8n (`https://n8n-n8n.fa2cjf.easypanel.host`) + MercadoPago, desplegado en
EasyPanel/Docker. Multi-tenant: cada restaurante es una fila con su propio `mp_access_token`
propio (nunca un token global compartido) y aislamiento por `restaurant_id` vía RLS.

## Antes de construir algo nuevo

- Si toca dinero, credenciales o datos de un restaurante ajeno, pregúntate en voz alta:
  "¿esto asume que hay un solo restaurante, o funciona igual con 500?" — el error del
  `MP_ACCESS_TOKEN` compartido salió de no hacerse esa pregunta a tiempo.
- Si vas a tocar el workflow de n8n combinado, **no le pegues nodos nuevos adentro**: hacé un
  workflow separado. Ya hubo un incidente real de nodos de webhook duplicados (mismo path,
  tres veces) que rompió el ruteo silenciosamente.
- Antes de escribir copy nuevo para `landing/`, revisar: español latino neutro (nada de
  voseo argentino — "tú", no "vos"), no nombrar marcas de la competencia, y que el precio
  mostrado coincida con lo que realmente cobra el n8n de suscripciones (son dos cosas
  separadas a propósito, ver el comentario arriba de `TIERS` en `Landing.tsx`).

## Después de terminar un cambio

- Si tocaste una migración SQL con un `check constraint`, revisá los valores permitidos
  ANTES de asumir que un nuevo caso (ej. `source = 'whatsapp'`) va a pasar. Un constraint
  demasiado angosto falla en silencio dentro de un try/catch y el usuario nunca se entera.
- Si tocaste `landing/`, corré `npm run build` y sacá screenshots reales (Playwright) del
  antes/después antes de decir que está listo — no alcanza con que compile.
- Si tocaste un workflow de n8n, avisá qué variables de entorno nuevas necesita EasyPanel
  (nada se hereda solo ahí) y qué nodo webhook expone qué path, para evitar duplicados.
- EasyPanel no reconstruye solo con un push nuevo: si algo "no se ve", antes de sospechar
  del código, recordar al usuario subir el número de `cachebust` en el Dockerfile del
  servicio y redesplegar.

## Git

- Todo el trabajo va a la rama `claude/elegant-darwin-zcAa4`, nunca directo a `main`.
- No hacer force-push ni destructivos sin permiso explícito.
