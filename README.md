HOLU - producción

Este repo ya está listo para desplegar en Easy Panel.

Archivos clave
- admin.jsx: backoffice/admin + camarero
- mesa.jsx: experiencia cliente por QR
- src/main.jsx: entrada Vite para alternar entre admin y mesa
- Dockerfile: imagen de producción para Easy Panel
- .env.example: variables de entorno de ejemplo

Variables de entorno
- VITE_N8N_WEBHOOK_BASE
- N8N_WEBHOOK_BASE

Despliegue rápido en Easy Panel
1. Crear una app nueva llamada holus.
2. Conectar este repo.
3. Usar el Dockerfile del repo.
4. Definir las variables de entorno reales.
5. Exponer el puerto 3000.

Rutas útiles
- /?view=admin
- /?view=mesa

Notas
- No subas /opt/data/.env ni secretos al repo.
- Si tenías otro repo antiguo, déjalo como backup hasta validar este despliegue.
