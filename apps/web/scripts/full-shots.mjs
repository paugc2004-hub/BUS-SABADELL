// utilitat local: captures de pàgina sencera a diverses mides (revisió visual)
// node scripts/full-shots.mjs <url> <dir> [w×h ...]
import { chromium } from '@playwright/test';
const [url = 'http://localhost:5199/', dir = '.', ...sizes] = process.argv.slice(2);
const list = sizes.length ? sizes : ['390x844', '1440x900'];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const s of list) {
  const [w, h] = s.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'ca-ES', timezoneId: 'Europe/Madrid', isMobile: w < 800, hasTouch: w < 800 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  // fa aparèixer les seccions (Reveal) recorrent la pàgina
  for (let y = 0; y < 20000; y += h / 2) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(900);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.screenshot({ path: `${dir}/full-${s}.png`, fullPage: true });
  await page.screenshot({ path: `${dir}/fold-${s}.png` });
  console.log(s, 'overflow-x:', over);
  await ctx.close();
}
await browser.close();
