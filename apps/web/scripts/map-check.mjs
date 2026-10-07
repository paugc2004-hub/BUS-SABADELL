// Comprova que el mapa es pinta de debò (iPhone): node scripts/map-check.mjs <url> <captura.png>
import { chromium, devices } from '@playwright/test';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const p = await ctx.newPage();
p.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
await p.addInitScript(() => { localStorage.setItem('nextmobility.session', JSON.stringify({ userId: 'demo', at: Date.now() })); localStorage.setItem('nextmobility.locAsked', '1'); });
await p.goto(process.argv[2]);
await p.waitForSelector('[data-map-ready="1"]', { timeout: 30000 }).then(() => console.log('ready'), () => console.log('NOT ready'));
await p.waitForTimeout(1500);
await p.screenshot({ path: process.argv[3] });
await b.close();
