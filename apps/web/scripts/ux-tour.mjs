// utilitat local: recorregut de l'app a una mida (captures de cada pantalla) per a l'auditoria
// node scripts/ux-tour.mjs <dir> [w×h=390x844] [prefix]
import { chromium } from '@playwright/test';
const [dir = '.', size = '390x844', prefix = 'tour'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const AT = 'hora=08:15&dia=dimarts';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'ca-ES', timezoneId: 'Europe/Madrid', isMobile: w < 800, hasTouch: w < 800, geolocation: { longitude: 2.1035, latitude: 41.5463 }, permissions: ['geolocation'] });
await ctx.addInitScript(() => localStorage.setItem('nextmobility.session', JSON.stringify({ userId: 'demo', at: Date.now() })));
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
const shot = async (name) => { await page.waitForTimeout(1800); await page.screenshot({ path: `${dir}/${prefix}-${name}-${size}.png` }); console.log(name); };
const go = async (path) => { await page.goto(`http://localhost:5199${path}${path.includes('?') ? '&' : '?'}${AT}`); await page.waitForSelector('canvas.maplibregl-canvas', { timeout: 30000 }).catch(() => {}); };
await go('/app'); await shot('home');
await page.evaluate(() => window.scrollTo(0, 0));
await go('/parada/176'); await shot('stop');
const a = page.locator('.arrival-main:not([disabled])').first();
if (await a.count()) { await a.click(); await shot('bus'); }
await go('/linia'); await shot('lines');
await go('/linia/L2'); await shot('line');
await go('/mapa'); await shot('map');
await go('/meus'); await shot('mine');
await go('/xarxa'); await shot('network');
await go('/app');
const take = page.locator('.hero .cta-primary');
if (await take.count()) { await take.click(); await shot('trip'); }
await browser.close();
