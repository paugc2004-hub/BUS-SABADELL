import { expect, test, type Page } from '@playwright/test';

// dimarts a les 08:15: hora punta, servei de feiners
const AT = 'hora=08:15&dia=dimarts';

async function ready(page: Page) {
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
  await expect(page.locator('.fullscreen-msg')).toHaveCount(0);
}

/** les proves de l'app entren amb el compte de demostració (els comptes són al navegador) */
const DEMO_SESSION = () => {
  localStorage.setItem('nextmobility.session', JSON.stringify({ userId: 'demo', at: Date.now() }));
  localStorage.setItem('nextmobility.locAsked', '1');
};

test.describe('app (amb sessió)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(DEMO_SESSION);
  });

  test('app ciutadana: avís de dades de demostració, atribucions i hora de demo', async ({ page }) => {
    await page.goto(`/app?${AT}`);
    await ready(page);
    await expect(page.locator('.app.citizen')).toBeVisible();
    await expect(page.locator('.demo-pill')).toContainText(/demostraci/i);
    await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText(/OpenStreetMap|tus\.es/);
    await expect(page.locator('.demo-clock .mono')).toHaveText(/^08:1\d$/);
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
    // sense tecnicismes: un estat en paraules, la propera parada en minuts i, al peu, que el bus és simulat
    await expect(card.locator('.bc-pills')).toContainText(/hora|tard|tarde|abans|antes|capçalera|cabecera/i);
    await expect(card.locator('.bc-eta')).toHaveText(/min|ara|ahora|\d\d:\d\d/i);
    await expect(card.locator('.bc-foot')).toContainText(/simulat|simulado/i);
    await expect(card.locator('.led')).toHaveCount(0);
  });

  test('línies: índex → panell de línia amb sentit, propers busos, recorregut i busos', async ({ page }) => {
    await page.goto(`/linia?${AT}`);
    await ready(page);
    await page.locator('.line-row', { hasText: 'Creu de Barberà' }).first().click();
    await expect(page).toHaveURL(/\/linia\/L2/);
    const panel = page.locator('.line-panel');
    await expect(panel.locator('.lp-title h2')).toContainText('Can Deu');
    expect(await panel.locator('.lp-stop').count()).toBeGreaterThan(20);
    await expect(panel.locator('.lp-bus').first()).toBeVisible();
    await expect(panel.locator('.lp-next-item').first()).toContainText('min');
    // canvi de sentit
    const tabs = panel.locator('.seg-ctl button');
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    // un bus de la línia obre la seva fitxa, amb tornada a la línia
    await panel.locator('.lp-bus').first().click();
    await expect(page.locator('.bus-card .back-link')).toContainText('L2');
  });

  test('cercador global tolerant a accents: línies, parades i destinacions', async ({ page }) => {
    await page.goto(`/cercar?${AT}`);
    await page.getByRole('combobox').fill('termes');
    await expect(page.locator('.sr-group', { hasText: /Destinaci|Destino/ })).toBeVisible();
    await page.getByRole('combobox').fill('l2');
    await expect(page.locator('.sr-item').first()).toContainText('L2');
    await page.getByRole('combobox').fill('creu alta');
    const res = page.locator('.sr-item[id^="sr-s"]', { hasText: 'La Creu Alta' }).first();
    await expect(res).toBeVisible();
    await res.click();
    // a l'inici, una parada és un destí: et diu quin bus agafar per anar-hi
    await expect(page).toHaveURL(/\/ruta\/p/);
    await expect(page.locator('.route-panel .stop-name')).toHaveText('La Creu Alta');
  });

  test('canvi d’idioma', async ({ page }) => {
    await page.goto(`/app?${AT}`);
    await ready(page);
    const banner = page.locator('.demo-pill');
    const before = await banner.innerText();
    await page.locator('.lang-btn').click();
    await expect(banner).not.toHaveText(before);
    await expect(page.locator('html')).toHaveAttribute('lang', /ca|es/);
  });

  test('fora d’horari: missatge amb el primer bus', async ({ page }) => {
    await page.goto('/app?hora=03:00&dia=dimarts');
    await ready(page);
    await expect(page.locator('.no-service')).toContainText(/04:|05:/);
  });

  test('modal "què és real" explica la frontera real/simulat', async ({ page }) => {
    await page.goto(`/app?${AT}`);
    await page.locator('.demo-pill').click();
    const modal = page.getByRole('dialog');
    await expect(modal.locator('.about-lead')).toContainText(/simulades|simulados/);
    await expect(modal.locator('.about-real')).toBeVisible();
    await expect(modal.locator('.about-sim')).toBeVisible();
    await expect(modal).toContainText('tus.es');
  });

  test('mode presentació: demo narrada per escenes, sempre amb el banner', async ({ page, isMobile }) => {
    await page.goto(`/presentacio?${AT}`);
    await ready(page);
    const caption = page.locator('.caption');
    // pausa primer: amb la màquina carregada, la demo pot haver avançat d'escena abans de comprovar-ho
    await expect(caption.locator('h2')).not.toHaveText('');
    await page.keyboard.press(' ');
    // a l'escena 1 («Quan arriba el meu bus?»), es torni d'on es torni
    for (let i = 0; i < 10 && !/arriba|llega/i.test(await caption.locator('h2').innerText()); i++) await page.keyboard.press('ArrowLeft');
    await expect(caption.locator('h2')).toContainText(/arriba|llega/i);
    if (!isMobile) {
      const n = Number(await page.locator('.hud-num').first().innerText());
      expect(n).toBeGreaterThan(30);
    }
    await expect(page.locator('.honesty')).toContainText(/simulad/i);
    await page.keyboard.press('ArrowRight');
    await expect(caption.locator('h2')).toContainText(/L\d/);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.bus-card')).toBeVisible();
    await expect(page.locator('.bus-card .bc-foot')).toContainText(/simulat|simulado/i);
  });

  test('enfocar una línia: es destaca i la resta s’atenua (no s’amaga)', async ({ page, isMobile }) => {
    await page.goto(`/mapa?${AT}`);
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
    await expect(card.locator('.tl-bar')).toBeVisible();
    // seguir-lo al mapa
    const follow = card.locator('.cta', { hasText: /Segueix|Síguelo|Deixa|Dejar/ });
    await follow.click();
    await expect(follow).toHaveAttribute('aria-pressed', 'true');
    // «Agafaré aquest bus»: la fitxa passa a ser el viatge (la teva parada, quant falta, a quantes parades)
    await card.locator('.cta-primary').click();
    const focus = card.locator('.trip-focus');
    await expect(focus).toBeVisible();
    await expect(focus).toContainText('Estació Centre');
    await expect(focus.locator('.tf-away')).toContainText(/parad|capçalera|cabecera|anterior/i);
    await expect(card.locator('.tl-tag.board')).toBeVisible();
    await expect(card.locator('.cta', { hasText: /Deixa de seguir|Dejar de seguir/ })).toBeVisible();
    // el viatge (myBus) es manté en recarregar
    await page.goto(`/app?${AT}`);
    await ready(page);
    const trip = page.locator('.trip-card');
    await expect(trip).toBeVisible();
    await expect(trip).toContainText('Estació Centre');
    await trip.getByRole('button', { name: /Deixa de seguir|Dejar de seguir/ }).click();
    await expect(trip).toHaveCount(0);
  });

  test('sense connexió: continua funcionant amb simulació local', async ({ page, context }) => {
    await page.goto(`/app?${AT}`);
    await ready(page);
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 20_000 });
    await context.setOffline(true);
    await expect(page.locator('.offline-note')).toBeVisible();
    await page.goto(`/parada/17?${AT}`).catch(() => undefined);
    // amb el service worker, la ruta torna a carregar sense xarxa
    await expect(page.locator('.stop-name')).toHaveText('Manresa', { timeout: 20_000 });
    await context.setOffline(false);
  });

  test('inici senzill: «On vols anar?», on ets i res més; una parada porta a la ruta', async ({ page, isMobile }) => {
    await page.goto(`/app?${AT}`);
    await ready(page);
    await expect(page.locator('.simple-title')).toContainText(/On vols anar|Adónde quieres ir/);
    await expect(page.locator('.simple-loc')).toBeVisible();
    // res de proper bus, preferides ni suggeriments a l'inici
    await expect(page.locator('.hero')).toHaveCount(0);
    await expect(page.locator('.home-stop')).toHaveCount(0);
    // navegació: Inici · Mapa · Línies · Compte, sense l'operador
    const nav = page.locator(isMobile ? '.bottomnav' : '.topnav');
    await expect(nav).toBeVisible();
    await expect(nav.locator('button')).toHaveCount(4);
    await expect(nav).toContainText(/Compte|Cuenta/);
    await expect(nav).not.toContainText(/Xarxa|Red/);
    await expect(page.locator('.demo-pill')).toBeVisible();
    // escric una parada → em diu quin bus agafar
    await page.getByRole('combobox').fill('estació centre');
    await page.locator('.sr-item[id^="sr-s"]').first().click();
    await expect(page).toHaveURL(/\/ruta\/p/);
  });

  test('xarxa en directe: mètriques derivades de la flota simulada, etiquetades', async ({ page }) => {
    await page.goto(`/xarxa?${AT}`);
    await ready(page);
    const net = page.locator('.network');
    await expect(net.locator('.kpi')).toHaveCount(4);
    const inService = Number(await net.locator('.kpi-n').first().innerText());
    expect(inService).toBeGreaterThan(30);
    expect(await net.locator('.fleet-row').count()).toBeGreaterThan(8);
    await expect(net).toContainText(/simulada/i);
  });

  test('parada: cada llegada diu a quantes parades és i la puntualitat', async ({ page }) => {
    await page.goto(`/parada/176?${AT}`);
    await ready(page);
    await expect(page.locator('.arrival .punct').first()).toBeVisible();
    await expect(page.locator('.arrival .punct').first()).toHaveAttribute('aria-label', /simulat|simulado/i);
  });
});

test.describe('com hi arribo (planificador)', () => {
  test.use({ geolocation: { longitude: 2.0866, latitude: 41.5759 }, permissions: ['geolocation'] });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(DEMO_SESSION);
  });

  test('escric un carrer: em diu quin bus agafar, on baixar i ho dibuixa al mapa', async ({ page }) => {
    await page.goto(`/app?${AT}`);
    await ready(page);
    await page.getByRole('combobox').fill('sant pere');
    const street = page.locator('.sr-item[id^="sr-c"]').first();
    await expect(street).toContainText(/Sant Pere/);
    await street.click();
    await expect(page).toHaveURL(/\/ruta\/c/);
    const first = page.locator('.best');
    await expect(first).toBeVisible({ timeout: 20000 });
    await expect(first.locator('.chip').first()).toHaveText(/^L\d+$/);
    await expect(first).toContainText(/Puja a/);
    await expect(first).toContainText(/Baixa a/);
    await expect(page.locator('.plan-note')).toContainText(/simulats/);
    // la ruta és al mapa
    const n = await page.evaluate(() => (window as unknown as { __app: { getState(): { plan: { itinerary: { legs: unknown[] } } | null } } }).__app?.getState().plan?.itinerary.legs.length ?? -1);
    expect(n === -1 || n >= 2).toBe(true);
  });

  test('un lloc pel nom que coneix la gent: «camp del mercantil»', async ({ page }) => {
    await page.goto(`/app?${AT}`);
    await ready(page);
    await page.getByRole('combobox').fill('camp del mercantil');
    const place = page.locator('.sr-item[id^="sr-l"]').first();
    await expect(place).toContainText('Arraona-Merinals');
    await place.click();
    await expect(page).toHaveURL(/\/ruta\/l/);
    await expect(page.locator('.best')).toBeVisible({ timeout: 20000 });
  });

  test('sense ubicació: tria d’on surts i també funciona', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, permissions: [] });
    const page = await ctx.newPage();
    await page.addInitScript(DEMO_SESSION);
    await page.goto(`/parada/176?${AT}`);
    await page.locator('.plan-to-stop').click();
    await expect(page).toHaveURL(/\/ruta\/p176/);
    await page.locator('.plan-from .text-btn').click();
    await page.locator('.plan-pick input').fill('can deu');
    await page.locator('.place-results button').first().click();
    await expect(page).toHaveURL(/de=/);
    await expect(page.locator('.best')).toBeVisible({ timeout: 20000 });
    await ctx.close();
  });
});

test.describe('el flux de l’app', () => {
  test.use({ geolocation: { longitude: 2.1035, latitude: 41.5463 }, permissions: ['geolocation'] });

  test('entrar → ubicació → «On vols anar?» → millor opció (puja, quan passa, baixa) → on és el bus', async ({ page }) => {
    await page.goto(`/app?${AT}`);
    await expect(page).toHaveURL(/\/entra/);
    await page.getByRole('button', { name: /sense compte|sin cuenta/i }).click();
    await page.getByRole('button', { name: /Permet la ubicació|Permitir la ubicación/ }).click();
    await expect(page.locator('.simple-title')).toBeVisible();
    await expect(page.locator('.simple-loc')).toContainText(/a prop de|cerca de/i);
    await page.getByRole('combobox').fill('hospital parc tauli');
    await page.locator('.sr-item[id^="sr-l"]').first().click();
    const best = page.locator('.best');
    await expect(best).toBeVisible({ timeout: 20000 });
    await expect(best.locator('.best-tag')).toContainText(/Millor opció|Mejor opción/);
    await expect(best.locator('.chip').first()).toHaveText(/^L\d+$/);
    await expect(best).toContainText(/Puja a|Sube en/);
    await expect(best).toContainText(/Baixa a|Baja en/);
    await expect(best.locator('.seg-min').first()).toHaveText(/\d|Ara|Ahora/);
    // res de pas a pas a peu
    await expect(page.locator('.route-panel')).not.toContainText(/Camina \d+ m|Camina \d+ m/);
    expect(await page.locator('.alt').count()).toBeLessThanOrEqual(2);
    // el recorregut, i on és el bus
    await best.getByRole('button', { name: /Recorregut|Recorrido/ }).click();
    await expect(best.locator('.ride-stops li').first()).toBeVisible();
    const where = best.getByRole('button', { name: /On és el bus|Dónde está el bus/ });
    if (await where.count()) {
      await where.click();
      await expect(page.locator('.bus-card')).toBeVisible();
    }
  });
});

/** proveïdor de llocs simulat: les proves no depenen de Photon/Google (ni de la xarxa) */
const PLACES = {
  source: 'photon',
  attribution: '© OpenStreetMap contributors · Photon',
  results: [
    { id: 'osm:N1', name: 'Info Express', label: 'Can Oriach · Sabadell', kind: 'computer', lon: 2.123, lat: 41.5505 },
    { id: 'osm:N2', name: 'Info Express', label: 'Terrassa', kind: 'computer', lon: 2.03, lat: 41.56 },
  ],
};
async function stubPlaces(page: Page, calls: string[] = []) {
  await page.route('**/api/places**', (route) => {
    calls.push(route.request().url());
    const q = new URL(route.request().url()).searchParams.get('q') ?? '';
    return route.fulfill({ json: /info/i.test(q) ? PLACES : { ...PLACES, results: [] } });
  });
}

test.describe('cerca universal i ubicació', () => {
  // sense service worker: si no, les peticions a /api/places no passen pel proveïdor simulat
  test.use({ geolocation: { longitude: 2.1035, latitude: 41.5463 }, permissions: ['geolocation'], serviceWorkers: 'block' });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(DEMO_SESSION);
  });

  test('«Info Express» (un comerç, no una parada) → quin bus, on pujar, quan, on baixar i a quants metres', async ({ page }) => {
    const calls: string[] = [];
    await stubPlaces(page, calls);
    await page.goto(`/app?${AT}`);
    await expect(page.locator('.simple-loc')).toHaveAttribute('data-loc', 'ok');
    await page.getByRole('combobox').pressSequentially('Info Express', { delay: 40 });
    const hit = page.locator('.sr-item[id^="sr-g"]').first();
    await expect(hit).toContainText('Info Express');
    await expect(hit).toContainText(/Can Oriach/);
    // el més proper primer, amb la distància
    await expect(hit).toContainText(/a \d|km/);
    await expect(page.locator('.sr-attr')).toContainText('OpenStreetMap');
    // debounce: escriure 12 lletres no fa 12 peticions
    expect(calls.length).toBeLessThanOrEqual(2);
    // la ubicació no s'envia al servidor de llocs
    for (const c of calls) expect(c).not.toMatch(/lat=|lon=|2\.10|41\.54/);
    await hit.click();
    await expect(page).toHaveURL(/\/ruta\/g/);
    await expect(page.locator('.route-panel .stop-name')).toHaveText('Info Express');
    const best = page.locator('.best');
    await expect(best).toBeVisible({ timeout: 20000 });
    await expect(best.locator('.chip').first()).toHaveText(/^L\d+$/);
    await expect(best).toContainText(/Puja a|Sube en/);
    await expect(best).toContainText(/Baixa a|Baja en/);
    await expect(best.locator('.seg-dest')).toContainText(/Info Express (és|está)/);
  });

  test('lloc que no existeix → «No hem trobat aquest lloc», sense inventar res', async ({ page }) => {
    await stubPlaces(page);
    await page.goto(`/app?${AT}`);
    await page.getByRole('combobox').fill('zzqx botiga inexistent');
    await expect(page.locator('.sr-empty')).toContainText(/No hem trobat|No hemos encontrado/);
  });

  test('enllaços manipulats: codi de lloc fals i URL mal codificada no peten', async ({ page }) => {
    await page.goto(`/ruta/g2.1,41.5,%3Cscript%3E?${AT}`);
    await expect(page.locator('.route-panel .stop-name')).toHaveText('—');
    // URL mal codificada dins l'app (enllaç intern o historial): a l'inici, sense petar
    await page.evaluate(() => {
      history.pushState(null, '', '/ruta/%E0%A4%A');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page.locator('.simple-title')).toBeVisible();
    // un nom amb HTML es mostra com a text
    const evil = 'g2.110000,41.556000,' + Buffer.from(JSON.stringify(['<img src=x onerror=alert(1)>', ''])).toString('base64url');
    await page.goto(`/ruta/${evil}?${AT}`);
    await expect(page.locator('.route-panel .stop-name')).toHaveText('<img src=x onerror=alert(1)>');
    expect(await page.locator('.route-panel img').count()).toBe(0);
  });
});

test.describe('ubicació denegada', () => {
  test('l’app no es bloqueja: explica com activar-la i deixa triar d’on surts', async ({ browser }) => {
    const ctx = await browser.newContext({ permissions: [] });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('nextmobility.session', JSON.stringify({ userId: 'demo', at: Date.now() }));
      localStorage.setItem('nextmobility.locAsked', '1');
      // simula «Bloquejar» al diàleg del navegador
      const deny = (_ok: unknown, err: (e: { code: number }) => void) => setTimeout(() => err({ code: 1 }), 50);
      Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: deny, watchPosition: () => 0, clearWatch: () => {} } });
    });
    await page.goto(`/app?${AT}`);
    await expect(page.locator('.simple-loc')).toHaveAttribute('data-loc', 'denied');
    await expect(page.locator('.simple-loc')).toContainText(/No podem accedir|No podemos acceder/);
    await expect(page.locator('.simple-title')).toBeVisible();
    await page.goto(`/ruta/p278?${AT}`);
    await expect(page.locator('.plan-pick')).toBeVisible();
    await expect(page.locator('.plan-pick input')).toBeVisible();
    await ctx.close();
  });
});

test.describe('seguretat', () => {
  for (const next of ['/' + String.fromCharCode(92) + 'evil.example', '//evil.example', 'https://evil.example']) {
    test(`després d'entrar, ?next=${next} no surt de l'app`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('nextmobility.locAsked', '1'));
      await page.goto(`/entra?next=${encodeURIComponent(next)}&${AT}`);
      await page.getByRole('button', { name: /sense compte|sin cuenta/i }).click();
      await expect(page.locator('.simple-title')).toBeVisible();
      expect(new URL(page.url()).host).toBe('localhost:4173');
      expect(new URL(page.url()).pathname).toBe('/app');
    });
  }
});

test.describe('landing i comptes', () => {
  test('landing pública: el benefici al titular, demo etiquetada, honestedat i no oficial (sense carregar el mapa)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.lnd-hero h1')).toContainText(/bus/i);
    await expect(page.locator('.lnd-nav .logo-name')).toContainText('NextMobility');
    await expect(page.locator('.lnd-honest')).toContainText(/simulad/i);
    await expect(page.locator('.demo-card')).toContainText(/Demostració/);
    await expect(page.locator('.demo-card')).toContainText('Rambla');
    await expect(page.locator('.lnd-footer')).toContainText(/no és una app oficial/i);
    await expect(page.locator('canvas.maplibregl-canvas')).toHaveCount(0);
    await expect(page).toHaveTitle(/NextMobility Sabadell/);
  });

  test('«Prova-ho ara» (web) entra a l’app; l’app sense sessió demana entrar i torna on anava', async ({ page }) => {
    await page.goto(`/?${AT}`);
    await page.locator('.lnd-hero .btn-primary').click();
    // primer cop: el pas d'ubicació
    await expect(page.locator('.welcome')).toBeVisible();
    await page.getByRole('button', { name: /Ara no|Ahora no/ }).click();
    await expect(page.locator('.simple-title')).toBeVisible();
    // enllaç directe sense sessió → entrar → torna a la parada
    await page.evaluate(() => localStorage.removeItem('nextmobility.session'));
    await page.goto(`/parada/176?${AT}`);
    await expect(page).toHaveURL(/\/entra/);
    await page.getByRole('button', { name: /sense compte|sin cuenta/i }).click();
    await expect(page).toHaveURL(/\/parada\/176/);
    await expect(page.locator('.stop-name')).toHaveText('Estació Centre');
  });

  test('de la demostració a un compte propi: la parada desada es queda', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('nextmobility.locAsked', '1'));
    await page.goto(`/parada/176?${AT}`);
    await page.getByRole('button', { name: /sense compte|sin cuenta/i }).click();
    await expect(page.locator('.stop-name')).toHaveText('Estació Centre');
    await page.getByRole('button', { name: /Afegeix a preferides|Añadir a favoritas/ }).first().click();
    await page.goto('/meus');
    await expect(page.locator('.account-card.demo')).toBeVisible();
    await page.locator('.account-card.demo .cta-primary').click();
    await expect(page).toHaveURL(/\/registre/);
    await page.getByLabel(/^Nom|^Nombre/).fill('Laia');
    await page.getByLabel(/Correu|Correo/).fill(`laia-${Date.now()}@exemple.cat`);
    await page.getByLabel(/Contrasenya|Contraseña/).fill('una-contrasenya-llarga');
    await page.getByRole('button', { name: /Crea el compte|Crear la cuenta/ }).click();
    await expect(page).toHaveURL(/\/app/);
    const favs = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('favs:') && k !== 'favs:demo').map((k) => localStorage.getItem(k)));
    expect(favs.join('')).toContain('176');
  });

  test('crear compte, tancar la sessió i tornar a entrar; contrasenya incorrecta', async ({ page, isMobile }) => {
    await page.goto('/registre');
    const email = `prova-${Date.now()}@exemple.cat`;
    await page.getByLabel(/^Nom|^Nombre/).fill('Pau Prova');
    await page.getByLabel(/Correu|Correo/).fill(email);
    await page.getByLabel(/Contrasenya|Contraseña/).fill('curta');
    await page.getByRole('button', { name: /Crea el compte|Crear la cuenta/ }).click();
    await expect(page.locator('.auth-error')).toContainText(/8/);
    await page.getByLabel(/Contrasenya|Contraseña/).fill('una-contrasenya-llarga');
    await page.getByRole('button', { name: /Crea el compte|Crear la cuenta/ }).click();
    // després d'entrar: la ubicació (un cop) i l'inici, amb el nom
    await expect(page.locator('.welcome h1')).toContainText('Pau');
    await page.getByRole('button', { name: /Ara no|Ahora no/ }).click();
    await expect(page).toHaveURL(/\/app/);
    await expect(page.locator('.simple-title')).toBeVisible();
    await expect(page.locator('.simple-hello')).toContainText('Pau');
    // sortir des de «Compte»
    await page.goto('/meus');
    await expect(page.locator('.account-card')).toContainText(email);
    await page.locator('.account-card .cta').click();
    await expect(page).toHaveURL(/\/$|\/entra/);
    // contrasenya incorrecta → missatge; correcta → a dins
    await page.goto('/entra');
    await page.getByLabel(/Correu|Correo/).fill(email);
    await page.getByLabel(/Contrasenya|Contraseña/).fill('dolenta-123');
    await page.getByRole('button', { name: /^Entra$|^Entrar$/ }).click();
    await expect(page.locator('.auth-error')).toBeVisible();
    await page.getByLabel(/Contrasenya|Contraseña/).fill('una-contrasenya-llarga');
    await page.getByRole('button', { name: /^Entra$|^Entrar$/ }).click();
    await expect(page).toHaveURL(/\/app/);
    if (!isMobile) await expect(page.locator('.avatar')).toHaveText('P');
  });
});
