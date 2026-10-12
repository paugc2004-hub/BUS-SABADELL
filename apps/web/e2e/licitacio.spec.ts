/**
 * Requisits de la licitació municipal de 2024 (expedient OTU/2024/113, PPT): fitxa de parada per QR (§2.1.5),
 * línies i horaris imprimibles, avisos amb publicació/expiració (§2.2.1), planificador amb hora de sortida/arribada,
 * pàgines legals (§2.1.2 i §2.1.4) i accessibilitat WCAG 2.1 AA (§2.1.1).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AT = 'hora=08:15&dia=dimarts';
const DEMO_SESSION = () => {
  localStorage.setItem('nextmobility.session', JSON.stringify({ userId: 'demo', at: Date.now() }));
  localStorage.setItem('nextmobility.locAsked', '1');
};

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.maplibregl-canvas').analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
}

/** afegeix avisos a la xarxa servida (només per a la prova): un de vigent a la L2 i un de caducat a la L1 */
async function withAlerts(page: Page) {
  await page.route('**/data/network.json', async (route) => {
    const res = await route.fetch();
    const net = await res.json();
    net.alerts = [
      { id: 'prova-l2', routes: ['L2'], stops: [], from: '2026-10-01', to: null, text: { ca: 'Avís de prova L2', es: 'Aviso de prueba L2' }, reason: { ca: 'Obres', es: 'Obras' } },
      { id: 'prova-caducat', routes: ['L1'], stops: [], from: '2026-09-01', to: '2026-09-10', text: { ca: 'Avís caducat', es: 'Aviso caducado' } },
    ];
    await route.fulfill({ response: res, json: net });
  });
}

test.describe('fitxa de parada (QR, PPT §2.1.5)', () => {
  test.use({ serviceWorkers: 'block' });

  test('sense sessió: codi, nom, línies, propers busos etiquetats com a simulats i horari teòric', async ({ page }) => {
    await page.goto(`/p/278?${AT}`);
    await expect(page).toHaveURL(/\/p\/278/); // no demana entrar
    await expect(page.locator('h1')).toHaveText('Parc Taulí');
    await expect(page.locator('.sc-code')).toContainText('278');
    await expect(page.locator('.sc-lines li')).not.toHaveCount(0);
    await expect(page.locator('#sc-next')).toContainText(/Simulat|Simulado/i);
    await expect(page.getByText(/No és temps real|No es tiempo real/)).toBeVisible();
    await expect(page.locator('.sc-tt li').first()).toContainText(/\d\d:\d\d/);
    await expect(page.locator('.pub-legal a')).toHaveCount(3);
  });

  test('codi inexistent o manipulat: ho diu, sense petar', async ({ page }) => {
    await page.goto(`/p/99999?${AT}`);
    await expect(page.getByRole('alert')).toContainText(/No trobem|No encontramos/);
    await page.goto(`/p/%3Cscript%3E?${AT}`);
    await expect(page.getByRole('alert')).toContainText(/No trobem|No encontramos/);
  });

  test('generador: cerca per nom, QR accessible amb la URL de la fitxa, descàrrega', async ({ page }) => {
    await page.goto('/qr');
    await page.getByLabel(/Codi o nom|Código o nombre/).fill('taul');
    await page.locator('.qr-matches button', { hasText: '278' }).click();
    await expect(page).toHaveURL(/\/qr\/278$/);
    await expect(page.getByRole('img', { name: /278.*Parc Taulí/ })).toBeVisible();
    await expect(page.locator('.qr-url')).toHaveText('bus-sabadell.vercel.app/p/278');
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: /SVG/ }).click();
    expect((await dl).suggestedFilename()).toBe('parada-278.svg');
  });
});

test.describe('línies i horaris (PPT §2.2.1)', () => {
  test.use({ serviceWorkers: 'block' });

  test('horaris imprimibles: freqüències per tipus de dia i horari per parada', async ({ page }) => {
    await page.goto(`/horari/L2?${AT}`);
    await expect(page.locator('h1')).toContainText('L2');
    await expect(page.locator('.tt-table').first().locator('tbody tr')).not.toHaveCount(0);
    await expect(page.locator('.tt-table').first()).toContainText(/Feiners|Laborables/);
    await expect(page.locator('.tt-hours tbody tr').first()).toContainText(/\d\d/);
    // canviar de parada canvia l'horari
    const before = await page.locator('.tt-hours').innerText();
    const sel = page.locator('select');
    await sel.selectOption({ index: 5 });
    await expect.poll(() => page.locator('.tt-hours').innerText()).not.toBe(before);
    // en imprimir no surten la capçalera ni els controls
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.pub-head')).toBeHidden();
    await expect(page.locator('.tt-controls')).toBeHidden();
    await expect(page.locator('.tt-hours')).toBeVisible();
  });

  test('avisos: indicador a la llista de línies i només els vigents', async ({ page }) => {
    await withAlerts(page);
    await page.addInitScript(DEMO_SESSION);
    await page.goto(`/linia?${AT}`);
    const l2 = page.locator('.line-row', { has: page.locator('.line-row-name', { hasText: /Creu de Barberà/ }) }).first();
    await expect(l2.locator('.line-alert')).toBeVisible();
    const l1 = page.locator('.line-row', { hasText: 'Estació Sud' }).first();
    await expect(l1.locator('.line-alert')).toHaveCount(0);
    // el triangle de la capçalera porta a la pàgina d'avisos
    await page.locator('.alerts-btn').click();
    const list = page.locator('.alerts-page');
    await expect(list).toContainText('Avís de prova L2');
    await expect(list).toContainText(/Motiu|Motivo/);
    await expect(list).not.toContainText('Avís caducat');
  });
});

test.describe('planificador: hora de sortida o d’arribada (PPT §2.2.1)', () => {
  test.use({ geolocation: { longitude: 2.1035, latitude: 41.5463 }, permissions: ['geolocation'], serviceWorkers: 'block' });

  test('«Arribar a les…» proposa una opció i Google Maps només s’obre si l’usuari ho demana', async ({ page }) => {
    await page.addInitScript(DEMO_SESSION);
    // sense xarxa externa a les proves: Google respon una pàgina buida
    await page.context().route('https://www.google.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<title>maps</title>' }));
    await page.goto(`/ruta/p278?${AT}`);
    await expect(page.locator('.best')).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: /Arribar a les|Llegar a las/ }).click();
    await page.locator('.plan-time input').fill('09:30');
    await expect(page.locator('.best')).toBeVisible({ timeout: 20000 });
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: /Google Maps/ }).click();
    const p = await popup;
    expect(p.url()).toMatch(/google\.com\/maps\/dir\/.*travelmode=transit/);
    await p.close();
  });
});

test.describe('pàgines legals i peu comú (PPT §2.1.2, §2.1.4)', () => {
  test('galetes: diu la veritat (no n’hi ha); enllaços des de la landing', async ({ page }) => {
    await page.goto('/galetes');
    await expect(page.locator('h1')).toHaveText(/Galetes|Cookies/);
    await expect(page.getByText(/no instal·la galetes|no instala cookies/)).toBeVisible();
    await page.goto('/');
    await page.locator('.lnd-footer').getByRole('link', { name: /Privacitat|Privacidad/ }).click();
    await expect(page).toHaveURL(/\/privacitat$/);
    await expect(page.getByText(/no es desa ni s’envia|no se guarda ni se envía/i)).toBeVisible();
  });

  test('una ruta que no existeix diu «No trobat» (no indexable) i torna a l’app', async ({ page }) => {
    await page.addInitScript(DEMO_SESSION);
    await page.goto('/aquesta-pagina-no-hi-es');
    await expect(page.locator('h1')).toHaveText(/no existeix|no existe/);
    await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1);
    await page.getByRole('link', { name: /Obre l’app|Abre la app/ }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(0);
  });
});

test.describe('accessibilitat de les pàgines noves (WCAG 2.1 AA)', () => {
  test.use({ serviceWorkers: 'block' });
  // eslint-disable-next-line no-empty-pattern -- Playwright exigeix desestructurar les fixtures
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'només escriptori'));

  for (const path of [`/p/278?${AT}`, '/qr/278', `/horari/L2?${AT}`, '/privacitat', '/avis-legal', '/galetes', '/no-existeix']) {
    test(`sense violacions: ${path.split('?')[0]}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('.loader')).toHaveCount(0);
      expect(await axe(page)).toEqual([]);
    });
  }
});
