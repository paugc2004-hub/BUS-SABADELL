/**
 * Tarifes i punts de venda: proves d'acceptació (vegeu docs/TARIFES_PUNTS_DE_VENDA.md).
 * L'hora es fixa amb el rellotge de demo (?hora=&dia=), a l'hora local de Sabadell.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const card = (page: Page, name: RegExp | string) => page.locator('.fare-card', { has: page.getByRole('heading', { name }) });
const point = (page: Page, name: string) => page.locator('.sp-card', { has: page.getByRole('heading', { name, exact: true }) });

async function showAll(page: Page) {
  const more = page.locator('.sp-more');
  while (await more.isVisible()) await more.click();
}

test.describe('tarifes', () => {
  test('les quatre tarifes de TUS amb preu i condicions; vigència i avís de confirmar-les', async ({ page }) => {
    await page.goto('/tarifes');
    await expect(page.locator('h1')).toHaveText('Tarifes del bus de Sabadell');
    await expect(page.locator('.fares-valid')).toHaveText(/Tarifes vigents des de l’1 de maig de 2026/);
    await expect(page.getByText(/Confirma’ls a la web oficial/)).toBeVisible();
    const prices: [RegExp, string][] = [
      [/^Bitllet senzill$/, '1,80'],
      [/^Targeta T-10$/, '10,10'],
      [/^T-mensual bonificada$/, '20,60'],
      [/^T-mensual Jove bonificada$/, '14,35'],
    ];
    for (const [name, p] of prices) await expect(card(page, name).locator('.fare-price')).toContainText(p);
    await expect(card(page, /^Bitllet senzill$/)).toContainText('Sense transbord');
    await expect(card(page, /^Targeta T-10$/)).toContainText('Transbord 1 h 15 min');
    // condicions completes, plegades
    const m = card(page, /^T-mensual bonificada$/).locator('details');
    await expect(m.getByText(/document oficial d’identitat/)).toBeHidden();
    await m.locator('summary').click();
    await expect(m.getByText(/document oficial d’identitat/)).toBeVisible();
    await expect(m.getByText(/RDL 17\/2025/)).toBeVisible();
    // res es presenta com a temps real ni com a verificat avui
    await expect(page.getByText(/temps real|verificat/i)).toHaveCount(0);
  });

  test('títols socials, escolar, TBUS (només L12) i T-16 (cost de la targeta, sistema integrat)', async ({ page }) => {
    await page.goto('/tarifes');
    await expect(card(page, /tarificació social/)).toContainText('Gratuït');
    await expect(card(page, /acompanyant/)).toContainText('Només amb la persona titular');
    await expect(card(page, /col·lectiu escolar/)).toContainText('Cal demanar-lo abans');
    const tbus = card(page, /TBUS/);
    await expect(tbus.locator('.fare-tags')).toContainText('Només L12');
    await expect(tbus).toContainText('Sant Quirze');
    const atm = page.locator('section', { has: page.getByRole('heading', { name: /Sistema tarifari integrat/ }) });
    const t16 = atm.locator('.fare-card', { has: page.getByRole('heading', { name: /T-16/ }) });
    await expect(t16.locator('.fare-price')).toContainText('4,50');
    await expect(t16.locator('.fare-price')).toContainText('cost de la targeta');
    // la T-16 no és als títols de TUS
    const tus = page.locator('section', { has: page.getByRole('heading', { name: /Títols del bus urbà/ }) });
    await expect(tus.getByRole('heading', { name: /T-16/ })).toHaveCount(0);
  });

  test('categories: filtren sense perdre la distinció TUS / ATM', async ({ page }) => {
    await page.goto('/tarifes');
    await page.getByRole('button', { name: 'Abonaments' }).click();
    await expect(page.locator('.fare-card h3')).toHaveText(['T-mensual bonificada', 'T-mensual Jove bonificada']);
    await page.getByRole('button', { name: 'Integrats (ATM)' }).click();
    await expect(page.getByRole('heading', { name: /Títols del bus urbà/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /T-16/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Altres títols integrats' })).toBeVisible();
  });

  test('comparador: amb els preus de la llista; jove i molts viatges → T-mensual Jove', async ({ page }) => {
    await page.goto('/tarifes');
    await expect(page.locator('.fc-best')).toContainText('Targeta T-10');
    await page.locator('#fc-trips').fill('40');
    await expect(page.locator('.fc-best')).toContainText('T-mensual bonificada · 20,60');
    await page.getByLabel('Tinc menys de 30 anys').check();
    await expect(page.locator('.fc-best')).toContainText('T-mensual Jove bonificada · 14,35');
  });

  test('enllaços oficials: s’obren en una pestanya nova', async ({ page }) => {
    await page.goto('/tarifes');
    for (const href of [
      'https://www.atm.cat/sistema-tarifari-integrat/titols-i-tarifes/titols-i-preus',
      'https://t-mobilitat.atm.cat/web/t-mobilitat/new-fares',
      'https://www.tus.es/index.php/ca/informacio-d-interes/anar-en-bus/tarifes',
    ]) {
      const a = page.locator(`a[href="${href}"]`).first();
      await expect(a).toHaveAttribute('target', '_blank');
      await expect(a).toHaveAttribute('rel', /noopener/);
    }
    await card(page, /T-16/).locator('summary').click();
    await expect(card(page, /T-16/).getByRole('link', { name: /Informació oficial/ })).toHaveAttribute('href', 'https://t-mobilitat.atm.cat/web/t-mobilitat/t-16');
  });

  test('castellà: preus amb format espanyol', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lang', 'es'));
    await page.goto('/tarifes');
    await expect(page.locator('h1')).toHaveText('Tarifas del autobús de Sabadell');
    await expect(page.locator('.fares-valid')).toContainText('Tarifas vigentes desde el 1 de mayo de 2026');
    await expect(card(page, /^Billete sencillo$/).locator('.fare-price')).toContainText('1,80');
  });
});

test.describe('punts de venda', () => {
  test('els 33 punts, de 8 en 8 (no tots de cop), sense duplicats', async ({ page }) => {
    await page.goto('/punts-de-venda?hora=10:00&dia=dimarts');
    await expect(page.locator('.sp-count')).toHaveText('33 punts de venda');
    await expect(page.locator('.sp-card')).toHaveCount(8);
    await showAll(page);
    await expect(page.locator('.sp-card')).toHaveCount(33);
    const names = await page.locator('.sp-card h3').allTextContents();
    expect(new Set(names).size).toBe(33);
  });

  test('cerca per nom i per adreça; estat buit amb sortida', async ({ page }) => {
    await page.goto('/punts-de-venda?hora=10:00&dia=dimarts');
    const search = page.getByPlaceholder('Cerca per nom o adreça');
    await search.fill('Lacy');
    await expect(page.locator('.sp-card h3')).toHaveText(['ESTANC-16, l’Estanquet de la Rambla']);
    await search.fill('aragay');
    await expect(page.locator('.sp-card h3')).toHaveText(['ESTANC-1, Aragay']);
    await search.fill('zzzz');
    await expect(page.locator('.sp-empty')).toBeVisible();
    await page.getByRole('button', { name: 'Treu els filtres' }).click();
    await expect(page.locator('.sp-count')).toHaveText('33 punts de venda');
  });

  test('filtre per barri i per municipi (Sant Quirze, apart)', async ({ page }) => {
    await page.goto('/punts-de-venda?hora=10:00&dia=dimarts');
    await page.getByLabel('Barri').selectOption('La Creu de Barberà');
    await expect(page.locator('.sp-count')).toHaveText('3 punts de venda');
    await page.getByLabel('Barri').selectOption('sq');
    await expect(page.locator('.sp-card h3')).toHaveText(['ESTANC Pau Casals']);
    await expect(page.getByRole('heading', { name: /Fora de Sabadell · Sant Quirze del Vallès/ })).toBeVisible();
    // també surt cercant pel municipi
    await page.getByLabel('Barri').selectOption('all');
    await page.getByPlaceholder('Cerca per nom o adreça').fill('sant quirze');
    await expect(page.locator('.sp-card h3')).toHaveText(['ESTANC Pau Casals']);
  });

  test('fitxa: horari setmanal, títols, enllaç de mapa per adreça', async ({ page }) => {
    await page.goto('/punts-de-venda?hora=10:00&dia=dimarts');
    const o = point(page, 'Oficina de Mobilitat');
    await expect(o.locator('.sp-titles')).toContainText('T-10');
    await expect(o.locator('.sp-titles')).toContainText('T-mensual Jove');
    await o.locator('summary').click();
    await expect(o.locator('.sp-day').first()).toContainText('8:00–13:00 · 16:00–19:00');
    await expect(o.locator('.sp-day').nth(5)).toContainText('Tancat');
    await expect(o.getByRole('link', { name: /Obre al mapa/ })).toHaveAttribute('href', /google\.com\/maps\/search\/\?api=1&query=C\.%20de%20l%E2%80%99Estaci%C3%B3%2C%2067%2C%20Sabadell/);
  });

  test('CTA des de la T-10: només els punts on consta, amb la nota de la xarxa PunTUS', async ({ page }) => {
    await page.goto('/tarifes?hora=10:00&dia=dimarts');
    await card(page, /^Targeta T-10$/).getByRole('link', { name: 'On comprar la T-10' }).click();
    await expect(page).toHaveURL(/\/punts-de-venda\?titol=t10/);
    await expect(page.locator('.sp-card h3')).toHaveText(['Oficina de Mobilitat']);
    await expect(page.locator('.sp-note')).toContainText('xarxa PunTUS');
  });

  test('obert ara, a l’hora local: horari partit, dia sense horari i filtre', async ({ page }) => {
    await page.goto('/punts-de-venda?hora=10:00&dia=dimarts');
    await expect(point(page, 'Oficina de Mobilitat').locator('.sp-state')).toHaveText('Obert · tanca a les 13:00');
    await page.goto('/punts-de-venda?hora=14:30&dia=dimarts');
    await expect(point(page, 'Oficina de Mobilitat').locator('.sp-state')).toHaveText('Tancat · obre a les 16:00');
    await page.goto('/punts-de-venda?hora=10:00&dia=dissabte');
    await expect(point(page, 'Oficina de Mobilitat').locator('.sp-state')).toHaveText('Tancat · obre dilluns a les 8:00');
    // filtre «obert ara»: un dissabte a les 10, l'Oficina no hi és
    await page.getByLabel('Obert ara').check();
    await expect(page.locator('.sp-card h3', { hasText: 'Oficina de Mobilitat' })).toHaveCount(0);
    await expect(page.locator('.sp-card').first()).toBeVisible();
    await expect(page.getByText(/Els horaris poden variar en festius/)).toBeVisible();
  });
});

test.describe('integració i qualitat', () => {
  test('accés discret des de l’inici de l’app i des del peu de la landing', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('nextmobility.session', JSON.stringify({ userId: 'demo', at: Date.now() }));
      localStorage.setItem('nextmobility.locAsked', '1');
    });
    await page.goto('/app?hora=08:15&dia=dimarts');
    await expect(page.locator('.simple-title')).toBeVisible();
    await page.locator('.hub').getByRole('link', { name: 'Informació dels títols' }).click();
    await expect(page).toHaveURL(/\/tarifes(\?|$)/);
    await page.goto('/');
    await page.locator('.lnd-footer').getByRole('link', { name: 'On comprar' }).click();
    await expect(page).toHaveURL(/\/punts-de-venda$/);
  });

  test('mòbil petit (320 px): res desborda', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    for (const path of ['/tarifes', '/punts-de-venda']) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(sw, path).toBeLessThanOrEqual(cw);
    }
    await ctx.close();
  });

  test('accessibilitat WCAG 2.1 AA (amb desplegables oberts)', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'només escriptori');
    const axe = async () =>
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
    await page.goto('/tarifes');
    await page.locator('.fare-more summary').first().click();
    expect(await axe()).toEqual([]);
    await page.goto('/punts-de-venda?hora=10:00&dia=dimarts');
    await page.locator('.sp-hours summary').first().click();
    expect(await axe()).toEqual([]);
  });
});
