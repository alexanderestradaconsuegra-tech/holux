// Herramientas para grabar los videos de la landing: se graba el sistema real (con datos de
// ejemplo, Supabase simulado) con Playwright y se le agregan subtítulos con ffmpeg.
//   Requisitos: playwright, ffmpeg, la fuente Inter, y la app a grabar corriendo en local
//   (mesa/panel con `VITE_FORCE_VIEW=mesa|admin npx vite --port ...`, landing con `next dev -p 3111`).
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const FONT = '/usr/share/fonts/opentype/inter/Inter-Bold.otf';
const OUT = path.resolve(__dirname, '..', 'public', 'videos');
const TMP = path.resolve(__dirname, '.tmp');
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const fakeJwt = (role, staff) => `${b64({ alg: 'HS256' })}.${b64({ iss: 'supabase', role: 'authenticated', app_metadata: { restaurant_id: 'demo', role, staff_id: staff }, exp: Math.floor(Date.now() / 1000) + 7200 })}.sig`;
const wrap = (text, n) => { const out = []; let line = ''; for (const w of text.split(' ')) { if ((line + ' ' + w).trim().length > n) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); } if (line) out.push(line); return out.join('\n'); };

// Graba un guion. `scene(page, cap, sleep)`; cap('texto') marca un subtítulo desde ese instante.
async function record({ name, viewport, scale = 1, setupContext, scene }) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 500, hasTouch: viewport.width < 500, recordVideo: { dir: TMP, size: { width: viewport.width, height: viewport.height } } });
  if (setupContext) await setupContext(ctx);
  const page = await ctx.newPage();
  const t0 = Date.now(); const caps = [];
  const now = () => (Date.now() - t0) / 1000;
  const cap = (text) => { if (caps.length) caps[caps.length - 1].end = now(); caps.push({ text, start: now() + 0.15, end: null }); };
  const sleep = (s) => page.waitForTimeout(s * 1000);
  await scene(page, cap, sleep);
  if (caps.length) { caps[caps.length - 1].end = now() + 0.8; }
  await sleep(0.8);
  const total = now();
  const video = page.video();
  await ctx.close(); await browser.close();
  const webm = path.join(TMP, `${name}.webm`);
  fs.copyFileSync(await video.path(), webm);
  return { webm, caps, total };
}

// Compone el mp4 final: layout 'phone' (celular a la derecha, subtítulo grande a la izquierda)
// o 'wide' (pantalla completa con barra de subtítulo abajo).
function compose({ name, webm, caps, layout }) {
  const files = caps.map((c, i) => { const f = path.join(TMP, `${name}-cap${i}.txt`); fs.writeFileSync(f, wrap(c.text, layout === 'phone' ? 20 : 54)); return f; });
  const en = (c) => `enable='between(t,${c.start.toFixed(2)},${c.end.toFixed(2)})'`;
  let graph;
  if (layout === 'phone') {
    const dt = caps.map((c, i) => `drawtext=fontfile=${FONT}:textfile=${files[i]}:fontcolor=white:fontsize=50:line_spacing=12:x=90:y=(h-text_h)/2:${en(c)}`).join(',');
    graph = `color=c=0x0d0a07:s=1280x800[bg];[0:v]scale=-2:720[ph];[bg][ph]overlay=x=W-w-130:y=40:shortest=1[o];[o]drawbox=x=90:y=300-34:w=70:h=6:color=0xf0d48d:t=fill,drawtext=fontfile=${FONT}:text='HOLU':fontcolor=0xf0d48d:fontsize=34:x=90:y=70,${dt}[out]`;
  } else {
    const dt = caps.map((c, i) => `drawtext=fontfile=${FONT}:textfile=${files[i]}:fontcolor=white:fontsize=38:line_spacing=8:x=(w-text_w)/2:y=680+(120-text_h)/2:${en(c)}`).join(',');
    // El video se graba a 1280x680 y la franja de subtítulos va debajo, sin tapar nada.
    graph = `[0:v]pad=1280:800:0:0:color=0x0d0a07,drawbox=y=680:w=iw:h=2:color=0xf0d48d@0.45:t=fill,${dt}[out]`;
  }
  const mp4 = path.join(OUT, `${name}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-filter_complex', graph, '-map', '[out]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-preset', 'medium', '-r', '25', '-movflags', '+faststart', '-an', mp4]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '3', '-i', mp4, '-frames:v', '1', '-q:v', '3', path.join(OUT, `${name}.jpg`)]);
  return mp4;
}
module.exports = { record, compose, json, fakeJwt, OUT, TMP };
