import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

import './styles/tokens.css';
import './styles/base.css';
import './styles/glass.css';
import './styles/animations.css';
import './styles/app.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register the service worker once the page is idle so it never competes with
// the first render. Disabled in dev, where Vite serves modules directly.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Whether a worker was already running when this page loaded. If one was,
  // a later `controllerchange` means a *new* deploy took over, and the assets
  // this document is holding are stale — so reload once to pick up the new
  // ones. Without this an open tab can keep running a build whose files the
  // CDN no longer serves.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch((error) => console.warn('[posterfy] service worker registration failed', error));
  });
}
