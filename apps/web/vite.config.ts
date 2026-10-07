import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { Connect } from 'vite';

/** en local (dev i preview), la mateixa funció serverless de /api/places que a Vercel */
const placesApi: Connect.NextHandleFunction = (req, res) => {
  // @ts-expect-error mòdul JS de la funció serverless (sense tipus)
  void import('./api/places.mjs').then((m: { default: (q: unknown, s: unknown) => Promise<void> }) => m.default(req, res));
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-places-local',
      configureServer: (s) => void s.middlewares.use('/api/places', placesApi),
      configurePreviewServer: (s) => void s.middlewares.use('/api/places', placesApi),
    },
    VitePWA({
      registerType: 'autoUpdate',
      // registre del service worker amb un <script> a l'HTML (el detecten PWABuilder i les botigues)
      injectRegister: 'script-defer',
      includeAssets: ['icons/*.svg', 'icons/*.png'],
      manifest: {
        name: 'NextMobility Sabadell',
        short_name: 'NextMobility',
        description: 'Digues on vols anar i et diem quin bus de Sabadell agafar, on pujar, quan arriba i on baixar. Prototip amb vehicles simulats a partir dels horaris publicats.',
        id: '/app',
        lang: 'ca',
        dir: 'ltr',
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        // 'tabbed' encara no és als tipus de vite-plugin-pwa
        display_override: ['window-controls-overlay', 'tabbed', 'standalone', 'minimal-ui'] as unknown as ['standalone'],
        orientation: 'portrait',
        background_color: '#f6f5f1',
        theme_color: '#ffffff',
        categories: ['travel', 'navigation', 'utilities'],
        prefer_related_applications: false,
        related_applications: [],
        launch_handler: { client_mode: ['navigate-existing', 'auto'] },
        edge_side_panel: { preferred_width: 420 },
        // accessos directes (mantenir premuda la icona)
        shortcuts: [
          { name: 'On vols anar?', short_name: 'On vas?', url: '/cercar', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Mapa', short_name: 'Mapa', url: '/mapa', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Línies', short_name: 'Línies', url: '/linia', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
        ],
        // compartir un lloc des d'una altra app (p. ex. un enllaç o una adreça) → el busca
        share_target: { action: '/cercar', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
        // enllaços web+nextmobility:<destí> obren l'app amb la cerca
        protocol_handlers: [{ protocol: 'web+nextmobility', url: '/cercar?text=%s' }],
        screenshots: [
          { src: '/screenshots/home.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'On vols anar? Escriu un lloc, un carrer o una parada' },
          { src: '/screenshots/result.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Millor opció: quin bus, on pujar, quan arriba i on baixar' },
          { src: '/screenshots/stop.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Propers busos a una parada' },
          { src: '/screenshots/wide.png', sizes: '1440x900', type: 'image/png', form_factor: 'wide', label: 'La ruta i el bus al mapa' },
        ],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}', 'landing/map-desktop.jpg', 'assets/inter-latin-wght-*.woff2', 'assets/jetbrains-mono-latin-*.woff2', 'data/*.json'],
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // les captures del manifest no cal tenir-les sense connexió
        globIgnores: ['screenshots/**'],
        navigateFallback: '/index.html',
        // mai a la memòria cau: l'stream de vehicles ni l'API en directe
        navigateFallbackDenylist: [/^\/v1\//, /^\/health/, /^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/v1/') || url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => /tiles\.openfreemap\.org|basemaps\.cartocdn\.com/.test(url.host),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'basemap', expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 14 } },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
    // sense mapes de codi en producció: no publiquem el codi font (el repositori és privat)
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { manualChunks: { maplibre: ['maplibre-gl'] } } },
  },
  server: { port: 5173 },
});
