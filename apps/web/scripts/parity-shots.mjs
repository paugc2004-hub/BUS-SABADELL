/**
 * Captures de les pantalles de paritat amb l'app de TUS (docs/TUS_PARITY.md) contra `vite preview` (port 4173).
 * Ús: node scripts/parity-shots.mjs <dir> 390x844 "/app=inici" "/mes=mes" …
 */
import { chromium } from "@playwright/test";
const out = process.argv[2];
const [w, h] = (process.argv[3] ?? '390x844').split('x').map(Number);
const pages = process.argv.slice(4);
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, geolocation: { longitude: 2.1035, latitude: 41.5463 }, permissions: ['geolocation'], serviceWorkers: 'block' });
await ctx.addInitScript(() => { localStorage.setItem('nextmobility.session', JSON.stringify({ userId: 'demo', at: Date.now() })); localStorage.setItem('nextmobility.locAsked', '1'); });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
for (const u of pages) {
  const i = u.lastIndexOf('=');
  const path = u.slice(0, i);
  const name = u.slice(i + 1);
  await p.goto('http://localhost:4173' + path);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  const ov = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(name, ov ? 'OVERFLOW' : 'ok');
}
await b.close();
