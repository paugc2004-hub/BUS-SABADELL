// Lighthouse (mòbil) amb el Chromium de Playwright: node scripts/lighthouse.mjs <url>
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
const url = process.argv[2] ?? 'https://bus-sabadell.vercel.app/';
const gpu = process.argv.includes('--gpu');
const browser = await chromium.launch({ ...(gpu ? { channel: 'chromium' } : {}), args: ['--remote-debugging-port=9333', ...(gpu ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] : [])] });
const r = await lighthouse(url, { port: 9333, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices'], formFactor: 'mobile' });
await browser.close();
const lhr = r.lhr;
for (const [k, c] of Object.entries(lhr.categories)) console.log(k.padEnd(16), Math.round(c.score * 100));
for (const id of ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index'])
  console.log(' ', id.padEnd(26), lhr.audits[id].displayValue);
for (const [id, a] of Object.entries(lhr.audits))
  if (a.score !== null && a.score < 0.9 && !['informative', 'notApplicable', 'manual'].includes(a.scoreDisplayMode)) console.log('  ✗', id, a.score, a.displayValue ?? '');
for (const id of ['button-name', 'label-content-name-mismatch', 'color-contrast', 'font-size', 'target-size'])
  for (const it of lhr.audits[id]?.details?.items ?? []) console.log('   ·', id, it.node?.selector ?? it.selector ?? '', it.node?.snippet?.slice(0, 120) ?? '');
