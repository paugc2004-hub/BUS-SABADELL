// utilitat local: captura de pantalla amb Chromium headless (no forma part de la build)
import { chromium, devices } from '@playwright/test';
const [, , url, out, mode = 'desktop', wait = '4000', ...actions] = process.argv;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext(mode === 'mobile' ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 }, locale: 'ca-ES', timezoneId: 'Europe/Madrid' });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(Number(wait));
for (const a of actions) {
  const kind = a.slice(0, a.indexOf('=')); const arg = a.slice(a.indexOf('=') + 1);
  if (kind === 'click') await page.click(arg, { timeout: 5000 }).catch((e) => logs.push('click fail ' + arg + ' ' + e.message));
  if (kind === 'eval') logs.push('eval: ' + JSON.stringify(await page.evaluate(arg)));
  if (kind === 'wait') await page.waitForTimeout(Number(arg));
  if (kind === 'type') await page.keyboard.type(arg);
}
await page.screenshot({ path: out });
console.log(logs.slice(0, 15).join('\n'));
await browser.close();
