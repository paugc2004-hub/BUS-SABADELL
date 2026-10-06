import { expect, test, type Page } from '@playwright/test';

// dimarts a les 08:15: hora punta, servei de feiners
const AT = 'hora=08:15&dia=dimarts';

async function ready(page: Page) {
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
  await expect(page.locator('.fullscreen-msg')).toHaveCount(0);
}

test('carrega el mapa amb el banner d’honestedat i les atribucions', async ({ page }) => {
  await page.goto(`/?${AT}`);
  await ready(page);
  await expect(page.locator('.honesty')).toContainText(/simulad/i);
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText(/OpenStreetMap|tus\.es/);
  await expect(page.locator('.clock-time')).toHaveText(/^08:1\d:\d\d$/);
});

test('panell de parada → bus → fitxa amb origen "Simulat"', async ({ page }) => {
  await page.goto(`/parada/17?${AT}`);
  await ready(page);
  await expect(page.locator('.stop-name')).toHaveText('Manresa');
  const first = page.locator('.arrival-main:not([disabled])').first();
  await expect(first).toBeVisible();
  await first.click();
  const card = page.locator('.bus-card');
  await expect(card).toBeVisible();
  await expect(card.locator('.led')).toHaveText(/·\d\d$/);
  await expect(card.locator('.source-simulated')).toBeVisible();
  // compte enrere mm:ss que avança
  const a = await card.locator('.cell-big').innerText();
  await page.waitForTimeout(2200);
  const b = await card.locator('.cell-big').innerText();
  expect(a).toMatch(/^\d\d:\d\d$/);
  expect(b).not.toBe(a);
});

test('vista de línia amb parades, buses i canvi de línia', async ({ page }) => {
  await page.goto(`/linia/L1?${AT}`);
  await expect(page.locator('.lv-name')).toContainText('Can Deu');
  expect(await page.locator('.lv-stop').count()).toBeGreaterThan(40);
  await expect(page.locator('.lv-bus').first()).toBeVisible();
  await page.locator('.lv-chip', { hasText: /^L2$/ }).click();
  await expect(page).toHaveURL(/\/linia\/L2/);
  await expect(page.locator('.lv-name')).toContainText('Creu de Barberà');
});

test('cercador tolerant a accents', async ({ page }) => {
  await page.goto(`/cercar?${AT}`);
  await page.getByRole('searchbox').fill('creu alta');
  const res = page.locator('.result-list button', { hasText: 'La Creu Alta' }).first();
  await expect(res).toBeVisible();
  await res.click();
  await expect(page).toHaveURL(/\/parada\//);
  await expect(page.locator('.stop-name')).toHaveText('La Creu Alta');
});

test('canvi d’idioma', async ({ page }) => {
  await page.goto(`/?${AT}`);
  await ready(page);
  const banner = page.locator('.honesty');
  const before = await banner.innerText();
  await page.locator('.lang-btn').click();
  await expect(banner).not.toHaveText(before);
  await expect(page.locator('html')).toHaveAttribute('lang', /ca|es/);
});

test('fora d’horari: missatge amb el primer bus', async ({ page }) => {
  await page.goto('/?hora=03:00&dia=dimarts');
  await ready(page);
  await expect(page.locator('.no-service')).toContainText(/04:|05:/);
});

test('modal "què és real" explica la frontera real/simulat', async ({ page }) => {
  await page.goto(`/?${AT}`);
  await page.locator('.honesty').click();
  const modal = page.getByRole('dialog');
  await expect(modal.locator('.about-real')).toBeVisible();
  await expect(modal.locator('.about-sim')).toBeVisible();
  await expect(modal).toContainText('tus.es');
});

test('mode presentació mostra comptadors i el banner', async ({ page }) => {
  await page.goto(`/presentacio?${AT}`);
  await expect(page.locator('.present-hud')).toBeVisible();
  const n = Number(await page.locator('.hud-num').first().innerText());
  expect(n).toBeGreaterThan(30);
  await expect(page.locator('.present-banner')).toContainText(/simulad/i);
});

test('sense connexió: continua funcionant amb simulació local', async ({ page, context }) => {
  await page.goto(`/?${AT}`);
  await ready(page);
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 20_000 });
  await context.setOffline(true);
  await expect(page.locator('.offline-note')).toBeVisible();
  await page.goto(`/parada/17?${AT}`).catch(() => undefined);
  // amb el service worker, la ruta torna a carregar sense xarxa
  await expect(page.locator('.stop-name')).toHaveText('Manresa', { timeout: 20_000 });
  await context.setOffline(false);
});
