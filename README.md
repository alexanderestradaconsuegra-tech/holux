HOLU - producción

Estructura
- admin.jsx: backoffice/admin + camarero
- mesa.jsx: experiencia cliente por QR
- src/main.jsx: entrada Vite para alternar entre admin y mesa
- setup_github.sh: helper para bootstrap de repo GitHub
- .env.example: variables de entorno de ejemplo

Variables de entorno
- VITE_N8N_WEBHOOK_BASE
- N8N_WEBHOOK_BASE

Notas
- No subas /opt/data/.env ni secretos al repo.
- En Easy Panel define la URL real de n8n en las variables del servicio.
- Para ver la app:
  - /?view=admin
  - /?view=mesa
