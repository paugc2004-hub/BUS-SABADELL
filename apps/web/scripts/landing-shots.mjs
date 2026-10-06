// utilitat local: captures reals de l'app per a la landing (public/landing/*.jpg)
// node scripts/landing-shots.mjs [base=http://localhost:5199]
import { chromium, devices } from '@playwright/test';
const base = process.argv[2] ?? 'http://localhost:5199';
const AT = 'hora=08:15&dia=dimarts';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const session = () => localStorage.setItem('nextmobility.session', JSON.stringify({ userId: 'demo', at: Date.now() }));
async function shot(name, path, mobile, prepare) {
  const ctx = await browser.newContext(mobile ? { ...devices['iPhone 13'], locale: 'ca-ES', timezoneId: 'Europe/Madrid' } : { viewport: { width: 1440, height: 900 }, locale: 'ca-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(session);
  const page = await ctx.newPage();
  await page.goto(`${base}${path}${path.includes('?') ? '&' : '?'}${AT}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas.maplibregl-canvas', { timeout: 30000 });
  await page.waitForTimeout(6500);
  if (prepare) await prepare(page);
  await page.screenshot({ path: `public/landing/${name}.jpg`, type: 'jpeg', quality: 82 });
  await ctx.close();
  console.log(name);
}
await shot('home-mobile', '/app', true);
await shot('bus-mobile', '/parada/176', true, async (p) => {
  await p.locator('.arrival-main:not([disabled])').nth(1).click();
  await p.waitForTimeout(2500);
});
await shot('map-desktop', '/linia/L2', false);
await shot('network-desktop', '/xarxa', false);
await browser.close();
