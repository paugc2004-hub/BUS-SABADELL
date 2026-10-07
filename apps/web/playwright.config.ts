import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  // el mapa es pinta de debò (WebGL per programari): massa en paral·lel satura l'equip i fa proves inestables
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:4173',
    timezoneId: 'Europe/Madrid',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, locale: 'ca-ES' } },
    { name: 'iphone-13', use: { ...devices['iPhone 13'], browserName: 'chromium', locale: 'ca-ES' } },
    { name: 'android', use: { ...devices['Pixel 7'], locale: 'es-ES' } },
  ],
  webServer: process.env.BASE_URL ? undefined : { command: 'npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: !process.env.CI },
});
