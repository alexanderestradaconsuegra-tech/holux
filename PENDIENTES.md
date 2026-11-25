# HOLU — por hacer

## Siguiente
- **Carta de mesa (`mesa.jsx`)**: hechos el botón +, la tarjeta del plato, el contraste, el detalle
  por plato y, en el panel, subir foto (reducida, por carpeta de restaurante), alérgenos y detalle.
  Portada acortada con botón "Ver la carta" (24 nov.). Con esto la carta de mesa queda al día.
- **Toma de pedidos desde el panel (24 nov.)**: hecha (mesa y mostrador). Limitación: el mostrador
  es una sola mesa; si hay dos clientes a la vez, sus pedidos se suman en la misma cuenta, así que hay
  que cobrar uno antes de tomar el siguiente. Falta, si hace falta: dividir la cuenta por pedido.
- ~~Bug de números de pedido (n8n)~~: arreglado, ahora `ORD-` + 8 caracteres hex (probado con un pedido real).

- **Fotos del demo**: no hay. La idea del producto es que cada dueño suba las suyas en el panel (Carta → Editar)
  y se compartan solas en mesa, kiosco y delivery, porque las tres leen `menu_items.image_url`. Una foto
  subida al demo se pierde en el siguiente reseteo (cada 30 min).

- **Landing (25 nov.)**: sin plan A Medida, con copy de venta, 4 videos del sistema real y carta con platos
  ilustrados. Pendiente tuyo: fotos reales de platos (`landing/public/platos/<nombre>.jpg` reemplaza la
  ilustración sola), videos con voz si quieres (mismo nombre en `landing/public/videos/`), y revisar que la
  boleta electrónica con Tuu esté probada antes de anunciarla. Ver `landing/videos-src/README.md`.

## Después
- **WhatsApp en el aviso de fallos**: agregar en n8n `EVOLUTION_API_URL`,
  `EVOLUTION_API_KEY` y `EVOLUTION_ADMIN_INSTANCE`. Hoy el aviso sale solo por correo.
  (La misma `EVOLUTION_ADMIN_INSTANCE` activa el aviso de cuentas nuevas.)
- Dividir la cuenta por ítem.
- Captcha / rate limit en el registro gratis.
- Probar boleta real con una clave de pruebas de Tuu.
- `Save Basket` (delivery) arma el JSON a mano: arreglar antes de activar delivery a un cliente.

## Acciones tuyas
- Redesplegar `admin`, `kiosco` y `landing` en EasyPanel (ya no hay cachebust: revisa `/version.txt` de cada uno). Mesa ya está al día.
- Borrar los leads falsos de prueba en el Hub de Autix.
- Activar "Leaked password protection" en Supabase y confirmar backups.
- Cambiar o borrar la contraseña de la cuenta demo (`demo@holu.pro`).
