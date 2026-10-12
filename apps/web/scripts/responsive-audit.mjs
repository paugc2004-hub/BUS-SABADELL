/**
 * Auditoria responsive contra `vite preview` (port 4173): per a cada amplada i ruta, desbordament horitzontal,
 * elements interactius visibles que surten de la pantalla o fan menys de 24×24 px, i errors de consola.
 * Ús: PW_CHROMIUM_PATH=… node scripts/responsive-audit.mjs [amplades] [rutes…]
 */
import { chromium } from '@playwright/test';
const widths = (process.argv[2] ?? '320,360,390,430,768,1024,1440').split(',').map(Number);
const AT = 'hora=11:54&dia=2026-10-12';
const routes = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ['/', '/app', '/mapa', '/linia', '/linia/F4', '/parada/131', '/ruta/p278', '/com-hi-arribo', '/cerca', '/qr-lector', '/avisos', '/mes', '/oficina', '/titols', '/titols/comprar/t10', '/targetes', '/meus', '/compte/configuracio', '/tarifes', '/punts-de-venda', '/p/278'];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
let problems = 0;
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 760 ? 780 : 900 }, hasTouch: w < 760, isMobile: w < 760, geolocation: { longitude: 2.1035, latitude: 41.5463 }, permissions: ['geolocation'], serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    localStorage.setItem('nextmobility.session', JSON.stringify({ userId: 'demo', at: Date.now() }));
    localStorage.setItem('nextmobility.locAsked', '1');
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL|ERR_NAME|Failed to load resource/.test(m.text()) && errors.push(m.text()));
  for (const r of routes) {
    errors.length = 0;
    await page.goto(`http://localhost:4173${r}${r.includes('?') ? '&' : '?'}${AT}`);
    await page.waitForTimeout(1800);
    const res = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const over = document.documentElement.scrollWidth > vw + 1;
      const out = [];
      const small = [];
      for (const el of document.querySelectorAll('a, button, input, select, [role=button], summary, label.switch-row')) {
        const s = getComputedStyle(el);
        if (s.visibility === 'hidden' || s.display === 'none') continue;
        const b = el.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        // dins d'un contenidor amb scroll horitzontal (xips, carrusels) no compta
        let p = el.parentElement, scrolls = false;
        while (p) { const ps = getComputedStyle(p); if (/(auto|scroll)/.test(ps.overflowX) && p.scrollWidth > p.clientWidth) { scrolls = true; break; } p = p.parentElement; }
        const name = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30);
        if (!scrolls && (b.right > vw + 1 || b.left < -1)) out.push(name);
        if (el.closest('.maplibregl-ctrl-attrib, .sr-only, .pub-foot, .legal-links, footer')) continue;
        if (b.width < 24 || b.height < 24) small.push(`${name} ${Math.round(b.width)}×${Math.round(b.height)}`);
      }
      return { over, out: [...new Set(out)].slice(0, 6), small: [...new Set(small)].slice(0, 6) };
    });
    const bad = res.over || res.out.length || res.small.length || errors.length;
    if (bad) {
      problems++;
      console.log(`${w}px ${r}${res.over ? ' DESBORDA' : ''}${res.out.length ? ` fora: ${res.out.join(' | ')}` : ''}${res.small.length ? ` petits: ${res.small.join(' | ')}` : ''}${errors.length ? ` errors: ${errors.slice(0, 2).join(' | ')}` : ''}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(problems ? `${problems} pàgines amb incidències` : 'cap incidència');
