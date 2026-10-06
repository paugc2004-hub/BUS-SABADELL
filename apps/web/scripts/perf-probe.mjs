// utilitat local: mesura el cost en temps d'execució d'una vista durant N segons
// node scripts/perf-probe.mjs <url> [segons=20] [desktop|mobile]
// Retorna: temps total de tasques llargues (> 50 ms), fps (rAF), heap i nodes DOM.
// Nota: Chromium sense GPU (SwiftShader): els valors absoluts són pessimistes; serveixen per comparar.
import { chromium, devices } from '@playwright/test';
const [, , url, secs = '20', mode = 'desktop', ...flags] = process.argv;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
const ctx = await browser.newContext(mode === 'mobile' ? { ...devices['Pixel 7'] } : { viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__lt = 0;
  window.__ltN = 0;
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      window.__lt += e.duration;
      window.__ltN++;
    }
  }).observe({ type: 'longtask', buffered: true });
});
if (flags.includes('--noanim')) await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}'; document.head.appendChild(st); }));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(6000); // càrrega i primer pintat del mapa fora de la mesura
const res = await page.evaluate(async (ms) => {
  const lt0 = window.__lt;
  const n0 = window.__ltN;
  let frames = 0;
  const t0 = performance.now();
  await new Promise((r) => {
    const f = () => {
      frames++;
      if (performance.now() - t0 < ms) requestAnimationFrame(f);
      else r();
    };
    requestAnimationFrame(f);
  });
  const dt = (performance.now() - t0) / 1000;
  return {
    seconds: Math.round(dt),
    longTaskMs: Math.round(window.__lt - lt0),
    longTasks: window.__ltN - n0,
    mainThreadBusyPct: Math.round(((window.__lt - lt0) / (dt * 1000)) * 100),
    fps: Math.round(frames / dt),
    heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
    domNodes: document.getElementsByTagName('*').length,
  };
}, Number(secs) * 1000);
console.log(JSON.stringify({ url, mode, ...res }));
await browser.close();
