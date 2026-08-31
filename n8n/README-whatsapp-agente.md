# Agente WhatsApp — puesta en marcha

Importa `holu-whatsapp-agente.json` en n8n **como workflow aparte** (no lo
pegues dentro del workflow grande de siempre — así evitamos el problema de
webhooks duplicados que ya nos pasó una vez con delivery). Trae un solo
webhook y un solo nodo de código: todo el loop del agente vive ahí adentro a
propósito, para minimizar lo que hay que cablear a mano en el editor.

## 1. Qué necesitás antes de activarlo

- Una instancia de **Evolution API** (self-hosted) con un número de WhatsApp
  conectado, una por restaurante.
- Una **API key de Anthropic** (`ANTHROPIC_API_KEY`) — se saca en
  [console.anthropic.com](https://console.anthropic.com).

## 2. Variables de entorno (en el servicio de n8n)

| Variable | Valor |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | La misma que ya usan delivery y suscripciones |
| `N8N_PUBLIC_URL` | `https://n8n-n8n.fa2cjf.easypanel.host` |
| `ANTHROPIC_API_KEY` | Tu API key de Anthropic |
| `EVOLUTION_API_URL` | La URL de tu instancia de Evolution API, sin barra final |
| `EVOLUTION_API_KEY` | La API key de esa instancia |

## 3. Cómo funciona

**Un mensaje, un ciclo completo.** Cuando Evolution API recibe un mensaje de
WhatsApp, le pega a `POST /webhook/whatsapp-agent`. El nodo de código:

1. Lee de qué **instancia** vino el mensaje y busca qué restaurante la tiene
   configurada (`restaurants.settings.whatsapp_agent.evolution_instance`). Si
   ninguno la tiene, o el agente está apagado, no hace nada.
2. Carga (o crea) la conversación en `whatsapp_sessions` — ahí vive el
   historial y el carrito que el agente va armando con ese cliente.
3. Trae la **carta en vivo** del restaurante — el agente nunca inventa platos
   ni precios, solo puede ofrecer lo que ya está publicado en Carta.
4. Llama a Claude con ese contexto y 5 herramientas: `add_item`,
   `remove_item`, `view_cart`, `checkout`, `escalate_human`. Si Claude pide
   usar una, el código la ejecuta y le devuelve el resultado — hasta 5 vueltas
   por mensaje, para que no quede pensando en loop.
5. Manda la respuesta final por WhatsApp con la API de Evolution.
6. Guarda la conversación actualizada.

**El pedido entra a cocina por el mismo camino que delivery.** La herramienta
`checkout` no crea el pedido directo — le pega a `POST
/webhook/delivery-checkout`, el mismo webhook que ya usa la página de
delivery. Eso significa que el pedido de WhatsApp pasa por las mismas
validaciones (precios desde la base, pedido mínimo, stock) y termina en la
misma cola de MercadoPago → confirmación → cocina. No hay un camino paralelo
que mantener.

**Si algo se escapa de lo que el agente puede resolver** (un reclamo, una
pregunta rara, un pedido fuera de la carta), usa `escalate_human`: crea una
fila en `calls` con `source: "whatsapp"`, así que le llega al camarero o al
admin en la misma pantalla de Llamados que ya usan para las mesas.

## 4. Activarlo por restaurante

Desde el admin → Configuración → **Agente de WhatsApp**:

- Activar el toggle
- Poner el **nombre de instancia** exacto que le pusiste en Evolution API
- (Opcional) describir la personalidad — "cercano y con emojis", "formal y
  directo", lo que sea — el agente lo usa como tono de voz

Esto se guarda en `restaurants.settings.whatsapp_agent` — no toca ninguna
tabla nueva del lado del restaurante, es el mismo patrón que ya usan Delivery
y el token de MercadoPago.

## 5. Conectar el webhook en Evolution API

En la configuración de la instancia de Evolution API, poné como webhook:

```
https://n8n-n8n.fa2cjf.easypanel.host/webhook/whatsapp-agent
```

Evento: mensajes entrantes (`messages.upsert` o el que use tu versión de
Evolution API).

## 6. Probar

Escribile al número de WhatsApp conectado a esa instancia. Pedí un plato,
confirmá con tu dirección, y verificá que:

- El agente solo ofrece platos que están en la Carta y con el precio real
- Al pagar, el pedido aparece en `delivery_requests` como cualquier otro
  pedido de delivery, y el link de pago realmente abre MercadoPago
- Si le escribís algo raro ("quiero hablar con el dueño"), aparece un llamado
  nuevo en el panel de Llamados del restaurante
