# Delivery — puesta en marcha

Importa `holu-delivery-mercadopago.json` en n8n. Trae dos webhooks.

## 1. Variables de entorno

Las mismas de suscripciones, más una:

| Variable | Valor |
|---|---|
| `MP_ACCESS_TOKEN` | Access Token de MercadoPago |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` |
| `N8N_PUBLIC_URL` | `https://n8n-n8n.fa2cjf.easypanel.host` |
| `DELIVERY_PUBLIC_URL` | La URL pública de la página de pedidos, sin barra final |

## 2. Cómo funciona

**El pedido no existe hasta que está pagado.** Es la misma regla que aplicamos
al registro de restaurantes, y por la misma razón: si el pedido se creara al
enviar el formulario, cualquiera podría hacer cocinar gratis y descontar el
inventario de comida que nadie compró.

**Checkout.** La página llama a `POST /webhook/delivery-checkout` con el
restaurante, los datos del cliente y **solo los ids y las cantidades**. El
workflow lee los precios desde la base — el navegador nunca manda el monto, así
que una página editada no puede comprar un plato de $20.000 por $1. Valida
también el pedido mínimo y que el delivery esté habilitado. Guarda el carrito en
`delivery_requests` con estado `pending`, crea la preferencia en MercadoPago y
devuelve el `init_point`. **Todavía no hay pedido en cocina.**

**Confirmación.** MercadoPago avisa a `POST /webhook/mp-delivery-webhook`. El
workflow consulta `GET /v1/payments/{id}` para leer el estado desde la fuente —
nunca confía en el cuerpo de la notificación — y si está `approved` llama a
`claim_delivery_payment()`. Esa función crea el pedido, sus líneas (lo que
dispara el descuento de inventario) y la fila de reparto, **una sola vez**: los
reintentos de MercadoPago devuelven el mismo pedido sin cocinar nada dos veces.

**Seguimiento.** El cliente vuelve a la página con `?seguimiento=TOKEN`. Ese
token es su única credencial y `track_delivery()` corre como *definer*, así que
la llave anon sigue sin poder leer `orders`. Devuelve el avance y nada más: ni
otros pedidos, ni su teléfono o dirección de vuelta.

## 3. Configurar el webhook en MercadoPago

MercadoPago → Tus integraciones → tu aplicación → **Webhooks**.

- URL: `https://n8n-n8n.fa2cjf.easypanel.host/webhook/mp-delivery-webhook`
- Evento: **Pagos** (`payment`)

Es un webhook distinto al de suscripciones, porque son dos flujos distintos:
suscripción recurrente (preapproval) vs. pago único (Checkout Pro).

## 4. Configuración por restaurante

Vive en `restaurants.settings.delivery`:

```json
{
  "enabled": true,
  "fee": 3000,
  "min_order": 8000,
  "eta_minutes": 40,
  "zones": "Providencia, Ñuñoa y Las Condes"
}
```

Con `enabled: false` la página muestra "Delivery no disponible" y el checkout
rechaza el pedido — las dos cosas, para que apagarlo desde la base baste.

## 5. La URL que se le da al cliente

```
https://<tu-dominio-delivery>/?r=<restaurant_id>
```

Conviene un servicio aparte en EasyPanel con `Dockerfile.delivery`
(`VITE_FORCE_VIEW=delivery`), igual que mesa y kiosco.

## 6. Probar sin cobrar

Usa las credenciales de **prueba** de MercadoPago y una tarjeta de test.
Verifica que antes de pagar no exista ningún pedido en cocina, y que al aprobar
el pago aparezca el pedido, baje el stock según la receta y el reparto salga en
el panel de Delivery.
