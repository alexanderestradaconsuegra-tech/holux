# Suscripciones MercadoPago — puesta en marcha

Importa `holu-suscripciones-mercadopago.json` en n8n. Trae dos webhooks.

## 1. Variables de entorno en n8n

El workflow lee las credenciales del entorno en vez de llevarlas escritas dentro
de los nodos, así no viajan en el JSON ni quedan en el historial de git:

| Variable | De dónde sale |
|---|---|
| `MP_ACCESS_TOKEN` | MercadoPago → Tus integraciones → tu aplicación → Credenciales de producción → Access Token |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` |

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

**Alta.** El panel llama a `POST /webhook/subscription-create` con
`{ restaurant_id, payer_email, plan }`. El workflow calcula el precio a partir
del plan (el navegador nunca manda el monto), crea el *preapproval* en
MercadoPago, guarda la fila en `subscriptions` con estado `pending` y devuelve
el `init_point`. El panel redirige ahí para que el dueño ponga su tarjeta.

**Confirmación.** MercadoPago avisa a `POST /webhook/mp-webhook`. El workflow
consulta `GET /preapproval/{id}` para leer el estado real desde la fuente —
nunca confía en lo que venga en el cuerpo de la notificación — y actualiza la
fila. Cuando el estado pasa a `authorized`, `access_state()` devuelve `active` y
la cuenta se abre sola, sin que nadie tenga que intervenir.

**Baja.** Si el dueño cancela o la tarjeta falla, MercadoPago manda otra
notificación con `cancelled` o `paused` y el acceso se cierra en la siguiente
carga del panel.

## 4. Planes

Los precios viven en el nodo `Validate Subscription` y en la constante `PLANS`
de `admin.jsx`. Si cambias uno, cambia el otro: el de n8n es el que cobra, el
del panel es solo el que se muestra.

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
