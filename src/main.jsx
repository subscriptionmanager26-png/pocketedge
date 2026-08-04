import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import App from './App';
import './index.css';
import { registerPerfPostHog } from './lib/perfMarks';

function deferAnalytics() {
  const run = async () => {
    try {
      const { initPostHog, isPostHogEnabled, posthog } = await import('./lib/posthog');
      if (!isPostHogEnabled) return;
      await initPostHog();
      registerPerfPostHog((event, props) => posthog?.capture?.(event, props));
    } catch {
      /* analytics must not block app */
    }
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 3000 });
  } else {
    setTimeout(run, 1);
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

deferAnalytics();

async function runCacheRecoveryOnce() {
  if (typeof window === 'undefined') return;
  const KEY = 'pe_sw_recovery_v2';
  if (window.localStorage?.getItem(KEY) === 'done') return;

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister().catch(() => false)));
    }
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(
        keys
          .filter((name) => name.startsWith('pe-social-') || name === 'pe-social-v1')
          .map((name) => window.caches.delete(name).catch(() => false))
      );
    }
  } catch {
    // Recovery is best-effort; never block app boot.
  } finally {
    try {
      window.localStorage?.setItem(KEY, 'done');
    } catch {
      // ignore storage failures
    }
  }
}

void runCacheRecoveryOnce();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline / unsupported */
    });
  });
}
