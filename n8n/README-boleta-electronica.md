# Boleta electrónica (Tuu / Haulmer) — puesta en marcha

Mismo diseño que el módulo DTE de Merka POS: **cada restaurante trae su propia
clave de API de Tuu/Haulmer** (nunca una compartida), se guarda cifrada y la
emisión pasa por un workflow de n8n que habla con la API del proveedor.

Workflow: **`HOLU - Boleta electrónica (Tuu)`** (id `TROwkSxloLfiJFfq`), separado
del combinado. Un webhook y un nodo Code con toda la lógica:

| Qué | Dónde |
|---|---|
| Webhook | `POST /webhook/holu-dte` |
| Lógica | `n8n/holu-dte.code.js` (es exactamente lo que corre el nodo `DTE`) |
| Pruebas | `node n8n/tests/holu-dte.test.cjs` (35 casos, Supabase y Haulmer simulados) |
| Datos | migración `20261124170000_dte_boleta_electronica.sql` |

**Variables de entorno:** ninguna nueva. Usa `SUPABASE_SERVICE_ROLE_KEY` y
`N8N_PUBLIC_URL`, que el servicio de n8n ya tiene.

## Cómo la activa un restaurante

Panel → **Configuración → Boleta electrónica (Tuu / Haulmer)** (solo el
administrador la ve):

1. Pegar la clave de API (panel de Tuu/Haulmer → API) y elegir **Pruebas**.
2. **Guardar** y luego **Probar conexión**: trae RUT, razón social y giro del
   emisor desde Haulmer. Sin esto no se emite nada.
3. Marcar **Activa** y elegir qué medios de pago llevan boleta.
4. Cuando las pruebas salgan bien, cambiar a **Producción** (con una clave de
   producción) y volver a probar la conexión. Cambiar de ambiente o de clave
   deja la conexión como "sin probar" a propósito.

## Cómo funciona

- Al cerrar una mesa, `pay_table_part` deja un **ticket** (`table_tickets`:
  consumo con IVA, método de pago, líneas) y devuelve su id. El panel pide la
  boleta de ese ticket **después** del cobro: si la boleta falla, el cobro ya
  está hecho y se reintenta desde **Caja → Boletas del día**.
- La **propina no entra a la boleta** (es voluntaria y va aparte).
- Idempotencia: `Idempotency-Key = holu-<restaurante>-<ticket>`; si Haulmer
  responde `OF-06` (ya emitida) se recupera el folio del original. Un documento
  ya emitido nunca se pisa (`fiscal_save_document`).
- Anular = **nota de crédito** (tipo 61, montos en neto) que referencia la
  boleta. Solo el administrador.
- La clave API vive en **Supabase Vault** (`dte_key:<restaurant_id>`) y solo la
  puede leer el `service_role` (n8n). El panel ve únicamente los últimos 4
  caracteres. El token de cada documento tampoco se le entrega al panel.

## Seguridad: por qué no se confía en `user_metadata`

El webhook valida el JWT contra `/auth/v1/user` y luego **comprueba en la tabla
`staff`** que esa persona trabaja en ese restaurante y con qué rol. Un usuario
puede editar su propio `user_metadata` (`restaurant_id`, `staff_role`), así que
decidir con eso permitiría actuar sobre otro restaurante. Probado en vivo: un
mozo cuyo metadata dice `admin` recibe 403 al configurar o anular.

Consecuencia: el **dueño** (login con correo) debe tener una fila `role='admin'`
en `staff` con su mismo correo. El registro automático la crea; el restaurante
`holu` no la tenía y se agregó a mano.

## Lecciones (n8n de esta instancia)

- En un nodo Code **`fetch` no existe** (`fetch is not defined`). Usar
  `this.helpers.httpRequest` (con `ignoreHttpStatusErrors` y
  `returnFullResponse`), igual que el módulo de Merka. `$env` sí funciona.
- Un `Respond to Webhook` acepta una expresión en `responseCode`.

## Antes de usarla con clientes reales

- Probar una emisión real contra `dev-api.haulmer.com` con una clave de
  **pruebas** (todo lo demás está probado con la API simulada y en vivo hasta el
  rechazo de una clave falsa).
- La cuenta de Tuu/Haulmer de cada restaurante necesita el documento
  *Boleta electrónica* habilitado y folios (CAF) cargados.
- Pendiente de producto: la "boleta" que imprime el panel hoy (`BOLETA MESA`)
  es una pre-cuenta sin validez tributaria; con la facturación activa conviene
  renombrarla.
