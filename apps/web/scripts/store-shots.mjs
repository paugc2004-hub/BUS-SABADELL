// utilitat local: captures reals de l'app per al manifest (botigues i instal·lació): public/screenshots/*.png
// node scripts/store-shots.mjs   (amb el dev server a :5199)
import { chromium } from '@playwright/test';
const base = 'http://localhost:5199';
const AT = 'hora=08:15&dia=dimarts';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function run(size, list) {
  const [w, h] = size.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'ca-ES', timezoneId: 'Europe/Madrid', isMobile: w < 800, hasTouch: w < 800, geolocation: { longitude: 2.1035, latitude: 41.5463 }, permissions: ['geolocation'] });
  await ctx.addInitScript(() => (localStorage.setItem('nextmobility.session', JSON.stringify({ userId: 'demo', at: Date.now() })), localStorage.setItem('nextmobility.locAsked', '1')));
  const page = await ctx.newPage();
  for (const [name, path, prep] of list) {
    await page.goto(`${base}${path}${path.includes('?') ? '&' : '?'}${AT}`);
    await page.waitForSelector('canvas.maplibregl-canvas', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3500);
    if (prep) await prep(page);
    await page.screenshot({ path: `public/screenshots/${name}.png` });
    console.log(name);
  }
  await ctx.close();
}
await run('390x844', [
  ['home', '/app', async (p) => { await p.waitForSelector('.simple-title'); }],
  ['result', '/ruta/l206', async (p) => { await p.waitForSelector('.best', { timeout: 20000 }); await p.waitForTimeout(1500); }],
  ['stop', '/parada/176'],
]);
await run('1440x900', [['wide', '/ruta/l206', async (p) => { await p.waitForSelector('.best', { timeout: 20000 }); await p.waitForTimeout(1500); }]]);
await browser.close();
