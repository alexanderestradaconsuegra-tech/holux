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

## 4. Verificación de correo (ya resuelto)

Como el registro es gratis y sin tarjeta, cualquiera podía llenar el
formulario con un correo falso y tener acceso instantáneo al panel. Desde
nov. 2026 esto ya no pasa: `restaurant-onboard` genera un
`email_verify_token` random (columna `restaurants.email_verify_token`) y el
correo de bienvenida manda un botón "Confirmar mi correo" en vez de abrir el
panel directo. Hasta que esa confirmación llega, `admin.jsx` muestra la
pantalla de "Confirma tu correo" en vez del panel (ver `emailVerifiedAt` en
`HoluAdmin`) — con un botón para reenviar el correo.

Esto vive en un workflow separado, **`HOLU - Verificación de correo`**
(id `OhKVgJZeAIRdPNsX`), con dos webhooks:

- `GET /webhook/verify-email?token=...` — confirma el token, marca
  `email_verified_at` y limpia el token (un solo uso).
- `POST /webhook/resend-verification` con `{ restaurant_id }` — reenvía el
  correo de confirmación si todavía no está verificado, con un rate-limit de
  2 minutos entre reenvíos (columna `email_verify_sent_at`).

No usa `fetch()` dentro de un Code node — esta instancia de n8n no lo
soporta (`fetch is not defined`, confirmado con una ejecución real). Todas
las llamadas a Supabase van por nodos HTTP Request nativos, igual que el
resto del workflow combinado.

Restaurantes que ya existían antes de este cambio quedaron verificados
automáticamente (migración `20261124140000_add_email_verification.sql`) —
esto solo afecta a cuentas nuevas de acá en adelante. Si en el futuro se
quiere además un límite de registros repetidos por IP/correo (captcha,
rate-limit), eso sigue sin resolver — la verificación de correo frena bots
obvios, pero no un humano registrando varias veces con correos reales
distintos.
