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

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline / unsupported */
    });
  });
}
