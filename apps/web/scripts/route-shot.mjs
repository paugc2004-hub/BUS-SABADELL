// utilitat local: prova el planificador («On vas?») amb una ubicació simulada i en fa captures
// node scripts/route-shot.mjs <dir> [consulta=sant pere] [w×h=390x844] [lon,lat]
import { chromium } from '@playwright/test';
const [dir = '.', q = 'sant pere', size = '390x844', pos = '2.0866,41.5759'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const [lon, lat] = pos.split(',').map(Number);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'ca-ES', timezoneId: 'Europe/Madrid', isMobile: w < 800, hasTouch: w < 800, geolocation: { longitude: lon, latitude: lat }, permissions: ['geolocation'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:5199/app?hora=08:15&dia=dimarts', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas.maplibregl-canvas', { timeout: 30000 });
await page.getByRole('combobox').fill(q);
await page.waitForSelector('.sr-item[id^="sr-c"], .sr-item[id^="sr-l"]', { timeout: 15000 });
await page.screenshot({ path: `${dir}/route-search-${size}.png` });
await page.locator('.sr-item[id^="sr-c"], .sr-item[id^="sr-l"]').first().click();
await page.waitForSelector('.plan-option', { timeout: 20000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${dir}/route-${size}.png` });
console.log(await page.locator('.route-panel').innerText());
await browser.close();
