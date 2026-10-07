// utilitat local: el flux de l'app de cap a cap (entrar → ubicació → inici → destí → millor opció → bus)
// node scripts/flow-shots.mjs <dir> [w×h=390x844] [destí=hospital parc tauli]
import { chromium } from '@playwright/test';
const [dir = '.', size = '390x844', q = 'hospital parc tauli'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'ca-ES', timezoneId: 'Europe/Madrid', isMobile: w < 800, hasTouch: w < 800, geolocation: { longitude: 2.1035, latitude: 41.5463 }, permissions: ['geolocation'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
const shot = async (n) => { await page.waitForTimeout(1500); await page.screenshot({ path: `${dir}/flow-${n}-${size}.png` }); console.log(n); };
await page.goto('http://localhost:5199/app?hora=08:15&dia=dimarts');
await shot('1-login');
await page.getByRole('button', { name: /sense compte/i }).click();
await shot('2-location');
await page.getByRole('button', { name: /Permet la ubicació/ }).click();
await page.waitForSelector('.simple-title');
await shot('3-home');
await page.getByRole('combobox').fill(q);
await page.waitForSelector('.sr-item');
await shot('4-search');
await page.locator('.sr-item').first().click();
await page.waitForSelector('.best', { timeout: 20000 });
await shot('5-result');
const where = page.getByRole('button', { name: /On és el bus/ });
if (await where.count()) { await where.click(); await shot('6-bus'); await page.locator('.bus-card .cta-primary').click(); await shot('7-trip'); }
await browser.close();
