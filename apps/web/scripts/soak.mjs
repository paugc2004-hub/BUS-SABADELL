// Prova de resistència del mode presentació: N minuts, mostra heap JS i fps cada 30 s.
import { chromium } from '@playwright/test';
const minutes = Number(process.argv[2] ?? 8);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:4173/presentacio?hora=07:30&dia=dimarts&x=10');
await p.waitForTimeout(8000);
await p.evaluate(() => { window.__frames = 0; const f = () => { window.__frames++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
const cdp = await p.context().newCDPSession(p);
const rows = [];
for (let i = 0; i <= minutes * 2; i++) {
  await cdp.send('HeapProfiler.collectGarbage');
  const heap = await p.evaluate(() => performance.memory.usedJSHeapSize / 1048576);
  const f0 = await p.evaluate(() => window.__frames);
  await p.waitForTimeout(i === minutes * 2 ? 1000 : 30000);
  const f1 = await p.evaluate(() => window.__frames);
  const fps = (f1 - f0) / (i === minutes * 2 ? 1 : 30);
  const nodes = await p.evaluate(() => document.getElementsByTagName('*').length);
  rows.push({ t: `${(i / 2).toFixed(1)} min`, heapMB: heap.toFixed(1), fps: fps.toFixed(0), dom: nodes });
  console.log(JSON.stringify(rows[rows.length - 1]));
}
await b.close();
