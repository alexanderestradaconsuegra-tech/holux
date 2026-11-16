# HOLU — cómo trabajar en este repo

SaaS multi-tenant para restaurantes sobre Supabase + n8n
(`https://n8n-n8n.fa2cjf.easypanel.host`) + MercadoPago, desplegado en EasyPanel/Docker.
Multi-tenant: cada restaurante es una fila con su propio `mp_access_token` propio (nunca un
token global compartido) y aislamiento por `restaurant_id` vía RLS.

## Alcance del producto (nov. 2026)

- **Plan básico** ($19.990/mes, el que se vende en `landing/` a cualquier restaurante):
  Mesa QR, Camareros, Cocina, Caja/Administración y Kiosco de autoservicio. Nada de
  delivery ni agente de WhatsApp en este plan — fue así a propósito, no es un olvido.
- **Delivery y el agente de WhatsApp son exclusivos del plan "A Medida"** (servidor
  dedicado, se cotiza por WhatsApp — ver `ENTERPRISE` en `Landing.tsx`). El código de
  `delivery.jsx`, `Dockerfile.delivery` y los workflows de n8n de delivery siguen en el
  repo y activos en producción — no se borraron, no se venden ni se muestran en la
  landing/admin del plan básico. Si un cliente pide delivery, se le activa manualmente
  desde su panel (`restaurants.settings.delivery.enabled`), eso ya hace aparecer el tab
  "Delivery" en su admin solo.
- Antes de agregar algo al plan básico, preguntate si de verdad es para **todos** los
  restaurantes o si es algo que solo un cliente a medida pediría — si es lo segundo, va
  en `ENTERPRISE`/Settings, no en `PLAN`/`modules`.

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
  separadas a propósito, ver el comentario arriba de `PLAN` en `Landing.tsx`).

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

## Seguridad

- Hay una auditoría completa (nov. 2026) de n8n/Supabase/frontend en
  `n8n/README-seguridad.md` — qué se corrigió ya en producción y qué queda
  pendiente (cruce de `restaurant_id` con `qr_token`, autorización de
  `subscription-resubscribe`, QR tokens de mesa poco aleatorios, etc.). Leela
  antes de asumir que algo relacionado a multi-tenant o auth ya está resuelto.
- `restaurant-onboard`, `staff-create` y `activate-restaurant` ahora exigen el
  header `x-holu-internal-key` contra la variable de entorno
  `HOLU_INTERNAL_SECRET` en el servicio de n8n — sin configurarla, esos tres
  webhooks (incluida la creación de cuentas nuevas) rechazan todo.

## Git

- Todo el trabajo va a la rama `claude/elegant-darwin-zcAa4`, nunca directo a `main`.
- No hacer force-push ni destructivos sin permiso explícito.
