// utilitat local: recorre el mode presentació escena a escena i en desa captures
// node scripts/demo-run.mjs <url> <carpeta> [desktop|mobile]
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const [, , url = 'http://localhost:5199/presentacio?hora=08:15&dia=dimarts', dir = 'demo-shots', mode = 'desktop'] = process.argv;
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext(mode === 'mobile' ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 }, locale: 'ca-ES', timezoneId: 'Europe/Madrid' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.caption', { timeout: 30000 });
await page.waitForTimeout(5000);
// pausa: les escenes es passen a mà
await page.keyboard.press(' ');
for (let i = 1; i <= 7; i++) {
  await page.screenshot({ path: `${dir}/scene-${i}.png` });
  const cap = await page.locator('.caption h2').innerText();
  console.log(`escena ${i}: ${cap}`);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(i === 3 ? 3500 : 2500);
}
// escena 8 en marxa: espera l'avís real "a 2 parades"
await page.keyboard.press(' ');
let toast = '';
for (let k = 0; k < 40 && !/2 parades|2 paradas/.test(toast); k++) {
  await page.waitForTimeout(700);
  toast = (await page.locator('.toasts').innerText().catch(() => '')) || toast;
}
await page.screenshot({ path: `${dir}/scene-8.png` });
console.log('escena 8, avís:', JSON.stringify(toast));
console.log('trip:', JSON.stringify(await page.locator('.trip-card').innerText().catch(() => '')));
for (const k of [9, 10]) { await page.waitForTimeout(k === 9 ? 3500 : 0); if (k === 10) { await page.keyboard.press(' '); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(2500); } await page.screenshot({ path: dir + '/scene-' + k + '.png' }); console.log('escena', k, await page.locator('.caption h2').innerText()); }
console.log('errors:', errors.slice(0, 8));
await browser.close();
