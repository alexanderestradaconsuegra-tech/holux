// Servidor estático de los servicios HOLU (reemplaza a `serve`).
//
// Por qué existe: `serve` no manda Cache-Control, así que después de un deploy el
// navegador puede seguir usando el index.html anterior un buen rato (por la fecha de
// modificación) y "no se ve nada". Aquí:
//   * index.html, version.txt y todo lo que no está en /assets/ -> `no-cache`
//     (el navegador siempre pregunta; si no cambió, responde 304 sin descargar nada);
//   * /assets/* (nombres con hash) -> inmutables por un año;
//   * rutas desconocidas sin extensión caen en index.html (la app es de una sola página).
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), process.env.STATIC_DIR || 'dist')
const PORT = Number(process.env.PORT) || 3000

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.map': 'application/json',
}
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.txt', '.svg', '.map'])
const gzipCache = new Map()

const stat = (p) => { try { const s = fs.statSync(p); return s.isFile() ? s : null } catch { return null } }

const resolveFile = (urlPath) => {
  let decoded
  try { decoded = decodeURIComponent(urlPath) } catch { return { bad: true } }
  if (decoded.includes('\0')) return { bad: true }
  const full = path.join(ROOT, path.normalize(decoded))
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return { bad: true }
  let file = full
  let st = stat(file)
  if (!st) { const idx = path.join(full, 'index.html'); if (stat(idx)) { file = idx; st = stat(idx) } }
  if (st) return { file, st }
  // Archivo con extensión que no existe: 404 de verdad (no el index.html).
  if (path.extname(decoded)) return { missing: true }
  const index = path.join(ROOT, 'index.html')
  return { file: index, st: stat(index) }
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end() }
  const url = new URL(req.url, 'http://x')
  const r = resolveFile(url.pathname)
  if (r.bad) { res.writeHead(400); return res.end('Bad request') }
  if (r.missing || !r.st) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end('No encontrado') }

  const ext = path.extname(r.file).toLowerCase()
  const hashed = url.pathname.startsWith('/assets/')
  const etag = `W/"${r.st.size.toString(16)}-${Math.floor(r.st.mtimeMs).toString(16)}"`
  const headers = {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    ETag: etag,
    'Last-Modified': r.st.mtime.toUTCString(),
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Accept-Encoding',
  }
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end() }

  const wantsGzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')
  if (wantsGzip) {
    const key = `${r.file}:${etag}`
    let gz = gzipCache.get(key)
    if (!gz) { gz = zlib.gzipSync(fs.readFileSync(r.file)); gzipCache.set(key, gz) }
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': gz.length })
    return res.end(req.method === 'HEAD' ? undefined : gz)
  }
  res.writeHead(200, { ...headers, 'Content-Length': r.st.size })
  if (req.method === 'HEAD') return res.end()
  fs.createReadStream(r.file).pipe(res)
})

server.listen(PORT, '0.0.0.0', () => console.log(`HOLU static server: ${ROOT} en :${PORT}`))
