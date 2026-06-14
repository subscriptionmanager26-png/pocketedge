import React from 'react';
import ReactDOM from 'react-dom/client';
import { PostHogProvider } from '@posthog/react';
import App from './App';
import './index.css';
import { initPostHog, isPostHogEnabled, posthog } from './posthog';

if (isPostHogEnabled) {
  initPostHog();
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PostHogProvider client={isPostHogEnabled ? posthog : undefined}>
      <App />
    </PostHogProvider>
  </React.StrictMode>
);
