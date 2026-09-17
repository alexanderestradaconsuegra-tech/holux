# Registro gratis (30 días) — puesta en marcha

Importa `holu-registro-gratis.json` en n8n **como workflow aparte** — no lo
pegues dentro del combinado ni del de suscripciones.

## 1. Variables de entorno

Reusa las mismas que ya tiene el workflow de suscripciones en el servicio de
n8n en EasyPanel — no hace falta agregar nada nuevo:

| Variable | De dónde sale |
|---|---|
| `N8N_PUBLIC_URL` | La URL de tu n8n, sin barra final |

(No usa `SUPABASE_SERVICE_ROLE_KEY` ni `MP_ACCESS_TOKEN` directamente — todo
el trabajo de crear el restaurante lo hace el webhook `restaurant-onboard`
que ya tenías, al que este workflow solo le pasa los datos.)

## 2. Cómo funciona

La landing llama a `POST /webhook/signup-free` con
`{ restaurant_name, owner_name, owner_email, phone, plan }`. El workflow:

1. Valida los campos obligatorios y el formato del correo.
2. Genera una contraseña temporal.
3. Llama a `restaurant-onboard` — el mismo webhook que ya usa el flujo de
   pago — que crea el restaurante, el usuario, el staff admin, las mesas y
   manda el correo de bienvenida con las credenciales. Esa cuenta nace con
   `trial_ends_at` a 30 días por defecto (columna `restaurants.trial_ends_at`),
   así que **no hace falta tocar nada ahí**: el trial ya viene incluido.
4. Responde `{ ok: true }` a la landing.

No pasa por MercadoPago ni por la tabla `signups` — es un camino corto y
separado del de pago, a propósito.

## 3. Qué pasa cuando se vence el trial

Nada nuevo que instalar: `access_state()` (ya en la base) devuelve
`'expired'` cuando `trial_ends_at` quedó en el pasado y no hay
`activated_at` ni suscripción autorizada, y el panel (`admin.jsx`) ya
muestra la pantalla de bloqueo con el botón de WhatsApp + campo de código.
Ese código lo entregás vos manualmente (o el agente de WhatsApp) cuando el
restaurante paga, y `activate_restaurant(p_code)` lo desbloquea.

Si en algún momento quieren cobrar automático en vez de manual al vencer el
trial, ahí sí conviene conectar `subscription-resubscribe` (ya existe en
`holu-suscripciones-mercadopago.json`) al botón de "reactivar" del panel —
pero **eso es un paso aparte, no lo activa este workflow.**

## 4. Riesgo a tener presente

Como el registro vuelve a ser gratis, cualquiera puede llenar el formulario
sin tarjeta. Ya no queda una cuenta abierta para siempre (se vence sola a
los 30 días), pero sí queda expuesto a registros repetidos o spam. Si eso
se vuelve un problema real, conviene agregar un captcha simple en el
formulario o un límite de registros por IP/correo antes de llamar a este
webhook — no está resuelto en esta versión.
