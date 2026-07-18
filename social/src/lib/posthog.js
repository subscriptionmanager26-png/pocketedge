import posthog from 'posthog-js';

const apiKey = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
const apiHost = import.meta.env.VITE_POSTHOG_HOST;

function isLocalhost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function isPocketEdgeHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'pocketedge.in' || host.endsWith('.pocketedge.in');
}

export const isPostHogEnabled = Boolean(apiKey && apiHost && !isLocalhost());

let initialized = false;

export function initPostHog() {
  if (!isPostHogEnabled || initialized) return posthog;

  posthog.init(apiKey, {
    api_host: apiHost,
    defaults: '2026-01-30',
    capture_pageview: 'history_change',
    person_profiles: 'identified_only',
    enableExceptionAutocapture: true,
    // Share distinct_id across www / global / social / design.
    cross_subdomain_cookie: isPocketEdgeHost(),
    persistence: 'localStorage+cookie',
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
