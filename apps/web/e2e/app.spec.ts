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
  // una llegada amb el bus ja de camí ("a N parades")
  const first = page.locator('.arrival', { has: page.locator('.arrival-sub', { hasText: /\d paradas?|\d parades|Propera|Próxima/ }) }).locator('.arrival-main').first();
  await expect(first).toBeVisible();
  await first.click();
  const card = page.locator('.bus-card');
  await expect(card).toBeVisible();
  await expect(card.locator('.led')).toHaveText(/·\d\d$/);
  await expect(card.locator('.source-simulated')).toBeVisible();
  // compte enrere mm:ss que avança
  const a = await card.locator('.cell-big').innerText();
  expect(a).toMatch(/^\d\d:\d\d$/);
  await expect.poll(() => card.locator('.cell-big').innerText(), { timeout: 8000 }).not.toBe(a);
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

test('mode presentació: demo narrada per escenes, sempre amb el banner', async ({ page, isMobile }) => {
  await page.goto(`/presentacio?${AT}`);
  await ready(page);
  const caption = page.locator('.caption');
  await expect(caption.locator('h2')).toContainText(/xarxa|red/i);
  if (!isMobile) {
    const n = Number(await page.locator('.hud-num').first().innerText());
    expect(n).toBeGreaterThan(30);
  }
  await expect(page.locator('.honesty')).toContainText(/simulad/i);
  await page.keyboard.press(' '); // pausa
  await page.keyboard.press('ArrowRight');
  await expect(caption.locator('h2')).toContainText(/L\d/);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.bus-card')).toBeVisible();
  await expect(page.locator('.bus-card .source-simulated')).toBeVisible();
});

test('enfocar una línia: es destaca i la resta s’atenua (no s’amaga)', async ({ page, isMobile }) => {
  await page.goto(`/?${AT}`);
  await ready(page);
  if (isMobile) await page.locator('.lf-toggle').click();
  const chip = page.locator('.lf-chip', { hasText: /^L2$/ });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.lf-focus')).toContainText('Can Deu');
  await expect(page.locator('.lf-chip', { hasText: /^L1$/ })).toHaveAttribute('aria-pressed', 'false');
  await chip.click();
  await expect(page.locator('.lf-focus')).toHaveCount(0);
});

test('parada → bus → seguir → "vaig a agafar aquest bus" → viatge actiu', async ({ page }) => {
  await page.goto(`/parada/176?${AT}`);
  await ready(page);
  await expect(page.locator('.stop-name')).toHaveText('Estació Centre');
  // les llegades diuen a quantes parades és el bus
  await expect(page.locator('.arrival-sub').first()).toContainText(/parad|capçalera|cabecera/i);
  await page.locator('.arrival-main:not([disabled])').first().click();
  const card = page.locator('.bus-card');
  await expect(card).toBeVisible();
  await expect(card.locator('.back-link')).toContainText('Estació Centre');
  // línia temporal amb la propera parada i el progrés per distància
  await expect(card.locator('.tl-next, .tl-current').first()).toBeVisible();
  await expect(card.locator('.tl-progress-text')).toContainText('%');
  // seguir bus
  const follow = card.locator('.cta', { hasText: /Seguir|Segueix|Deixa|Dejar/ });
  await follow.click();
  await expect(follow).toHaveAttribute('aria-pressed', 'true');
  // viatge: puja a la parada d'on venim
  await card.locator('.cta-primary').click();
  await expect(card.locator('.tl-tag.board')).toBeVisible();
  await expect(card.locator('.cta-on', { hasText: /Acaba|Terminar/ })).toBeVisible();
  // el viatge (myBus) es manté en recarregar
  await page.goto(`/?${AT}`);
  await ready(page);
  const trip = page.locator('.trip-card');
  await expect(trip).toBeVisible();
  await expect(trip).toContainText('Estació Centre');
  await expect(trip.locator('.source-simulated')).toBeVisible();
  await trip.getByRole('button', { name: /Acaba|Terminar/ }).click();
  await expect(trip).toHaveCount(0);
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
