# Videos de la landing

Los videos de "Míralo en acción" se graban con el sistema real (datos de ejemplo y Supabase
simulado), se les agregan subtítulos con ffmpeg y quedan en `landing/public/videos/`.

| Archivo | Qué muestra | Script |
|---|---|---|
| `mesa-qr.mp4` | El cliente: QR, carta con fotos, detalle, nota y pedido | `mesa-qr.cjs` |
| `camarero.mp4` | Toma de pedidos en mesa y venta de mostrador | `panel-videos.cjs camarero` |
| `cocina.mp4` | Pantalla de cocina | `panel-videos.cjs cocina` |
| `caja.mp4` | Abrir caja, cobrar, dividir la cuenta | `panel-videos.cjs caja` |

## Regenerarlos (cuando cambie la interfaz)

Necesitas Playwright, `ffmpeg` y la fuente Inter. Desde la raíz del repo:

```bash
VITE_FORCE_VIEW=mesa  npx vite --port 5199 --host 127.0.0.1 &   # mesa
VITE_FORCE_VIEW=admin npx vite --port 5198 --host 127.0.0.1 &   # panel
(cd landing && npx next dev -p 3111 &)                           # ilustraciones de platos
cd landing/videos-src
node mesa-qr.cjs
node panel-videos.cjs            # los tres del panel (o uno: camarero | cocina | caja)
```

Cada video se graba una vez: los subtítulos salen de las marcas `cap('...')` de cada guion.
Son silenciosos (se reproducen solos, en bucle y sin sonido, como un GIF de buena calidad).

## Reemplazar por videos propios

Basta con subir un `.mp4` con el mismo nombre a `landing/public/videos/`. Mientras un archivo no
exista, la tarjeta de la landing muestra "Video en preparación".

## Fotos de platos

La landing usa ilustraciones (`landing/public/platos/*.svg`). Si subes `landing/public/platos/<nombre>.jpg`
con el mismo nombre (ceviche, empanada, lomo, pastel, leche, pisco, limonada, mote), la foto reemplaza
a la ilustración sola.
