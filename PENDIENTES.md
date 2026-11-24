# HOLU — por hacer

## Siguiente
- **Carta de mesa (`mesa.jsx`)**: hechos el botón +, la tarjeta del plato, el contraste, el detalle
  por plato y, en el panel, subir foto (reducida, por carpeta de restaurante), alérgenos y detalle.
  Portada acortada con botón "Ver la carta" (24 nov.). Con esto la carta de mesa queda al día.
- **Terminal de ventas / toma de pedidos desde el panel**: hoy el personal no puede
  ingresar un pedido (ni venta de mostrador) desde `admin.jsx`; solo cobra lo que llega
  por QR/kiosco. Ver conversación del 24 nov. 2026.

## Después
- **WhatsApp en el aviso de fallos**: agregar en n8n `EVOLUTION_API_URL`,
  `EVOLUTION_API_KEY` y `EVOLUTION_ADMIN_INSTANCE`. Hoy el aviso sale solo por correo.
  (La misma `EVOLUTION_ADMIN_INSTANCE` activa el aviso de cuentas nuevas.)
- Dividir la cuenta por ítem.
- Captcha / rate limit en el registro gratis.
- Probar boleta real con una clave de pruebas de Tuu.
- `Save Basket` (delivery) arma el JSON a mano: arreglar antes de activar delivery a un cliente.

## Acciones tuyas
- Redesplegar `admin`, `mesa` y `landing` en EasyPanel (subir `cachebust`).
- Borrar los leads falsos de prueba en el Hub de Autix.
- Activar "Leaked password protection" en Supabase y confirmar backups.
- Cambiar o borrar la contraseña de la cuenta demo (`demo@holu.pro`).
