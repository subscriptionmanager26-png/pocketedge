import posthog from 'posthog-js';

const apiKey = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
const apiHost = import.meta.env.VITE_POSTHOG_HOST;

export const isPostHogEnabled = Boolean(apiKey && apiHost);

let initialized = false;

export function initPostHog() {
  if (!isPostHogEnabled || initialized) return posthog;

  posthog.init(apiKey, {
    api_host: apiHost,
    defaults: '2026-01-30',
    capture_pageview: 'history_change',
    person_profiles: 'identified_only',
    enableExceptionAutocapture: true,
  });

  initialized = true;
  return posthog;
}

export function identifyPostHogUser(user) {
  if (!isPostHogEnabled || !user?.id) return;
  posthog.identify(user.id, {
    email: user.email ?? undefined,
  });
}

export function resetPostHogUser() {
  if (!isPostHogEnabled) return;
  posthog.reset();
}

export { posthog };
