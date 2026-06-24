import React from 'react';
import ReactDOM from 'react-dom/client';
import { PostHogProvider } from '@posthog/react';
import App from './App';
import './index.css';
import './legacy/light-theme/legacy.css';
import './redesign/redesignTheme.css';
import { initAppTheme } from './redesignFlags';
import RedesignDevBar from './redesign/RedesignDevBar';
import RedesignRoot from './redesign/RedesignRoot';
import { initPostHog, isPostHogEnabled, posthog } from './posthog';

initAppTheme();

if (isPostHogEnabled) {
  initPostHog();
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PostHogProvider client={isPostHogEnabled ? posthog : undefined}>
      <RedesignRoot>
        <App />
      </RedesignRoot>
      <RedesignDevBar />
    </PostHogProvider>
  </React.StrictMode>
);
