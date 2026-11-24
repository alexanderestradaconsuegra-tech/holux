FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# EasyPanel pasa GIT_SHA en cada deploy: si cambia el commit, se reconstruye solo.
# (COPY . . ya invalida el caché cuando cambia cualquier archivo; no hay número que subir.)
ARG GIT_SHA=""
ENV GIT_SHA=$GIT_SHA
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Servidor propio (static-server.mjs): index.html siempre se revalida, así un deploy
# nuevo se ve al recargar. `serve` no mandaba Cache-Control.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/static-server.mjs ./static-server.mjs
EXPOSE 3000
CMD ["node", "static-server.mjs"]
