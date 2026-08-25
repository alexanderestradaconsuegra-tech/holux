# Suscripciones MercadoPago — puesta en marcha

Importa `holu-suscripciones-mercadopago.json` en n8n. Trae dos webhooks.

## 1. Variables de entorno en n8n

El workflow lee las credenciales del entorno en vez de llevarlas escritas dentro
de los nodos, así no viajan en el JSON ni quedan en el historial de git:

| Variable | De dónde sale |
|---|---|
| `MP_ACCESS_TOKEN` | MercadoPago → Tus integraciones → tu aplicación → Credenciales de producción → Access Token |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` |
| `N8N_PUBLIC_URL` | La URL de tu n8n, sin barra final: `https://n8n-n8n.fa2cjf.easypanel.host` |

En EasyPanel se agregan en el servicio de n8n, pestaña **Environment**. n8n
necesita además `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` para que las expresiones
`$env.` funcionen dentro de los nodos.

Si prefieres no tocar el entorno, reemplaza `{{ $env.MP_ACCESS_TOKEN }}` y
`{{ $env.SUPABASE_SERVICE_ROLE_KEY }}` por los valores literales dentro de cada
nodo — es como están los workflows que ya tienes, pero deja las llaves a la
vista de cualquiera que exporte el workflow.

## 2. Configurar la notificación en MercadoPago

MercadoPago → Tus integraciones → tu aplicación → **Webhooks**.

- URL: `https://n8n-n8n.fa2cjf.easypanel.host/webhook/mp-webhook`
- Eventos a marcar:
  - `subscription_preapproval` — alta y cambios de la suscripción
  - `subscription_authorized_payment` — cada cobro mensual autorizado

## 3. Cómo funciona

**El registro ya no crea la cuenta.** Antes, llenar el formulario de la landing
creaba el restaurante, el usuario y las mesas al instante: cualquiera obtenía un
sistema funcionando sin pagar. Ahora el orden es al revés.

**Alta.** La landing llama a `POST /webhook/subscription-start` con
`{ restaurant_name, owner_name, owner_email, phone, plan }`. El workflow calcula
el precio a partir del plan — el navegador nunca manda el monto — guarda el
registro en `signups` con estado `pending`, crea el *preapproval* en MercadoPago
y devuelve el `init_point`. La landing redirige ahí. **Todavía no existe ninguna
cuenta.**

**Confirmación.** MercadoPago avisa a `POST /webhook/mp-webhook`. El workflow
consulta `GET /preapproval/{id}` para leer el estado desde la fuente — nunca
confía en el cuerpo de la notificación — y llama a `claim_signup()`. Esa función
entrega el trabajo **una sola vez**: la primera notificación recibe los datos y
`already_done = false`; los reintentos reciben `true` y no vuelven a crear nada.

Si corresponde crear la cuenta, el workflow genera una contraseña y llama al
webhook `restaurant-onboard` que ya tenías, que crea el restaurante, el usuario,
el staff admin, las mesas y manda el correo de bienvenida con las credenciales.
Después marca el registro como provisionado y enlaza la suscripción.

**Baja.** Si el dueño cancela o la tarjeta falla, MercadoPago manda otra
notificación con `cancelled` o `paused` y el acceso se cierra en la siguiente
carga del panel.

**Reactivación.** Un restaurante que ya tiene cuenta y dejó vencer su
suscripción usa `POST /webhook/subscription-resubscribe` en vez de
`subscription-start` — ya tiene `restaurant_id`, así que no pasa por `signups`
ni vuelve a llamar a `restaurant-onboard`. Escribe directo una fila `pending`
en `subscriptions` con `start_resubscription()`, que borra cualquier intento
anterior sin confirmar antes de crear el nuevo, para que un doble clic no
choque con la restricción de una sola suscripción viva por restaurante.

### Un detalle a corregir en `restaurant-onboard`

Ese workflow todavía responde *"Trial de 30 días activo"* y deja que la columna
`trial_ends_at` tome su valor por defecto de 30 días. Ya no hay trial: conviene
cambiar ese texto y mandar `"trial_ends_at": null` al crear el restaurante, para
que el acceso dependa solo de la suscripción.

## 4. Planes

Los precios viven en el nodo `Prepare Signup` y en las constantes `PLANS` de
`admin.jsx` y `landing/src/components/Landing.tsx`. Si cambias uno, cambia los
tres: el de n8n es el que cobra, los otros dos solo se muestran.

| Plan | CLP/mes |
|---|---|
| `basico` | 29.990 |
| `pro` | 49.990 |
| `ia` | 79.990 |

## 5. Probar sin cobrar de verdad

Usa las credenciales de **prueba** de MercadoPago y una
[tarjeta de test](https://www.mercadopago.cl/developers/es/docs/checkout-api/additional-content/your-integrations/test/cards).
Verifica que la fila de `subscriptions` pase de `pending` a `authorized` sola, y
que el panel deje de mostrar la pantalla de bloqueo sin recargar credenciales.
