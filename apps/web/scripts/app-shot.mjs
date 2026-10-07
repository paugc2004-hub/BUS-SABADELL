// utilitat local: captura d'una vista de l'app (amb el compte de demostració)
// node scripts/app-shot.mjs <url> <fitxer.png> [w×h]
import { chromium } from '@playwright/test';
const [url, out, size = '390x844'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'ca-ES', timezoneId: 'Europe/Madrid', isMobile: w < 800, hasTouch: w < 800 });
await ctx.addInitScript(() => localStorage.setItem('nextmobility.session', JSON.stringify({ userId: 'demo', at: Date.now() })));
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas.maplibregl-canvas', { timeout: 30000 }).catch(() => undefined);
await page.waitForTimeout(5000);
await page.screenshot({ path: out });
await browser.close();
