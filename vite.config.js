import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// Sello de versión: cuándo se construyó y desde qué commit. Así, después de un deploy,
// se puede comprobar en 5 segundos si de verdad quedó la versión nueva:
//   * archivo /version.txt del servicio (hora, vista admin/mesa/..., commit)
//   * etiqueta chica en el panel (abajo a la izquierda) y en la portada de la mesa
// El commit lo entrega EasyPanel como build arg (GIT_SHA) y el Dockerfile lo pasa
// aquí; en local se lee con git.
const commit = () => {
  const fromEnv = process.env.GIT_SHA || process.env.SOURCE_COMMIT || process.env.COMMIT_SHA || ''
  if (fromEnv) return fromEnv.slice(0, 7)
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return '' }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const sha = commit()
  const when = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
  const stamp = sha ? `${when} · ${sha}` : when
  return {
    plugins: [
      react(),
      {
        name: 'holu-version-file',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'version.txt',
            source: `HOLU build ${stamp}\nvista: ${env.VITE_FORCE_VIEW || 'selector'}\ncommit: ${sha || 'desconocido'}\n`,
          })
        },
      },
    ],
    define: { __HOLU_BUILD__: JSON.stringify(stamp) },
    build: { outDir: 'dist' },
  }
})
