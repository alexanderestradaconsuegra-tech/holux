HOLU - producción

Archivos incluidos:
- admin.jsx
- mesa.jsx
- setup_github.sh

Variables de entorno necesarias:
- VITE_N8N_WEBHOOK_BASE o N8N_WEBHOOK_BASE

Webhooks que usa la app:
- /webhook/order-create
- /webhook/camarero-call
- /webhook/bill-request
- /webhook/feedback
- /webhook/receipt-print
- /webhook/cash-close

Notas:
- admin.jsx y mesa.jsx ya están preparados para apuntar a la base de n8n por variable de entorno.
- No subas /opt/data/.env al repo.
- Si vas a desplegar en Easy Panel, define la URL real de n8n en la variable de entorno del servicio.
