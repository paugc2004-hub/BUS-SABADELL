/**
 * Qualitat transversal: accessibilitat automàtica (axe-core, WCAG 2.1 A/AA), res desborda a 320 px,
 * estats de càrrega i d'error de la cerca i ubicació que no arriba (temps esgotat).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AT = 'hora=08:15&dia=dimarts';

const DEMO_SESSION = () => {
  localStorage.setItem('nextmobility.session', JSON.stringify({ userId: 'demo', at: Date.now() }));
  localStorage.setItem('nextmobility.locAsked', '1');
};

/** violacions WCAG 2.1 A/AA; el canvas del mapa és WebGL (té alternativa: llistes de parades i línies) */
async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.maplibregl-canvas').analyze();
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
}

async function noHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, `amplada del document ${sw}px > pantalla ${cw}px`).toBeLessThanOrEqual(cw);
}

test.describe('accessibilitat (axe-core)', () => {
  // un sol projecte n'hi ha prou: l'HTML és el mateix; el mòbil ja el cobreix la prova de 320 px
  // eslint-disable-next-line no-empty-pattern -- Playwright exigeix desestructurar les fixtures
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'només escriptori'));

  test('landing i entrar: sense violacions WCAG A/AA', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.lnd-hero h1')).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.goto('/entra');
    await expect(page.getByRole('button', { name: /sense compte/i })).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test('app: inici, resultats de cerca, ruta i línies sense violacions WCAG A/AA', async ({ page }) => {
    await page.addInitScript(DEMO_SESSION);
    await page.goto(`/app?${AT}`);
    await expect(page.locator('.simple-title')).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('combobox').fill('sant pere');
    await expect(page.locator('.sr-item').first()).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.goto(`/ruta/p278?${AT}`);
    await expect(page.locator('.route-panel')).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.goto(`/linia?${AT}`);
    await expect(page.locator('.bottomnav, .topnav').first()).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });
});

test.describe('mòbil petit (320 px)', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  // eslint-disable-next-line no-empty-pattern -- Playwright exigeix desestructurar les fixtures
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'android', 'una sola mida de mòbil'));

  test('cap pantalla desborda en horitzontal i la navegació es pot tocar (≥ 44 px)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.lnd-hero h1')).toBeVisible();
    await noHorizontalScroll(page);
    await page.addInitScript(DEMO_SESSION);
    for (const path of [`/app?${AT}`, `/ruta/p278?${AT}`, `/linia?${AT}`]) {
      await page.goto(path);
      await expect(page.locator('.bottomnav')).toBeVisible();
      await noHorizontalScroll(page);
    }
    const tabs = page.locator('.bottomnav a, .bottomnav button');
    expect(await tabs.count()).toBeGreaterThanOrEqual(4);
    for (const box of await tabs.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect))) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('cerca: càrrega i errors del servei de llocs', () => {
  test.use({ serviceWorkers: 'block' });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(DEMO_SESSION);
  });

  test('servei lent: «Buscant més llocs…» i després el resultat', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route('**/api/places**', async (route) => {
      await gate;
      await route.fulfill({ json: { source: 'photon', attribution: '© OpenStreetMap', results: [{ id: 'x1', name: 'Zzqx Botiga', label: 'Sabadell', kind: 'shop', lon: 2.11, lat: 41.55 }] } });
    });
    await page.goto(`/app?${AT}`);
    await page.getByRole('combobox').fill('zzqx botiga');
    await expect(page.locator('.sr-more')).toContainText(/Buscant|Buscando/);
    // mentre carrega no diu «no hem trobat» (seria mentida)
    await expect(page.locator('.sr-empty')).toHaveCount(0);
    release();
    await expect(page.locator('.sr-item').filter({ hasText: 'Zzqx Botiga' })).toBeVisible();
  });

  test('servei caigut: diu que ara no pot buscar, no que el lloc no existeix', async ({ page }) => {
    await page.route('**/api/places**', (route) => route.fulfill({ status: 503, body: 'no' }));
    await page.goto(`/app?${AT}`);
    await page.getByRole('combobox').fill('zzqx botiga');
    await expect(page.locator('.sr-empty')).toContainText(/no podem buscar|no podemos buscar/i);
    await expect(page.locator('.sr-empty')).not.toContainText(/No hem trobat|No hemos encontrado/);
    // els carrers i parades (al dispositiu) continuen sortint encara que el servei falli
    await page.getByRole('combobox').fill('sant pere');
    await expect(page.locator('.sr-item[id^="sr-c"]').first()).toBeVisible();
  });
});

test.describe('ubicació: temps esgotat', () => {
  test('explica que no t’ha trobat, deixa tornar-ho a provar i continua funcionant', async ({ browser }) => {
    // permís concedit (si no, l'app llegeix «denegat» de la Permissions API): el GPS, però, no respon
    const ctx = await browser.newContext({ permissions: ['geolocation'] });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('nextmobility.session', JSON.stringify({ userId: 'demo', at: Date.now() }));
      localStorage.setItem('nextmobility.locAsked', '1');
      // el primer intent: el GPS no respon (TIMEOUT); en tornar-ho a provar, sí
      let n = 0;
      const get = (ok: (p: unknown) => void, err: (e: { code: number }) => void) =>
        setTimeout(() => (n++ < 2 ? err({ code: 3 }) : ok({ coords: { longitude: 2.1035, latitude: 41.5463, accuracy: 20 }, timestamp: Date.now() })), 30);
      Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: get, watchPosition: () => 0, clearWatch: () => {} } });
    });
    await page.goto(`/app?${AT}`);
    const loc = page.locator('.simple-loc');
    await expect(loc).toHaveAttribute('data-loc', 'timeout');
    await expect(loc).toContainText(/No t’hem pogut localitzar|No te hemos podido localizar/);
    await expect(page.locator('.simple-title')).toBeVisible();
    await loc.getByRole('button', { name: /Torna-ho a provar|Vuelve a intentarlo|Reintentar/i }).click();
    await expect(loc).toHaveAttribute('data-loc', 'ok');
    await ctx.close();
  });
});
