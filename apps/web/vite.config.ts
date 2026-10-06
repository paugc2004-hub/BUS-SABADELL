import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.svg', 'icons/*.png'],
      manifest: {
        name: 'NextMobility Sabadell',
        short_name: 'NextMobility',
        description: 'El teu bus de Sabadell, en directe. Posicions simulades a partir dels horaris publicats.',
        lang: 'ca',
        start_url: '/app',
        display: 'standalone',
        background_color: '#08090b',
        theme_color: '#08090b',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}', 'landing/*.jpg', 'assets/inter-latin-wght-*.woff2', 'assets/jetbrains-mono-latin-*.woff2', 'data/*.json'],
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        // mai a la memòria cau: l'stream de vehicles ni l'API en directe
        navigateFallbackDenylist: [/^\/v1\//, /^\/health/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/v1/'),
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
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { manualChunks: { maplibre: ['maplibre-gl'] } } },
  },
  server: { port: 5173 },
});
