// utilitat local: genera public/og.png (1200×630) a partir d'una captura real de l'app
// node scripts/og-image.mjs [url]
import { chromium } from '@playwright/test';
const url = process.argv[2] ?? 'http://localhost:5199/?hora=08:15&dia=dimarts';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, locale: 'ca-ES', timezoneId: 'Europe/Madrid' })).newPage();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.hero', { timeout: 30000 });
await page.waitForTimeout(6000);
await page.screenshot({ path: 'public/og.png' });
await browser.close();
console.log('public/og.png');
