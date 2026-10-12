/**
 * Regressions de la revisió de producte (flux principal com a persona nova, al mòbil).
 */
import { expect, test } from '@playwright/test';

const AT = 'hora=08:15&dia=dimarts';
test.use({ geolocation: { longitude: 2.1035, latitude: 41.5463 }, permissions: ['geolocation'], serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('nextmobility.session', JSON.stringify({ userId: 'demo', at: Date.now() }));
    localStorage.setItem('nextmobility.locAsked', '1');
  });
});

test('destí a tocar: «A peu» és la millor opció; cap bus que faci caminar més', async ({ page }) => {
  // Mercat Central, a ~200 m de la ubicació de prova
  await page.goto(`/ruta/l851?${AT}`);
  const best = page.locator('.best').first();
  await expect(best).toBeVisible({ timeout: 20000 });
  await expect(best).toContainText(/A peu|A pie/);
  await expect(best).toContainText(/min/);
  await expect(page.getByText(/0 min de trajecte|0 min de trayecto/)).toHaveCount(0);
});

test('resultat en bus: diu quant falta en total, des d’ara', async ({ page }) => {
  await page.goto(`/ruta/p278?${AT}`);
  const best = page.locator('.best').first();
  await expect(best).toBeVisible({ timeout: 20000 });
  await expect(best.locator('.best-summary')).toContainText(/\d+ min en total · /);
});

test('amb la fitxa d’un bus oberta, «Inici» porta a l’inici (no queda tapat)', async ({ page }) => {
  await page.goto(`/ruta/p278?${AT}`);
  await page.locator('.best').first().getByRole('button', { name: /Segueix|Agafaré|Síguelo/ }).first().click();
  await expect(page.locator('.bus-card')).toBeVisible();
  const nav = page.locator('.bottomnav:visible, .topnav:visible').first();
  await nav.getByRole('button', { name: /Inici|Inicio/ }).click();
  await expect(page.locator('.bus-card')).toHaveCount(0);
  await expect(page.locator('.simple-title')).toBeVisible();
});

test('mòbil: el viatge actiu és una barra a baix que no tapa el cercador', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop', 'només mòbil');
  await page.goto(`/ruta/p278?${AT}`);
  await page.locator('.best').first().getByRole('button', { name: /Segueix|Agafaré|Síguelo/ }).first().click();
  await page.locator('.bottomnav').getByRole('button', { name: /Inici|Inicio/ }).click();
  const trip = page.locator('.trip-card');
  await expect(trip).toBeVisible();
  const [t, s] = await Promise.all([trip.boundingBox(), page.getByRole('combobox').boundingBox()]);
  expect(t!.y).toBeGreaterThan(s!.y + s!.height);
});
