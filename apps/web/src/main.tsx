import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import './styles.css';
import { App } from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA: el service worker es registra amb un <script> a l'HTML (vite-plugin-pwa, injectRegister: 'script-defer').
// Cacheja l'app i la xarxa (mai l'stream de vehicles).
