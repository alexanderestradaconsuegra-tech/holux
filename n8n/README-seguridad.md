# Auditoría de seguridad (nov. 2026) — qué se arregló y qué queda pendiente

Se hizo una auditoría completa de n8n, Supabase/RLS y las apps frontend.
Esto resume qué se corrigió ya (en producción) y qué queda pendiente,
para no perder el hilo en la próxima sesión.

## Ya corregido en producción

**n8n** (workflow "HOLU - Delivery (MercadoPago Checkout)", id `wjuez84ARaq2Qm9f`):
- Clave `service_role` de Supabase que estaba hardcodeada en texto plano en 16
  nodos → ahora usan `{{ $env.SUPABASE_SERVICE_ROLE_KEY }}`.
- Inyección de JSON sin escapar en `Save Basket`, `Insert Call1`, `Insert Order1`,
  `Insert Review1`, `Insert Bill Call1` → ahora usan `JSON.stringify` sobre un
  objeto real en vez de concatenar texto con comillas a mano.
- `order-create` (pedidos de mesa/kiosco) confiaba en el precio que mandaba el
  cliente → ahora un nodo nuevo (`Fetch Menu Prices1` → `Price Order1`) recalcula
  el precio real contra `menu_items`, igual que ya hacía `delivery-checkout`.
  `mesa.jsx`/`kiosco.jsx` ya mandan solo `menu_item_id`+`qty`.
- `staff-create`, `restaurant-onboard` y `activate-restaurant` no tenían NINGUNA
  autenticación — cualquiera podía crear un usuario admin para cualquier
  restaurante, crear restaurantes sin límite, o pedir un código de activación
  ajeno. Ahora los tres exigen el header `x-holu-internal-key` contra
  `$env.HOLU_INTERNAL_SECRET` (variable nueva — ver abajo).
- Se crearon y publicaron 3 workflows que estaban documentados en los README
  pero nunca se habían importado: `signup-free` (registro gratis — la landing
  ya lo llamaba, estaba roto en producción), `subscription-resubscribe`
  (reactivación — `admin.jsx` ya lo llamaba, estaba roto en producción), y
  `whatsapp-agent` (creado pero sin publicar, ver pendientes).
- `Create Restaurant1` interpolaba `restaurantName`/`legalName`/etc. a mano
  dentro de un string JSON (mismo patrón de inyección que ya se arregló en
  los otros nodos, pero este se había quedado afuera) → ahora usa
  `JSON.stringify` como el resto.
- **Verificación de correo obligatoria** antes de abrir el panel (nov. 2026):
  el registro gratis dejaba entrar al instante a cualquiera que llenara el
  formulario, sin confirmar que el correo fuera real. Ahora `Create
  Restaurant1` guarda un `email_verify_token`, el correo de bienvenida manda
  un botón "Confirmar mi correo", y `admin.jsx` bloquea el panel
  (`EmailUnverifiedScreen`) hasta que `restaurants.email_verified_at` se
  marca. Workflow separado `HOLU - Verificación de correo`
  (`OhKVgJZeAIRdPNsX`) con `verify-email` (GET) y `resend-verification`
  (POST, rate-limit de 2 min) — ver `README-registro-gratis.md` §4.
- CRM + aviso al admin (nov. 2026): cada cuenta creada (trial o pago)
  dispara un intento de WhatsApp al número del admin vía Evolution API
  (`Notify Admin WhatsApp1`, necesita la variable `EVOLUTION_ADMIN_INSTANCE`
  — sin ella, falla en silencio) y queda registrada como lead en el **Hub de
  Autix** (`Hub - Armar evento signup` → `Hub - Enviar evento`, `POST
  {{$env.HUB_URL}}/ingest` con `x-api-key: {{$env.HUB_API_KEY_HOLU}}`), el
  CRM cross-producto que ya usan el resto de los sistemas de Autix. Hubo
  brevemente una tabla `admin_leads` local además del Hub — se unificó en
  uno solo (el Hub) y se borró la tabla
  (`20261124150000_drop_admin_leads_unified_with_hub.sql`) para no mantener
  el mismo dato en dos lugares. Los tres nodos (`Notify Admin WhatsApp1`,
  `Hub - Armar evento signup`, `Hub - Enviar evento`) tienen
  `onError: continueRegularOutput` para que una falla ahí nunca bloquee la
  creación de la cuenta.

**Supabase** (migración `20260901000000_security_hardening_batch.sql`, aplicada):
- `apply_stock_movement()`/`recalc_table_bill()` sin `REVOKE` → cualquiera con
  la clave anon podía manipular inventario/cuenta de cualquier restaurante.
- `whatsapp_sessions`: policy sin `to authenticated` (aplicaba a `anon` también).
- `cancel_order()`: no validaba que `p_staff_id` perteneciera al restaurante.
- `set_staff_pin()`: cualquier empleado podía resetear el PIN de cualquier otro.
- Trigger nuevo que bloquea que un restaurante autenticado escriba directo
  `activated_at`/`trial_ends_at`/`mp_access_token` vía PATCH (auto-activación
  sin pagar).
- `claim_signup()`: condición de carrera que podía duplicar el aprovisionamiento
  si MercadoPago reintentaba la notificación muy rápido.

**Frontend**:
- `admin.jsx` ya no trae `mp_access_token` al navegador (antes cualquier
  empleado autenticado podía leer el token real de MercadoPago del restaurante).
- `mesa.jsx`/`kiosco.jsx` ya no mandan el precio calculado en cliente.
- `staff-login` (Edge Function): comparaba el PIN en texto plano contra el hash
  bcrypt — nunca coincidía, todo el personal operaba con la clave anon en vez
  de su propia sesión. Ahora usa el RPC `staff_login()` que sí compara bien.

- **Aislamiento entre restaurantes (24 nov. 2026).** `get_user_restaurant_id()`
  leía `user_metadata`, que el propio usuario puede editar: probado en vivo,
  un usuario del demo se cambió el `restaurant_id` y pasó a ver las filas de otro
  restaurante (cualquier usuario autenticado podía leer y escribir los datos de
  cualquier restaurante). Ahora el restaurante y el rol salen de `app_metadata`,
  que solo escribe el servidor: `restaurant-onboard`, `staff-create` y
  `staff-login` lo fijan al crear el usuario, los usuarios existentes se
  rellenaron, y `get_user_restaurant_id()` y `set_staff_pin()` leen solo
  `app_metadata` (migración `20261124180000_tenant_isolation_app_metadata.sql`).
  Se repitió el ataque después del cambio: `PUT /auth/v1/user` con `app_metadata`
  responde 403 y el usuario sigue viendo solo su restaurante. De paso se cerró
  `set_staff_pin`, que dejaba a un mozo hacerse pasar por administrador borrando
  su `staff_id` del metadata y cambiar el PIN de cualquiera. Los tokens
  anteriores no traen `app_metadata`: esas sesiones deben volver a iniciar sesión
  (el panel ya las manda al login).
- **Login por PIN.** La Edge Function `staff-login` no estaba desplegada
  (`/functions/v1/staff-login` respondía 404): el personal por PIN quedaba con la
  clave anónima y, como las políticas son `to authenticated`, no veía nada.
  Desplegada y probada en vivo (mozo y caja entran, un PIN malo da 401). Los
  administradores entran con correo y contraseña, no con PIN (`staff_login()`
  excluye `role = 'admin'` a propósito).
- **`whatsapp-agent`** usaba `fetch` dentro de un nodo Code y en esta instancia
  `fetch` no existe; ahora lleva un adaptador sobre `this.helpers.httpRequest`.
  Sigue sin publicar hasta que estén Evolution API y `ANTHROPIC_API_KEY`.

## Acción requerida AHORA en EasyPanel

Agregar `HOLU_INTERNAL_SECRET` como variable de entorno en el servicio de
n8n — es un string aleatorio largo (ej. `openssl rand -base64 32`). **Hasta
que esto se configure, `restaurant-onboard`/`staff-create`/`activate-restaurant`
rechazan todo con "No autorizado"**, lo que incluye crear cuentas nuevas por
suscripción o por registro gratis. No es opcional, es bloqueante.

## Pendiente (no resuelto todavía)

- **`whatsapp-agent`**: el workflow se creó pero se dejó **sin publicar**
  porque depende de Evolution API + `ANTHROPIC_API_KEY`, que no se confirmó
  que estén configurados. Publicarlo (`mcp__n8n__publish_workflow`) cuando
  esas credenciales estén listas. Usa `?key=HOLU_INTERNAL_SECRET` en la URL
  del webhook (no un header) porque Evolution API no siempre soporta headers
  custom — ver `README-whatsapp-agente.md`.
- **`restaurant_id` no se cruza con el `qr_token`/mesa real** en
  `camarero-call`, `bill-request`, `feedback` y `order-create` — el workflow
  confía en el `restaurant_id` que manda el body (con fallback silencioso a
  `'holu'` si falta), en vez de resolverlo desde la tabla `tables` por
  `qr_token`. Esto permite, en teoría, que un request con el `qr_token` real
  de un restaurante pero un `restaurant_id` distinto cree registros atribuidos
  al tenant equivocado.
- **`subscription-resubscribe`**: el monto está bien protegido (hardcodeado en
  servidor), pero el webhook no verifica que quien llama sea realmente dueño
  del `restaurant_id` que manda — alguien podría cancelar un intento de pago
  pendiente legítimo de otro restaurante (ver `start_resubscription()`, que
  borra intentos previos antes de crear uno nuevo). Arreglarlo bien requiere
  verificar la firma del JWT de Supabase dentro de n8n (HMAC con el JWT
  secret del proyecto, no solo decodificarlo) — no se implementó por no tener
  ese secreto a mano en esta sesión.
- **QR tokens de mesa predecibles**: se generan como `<slug-restaurante>-T1`
  a `-T5` — baja entropía, enumerable si se conoce un token real del mismo
  restaurante. No se cambió el formato para no invalidar los QR ya impresos
  de restaurantes existentes; si se decide arreglar, hay que regenerar los QR
  físicos también.
- **`mp-delivery-webhook`**: el `restaurant_id` para elegir qué token de
  MercadoPago usar al verificar un pago viene del query string de la propia
  notificación. El daño está acotado porque igual se re-verifica el pago
  contra la API real de MercadoPago con ese token, pero sería más prolijo
  derivarlo del `delivery_requests` asociado al pago en vez de confiar en el
  query param.
- Buena parte del esquema base (funciones como `get_user_restaurant_id()`,
  `resolve_qr()`, `activate_restaurant()`, y las policies de `orders`,
  `staff`, `tables`, etc.) no están versionadas en `supabase/migrations/` —
  existen en la base real pero no hay forma de auditar ni hacer rollback de
  cambios futuros ahí sin un `supabase db pull` que genere una migración
  baseline.
