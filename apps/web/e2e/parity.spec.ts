/**
 * Paritat amb l'app oficial de TUS (docs/TUS_PARITY.md): cada pantalla de l'app oficial té el seu equivalent i
 * funciona. Rellotge fix: festiu 12/10/2026 a les 11:54 (el dia de les captures de l'app oficial).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AT = 'hora=11:54&dia=2026-10-12';
test.use({ geolocation: { longitude: 2.1035, latitude: 41.5463 }, permissions: ['geolocation'], serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // el test del compte real ho desactiva (si no, cada càrrega tornaria a la demostració)
    if (!localStorage.getItem('e2e.ownAccount')) localStorage.setItem('nextmobility.session', JSON.stringify({ userId: 'demo', at: Date.now() }));
    localStorage.setItem('nextmobility.locAsked', '1');
  });
});

const nav = (page: Page) => page.locator('.bottomnav:visible, .topnav:visible').first();

test('portada: «On vols anar?» i els 5 accessos de l’app oficial; barra de 5 pestanyes', async ({ page }) => {
  await page.goto(`/app?${AT}`);
  await expect(page.locator('.simple-title')).toBeVisible({ timeout: 20000 });
  const hub = page.locator('.hub');
  for (const label of ['Consulta o recarrega la targeta', 'Viatja amb el mòbil', 'Informació del servei, línies i horaris', 'Àrea personal', 'Informació dels títols']) {
    await expect(hub.getByText(label)).toBeVisible();
  }
  for (const tab of ['Inici', 'Mapa', 'Línies', 'Com hi arribo', 'Més']) await expect(nav(page).getByRole('button', { name: tab })).toBeVisible();
  // capçalera: QR, lupa i avisos (amb el número dels que estan en vigor: 3; el de demà no compta)
  await expect(page.getByRole('button', { name: 'Llegeix el QR d’una parada' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cerca una parada' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Avisos: 3 actius' })).toBeVisible();
});

test('avisos: els 4 de l’app oficial, en vigor i propers, amb les línies afectades', async ({ page }) => {
  await page.goto(`/avisos?${AT}`);
  const now = page.locator('.al-sec').first();
  await expect(now.locator('.al-card')).toHaveCount(3, { timeout: 20000 });
  await expect(now.getByText('Afectacions al servei · tall del c. d’Adriana')).toBeVisible();
  const soon = page.locator('.al-sec').nth(1);
  await expect(soon.getByText(/tall del pg. del Comerç/)).toBeVisible();
  await expect(soon.getByText(/la línia 8 es desvia pel c. de Goya/)).toBeVisible();
  // l'endemà a les 10:00, el del pg. del Comerç ja és en vigor
  await page.goto('/avisos?hora=10:00&dia=2026-10-13');
  await expect(page.locator('.al-sec').first().locator('.al-card')).toHaveCount(4, { timeout: 20000 });
});

test('línies: el 12/10 (festiu comercial) surten les F, també la F6; demà, les diürnes', async ({ page }) => {
  await page.goto(`/linia?${AT}`);
  await expect(page.getByText('Festiu comercial')).toBeVisible({ timeout: 20000 });
  const list = page.locator('.lines-index .line-list').first();
  await expect(list.getByText('La Roureda - El Poblenou')).toBeVisible();
  await expect(list.getByText('Pl. Catalunya - S.P. Riu-sec (Festius Comercials)')).toBeVisible();
  await expect(list.locator('.line-row')).toHaveCount(7);
  await page.getByRole('button', { name: 'Demà' }).click();
  await expect(page.locator('.lines-daykind')).toContainText('Feiner');
  await expect(page.locator('.lines-index .line-list').first().getByText('Pl. Catalunya - S.P. Riu-sec (Festius Comercials)')).toHaveCount(0);
  // cerca d'una línia sense accents
  await page.getByPlaceholder('Cerca una línia…').fill('romanica');
  // demà la F3 no circula: surt igualment (amb «No circula aquest dia») en cercar-la
  await expect(page.locator('.line-row', { hasText: 'La Plana del Pintor - La Romànica' })).toContainText('No circula aquest dia');
});

test('línia: sentit, recorregut amb l’hora de pas de cada parada i transbords', async ({ page }) => {
  await page.goto(`/linia/F1?${AT}`);
  const panel = page.locator('.line-panel');
  await expect(panel.locator('.lp-time').first()).toHaveText(/^\d{2}:\d{2}$/, { timeout: 20000 });
  await expect(panel.getByRole('tab')).toHaveCount(2);
  await expect(panel.locator('.lp-transfers .chip').first()).toBeVisible();
});

test('cercar parada: el codi exacte primer («43 - Casal Pere Quart»), i després a la parada surt «codi - nom»', async ({ page }) => {
  await page.goto(`/cerca?${AT}`);
  await expect(page.getByRole('heading', { name: 'Cerca una parada pel codi, el nom o el QR' })).toBeVisible({ timeout: 20000 });
  // sense escriure: parades a prop (la de TUS queda buida)
  await expect(page.getByText('A prop teu')).toBeVisible();
  await page.getByPlaceholder('Codi o nom de la parada').fill('43');
  const first = page.locator('.fs-results .fs-row').first();
  await expect(first).toContainText('43 - Casal Pere Quart');
  await first.click();
  await expect(page.locator('.stop-name')).toHaveText('43 - Casal Pere Quart');
  // queda a «Recents»
  await page.goto(`/cerca?${AT}`);
  await expect(page.getByText('Recents', { exact: true })).toBeVisible();
});

test('lector QR: sense càmera, el codi escrit a mà porta a la parada; un codi desconegut ho diu', async ({ page }) => {
  await page.goto(`/qr-lector?${AT}`);
  await expect(page.getByRole('button', { name: /Obre la càmera/ })).toBeVisible({ timeout: 20000 });
  await page.getByLabel('O escriu el codi de la parada').fill('9999');
  await page.getByRole('button', { name: 'Obre la parada' }).click();
  await expect(page.getByText('No reconec aquest codi. Escriu el número de la parada.')).toBeVisible();
  await page.getByLabel('O escriu el codi de la parada').fill('131');
  await page.getByRole('button', { name: 'Obre la parada' }).click();
  await expect(page.locator('.stop-name')).toHaveText('131 - Mercat Central');
});

test('com hi arribo: formulari amb origen i destí, intercanviar, i el resultat es calcula dins l’app', async ({ page }) => {
  await page.goto(`/com-hi-arribo?${AT}`);
  const go = page.getByRole('button', { name: 'Planifica el viatge' });
  await expect(go).toBeDisabled({ timeout: 20000 });
  await page.getByPlaceholder('Lloc, carrer o parada').fill('Fra Angelico');
  await page.locator('.place-results').getByRole('button', { name: /Carrer de Fra Angelico/ }).first().click();
  await expect(go).toBeEnabled();
  // intercanviar: la meva ubicació passa a ser el destí
  await page.getByRole('button', { name: 'Intercanvia l’origen i el destí' }).click();
  await expect(page.locator('.pf-field').nth(1)).toContainText('La meva ubicació');
  await page.getByRole('button', { name: 'Intercanvia l’origen i el destí' }).click();
  await go.click();
  await expect(page).toHaveURL(/\/ruta\/c/);
  await expect(page.locator('.best').first()).toBeVisible({ timeout: 20000 });
});

test('títols (demo): comprar una T-10 simulada, fer-la servir per a 2 persones i veure-ho a l’historial', async ({ page }) => {
  await page.goto(`/titols?${AT}`);
  await expect(page.getByText('Encara no tens cap títol actiu.', { exact: false })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Demostració', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Compra un títol' }).click();
  await expect(page.getByText('1,80 €')).toBeVisible();
  await page.locator('.tk-product', { hasText: 'Targeta T-10' }).click();
  // cap camp de pagament; Bizum desactivat
  await expect(page.locator('input[autocomplete^="cc-"], input[name*="card" i], input[name*="iban" i]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Bizum/ })).toBeDisabled();
  const pay = page.getByRole('button', { name: 'Simular pagament (demo · no es cobra res)' });
  await pay.click();
  await pay.click({ timeout: 1000 }).catch(() => undefined); // un doble toc no fa una segona compra
  await expect(page.getByText('Compra simulada correctament')).toBeVisible();
  await expect(page.getByText(/DEMO-20261012-\d{4}/)).toBeVisible();
  await page.getByRole('button', { name: 'Fes-lo servir ara' }).click();
  await page.getByRole('button', { name: '+1' }).click();
  await page.getByRole('button', { name: 'Valida (demo)' }).click();
  const v = page.getByRole('dialog', { name: 'Validació' });
  await expect(v).toContainText('Validat per a 2 persones');
  await expect(v).toContainText('DEMOSTRACIÓ · NO VÀLID PER VIATJAR');
  await expect(v).toContainText('Queden 8 viatges');
  await v.getByRole('button', { name: 'Fet' }).click();
  await expect(page.getByText('8 de 10 viatges')).toBeVisible();
  await page.getByRole('button', { name: 'Les meves compres' }).click();
  await expect(page.locator('.tk-history li')).toHaveCount(1);
});

test('targetes (demo): consultar explica que cal la integració; vincular una de prova i recarregar-hi una T-10', async ({ page }) => {
  await page.goto(`/targetes?${AT}`);
  await expect(page.getByText('Encara no tens cap targeta vinculada.')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Consulta una targeta' }).click();
  await expect(page.getByText(/necessita la integració amb el sistema de validació de TUS/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Vincula una targeta' }).click();
  await page.getByLabel('Nom per reconèixer-la').fill('La meva');
  await page.getByLabel('Cartró').check();
  await page.getByRole('button', { name: 'Vincula (demo)' }).click();
  await expect(page.locator('.cd-item')).toContainText(/DEMO-\d{4}-\d{4}/);
  await page.getByRole('button', { name: 'Recarrega títols a una targeta' }).click();
  await page.locator('.cd-pick').first().click();
  // en cartró, només la T-10
  await expect(page.locator('.tk-product')).toHaveCount(1);
  await page.locator('.tk-product').click();
  await page.getByRole('button', { name: 'Simular pagament (demo · no es cobra res)' }).click();
  await expect(page.getByText('Compra simulada correctament')).toBeVisible();
});

test('compte: amb la demostració, les opcions del compte avisen que cal un compte; configuració d’accessibilitat', async ({ page }) => {
  await page.goto(`/meus?${AT}`);
  await expect(page.getByRole('heading', { name: 'El meu compte' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('button', { name: /Canvia la contrasenya/ })).toBeDisabled();
  await page.getByRole('button', { name: /Preguntes freqüents/ }).click();
  await expect(page.getByText('Els busos del mapa són reals?')).toBeVisible();
  await page.goto(`/compte/configuracio?${AT}`);
  await page.getByRole('radio', { name: 'Molt gran' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-text', 'xl');
  await page.getByLabel('Alt contrast').check();
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-text', 'xl');
});

test('compte real: canviar el nom i eliminar-lo no en deixa res al dispositiu', async ({ page }) => {
  await page.goto('/registre');
  await page.evaluate(() => {
    localStorage.setItem('e2e.ownAccount', '1');
    localStorage.removeItem('nextmobility.session');
  });
  await page.reload();
  await page.getByLabel('Nom', { exact: true }).fill('Pau Prova');
  await page.getByLabel('Correu electrònic').fill('pau@prova.cat');
  await page.locator('input[autocomplete="new-password"]').fill('contrasenya-llarga');
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/app/);
  await page.goto(`/titols/comprar/senzill?${AT}`);
  await page.getByRole('button', { name: 'Simular pagament (demo · no es cobra res)' }).click();
  await expect(page.getByText('Compra simulada correctament')).toBeVisible();
  await page.goto(`/compte/elimina?${AT}`);
  await page.getByLabel('Escriu ELIMINA per confirmar').fill('ELIMINA');
  await page.getByLabel('Contrasenya actual').fill('contrasenya-llarga');
  await page.getByRole('button', { name: 'Elimina el compte definitivament' }).click();
  await page.waitForURL((u) => u.pathname === '/');
  const left = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  expect(left).not.toContain('pau@prova.cat');
  expect(left).not.toMatch(/wallet:[0-9a-f-]{36}/);
});

test('més: punts de venda, oficina, idioma, accessibilitat, TUS i xarxes (externs), versió', async ({ page }) => {
  await page.goto(`/mes?${AT}`);
  const more = page.locator('.more-page');
  for (const r of ['Punts de venda', 'Oficina de Mobilitat', 'Avisos', 'Informació dels títols', 'Preferides', 'Compte', 'Accessibilitat']) await expect(more.getByRole('button', { name: r, exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('link', { name: /Web oficial de TUS/ })).toHaveAttribute('target', '_blank');
  await expect(page.getByText(/Versió de l’app \d+\.\d+\.\d+ · Dades de la xarxa del/)).toBeVisible();
  await more.getByRole('button', { name: /Idioma/ }).click();
  await expect(page.getByRole('heading', { name: 'Más' })).toBeVisible();
  await more.getByRole('button', { name: 'Oficina de Mobilitat', exact: true }).click();
  await expect(page.getByText('Estación de autobuses · c. de l’Estació, 67')).toBeVisible();
});

test('mapa: novetats (Oficina de Mobilitat) plegables i que es poden amagar per sempre', async ({ page }) => {
  await page.goto(`/mapa?${AT}`);
  const news = page.getByRole('region', { name: 'Novetats' });
  await expect(news).toContainText('Oficina de Mobilitat', { timeout: 20000 });
  await page.getByRole('button', { name: 'Amaga les novetats' }).click();
  await expect(page.getByRole('button', { name: /Novetats \(1\)/ })).toBeVisible();
  await page.getByRole('button', { name: /Novetats \(1\)/ }).click();
  await page.getByRole('button', { name: 'No ho tornis a mostrar' }).click();
  await page.reload();
  await expect(page.locator('.news, .news-pill')).toHaveCount(0);
});

test('línia un altre dia: només l’horari (cap «busos ara» ni propers busos d’avui)', async ({ page }) => {
  await page.goto(`/linia?${AT}`);
  await page.getByRole('button', { name: 'Demà' }).click();
  await page.locator('.line-row', { hasText: 'Can Rull' }).first().click();
  const panel = page.locator('.line-panel');
  await expect(panel.locator('.lp-time').first()).toBeVisible({ timeout: 20000 });
  await expect(panel.locator('.lp-next')).toHaveCount(0);
  await expect(panel.locator('.lp-bus')).toHaveCount(0);
  await expect(panel.locator('.lp-summary')).not.toContainText(/busos ara|ara no/i);
});

test.describe('accessibilitat de les pantalles de paritat (WCAG 2.2 AA)', () => {
  for (const path of ['/app', '/avisos', '/linia', '/cerca', '/qr-lector', '/com-hi-arribo', '/mes', '/oficina', '/titols', '/titols/comprar', '/titols/comprar/t10', '/targetes', '/targetes/vincula', '/meus', '/compte/configuracio', '/compte/preguntes', '/preferides']) {
    test(`sense violacions: ${path}`, async ({ page }) => {
      await page.goto(`${path}?${AT}`);
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 });
      await page.waitForTimeout(400);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).exclude('.maplibregl-canvas').analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
    });
  }
});
