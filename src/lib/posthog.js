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

let posthog = null;
let initialized = false;
let initPromise = null;

async function loadPostHog() {
  if (!isPostHogEnabled) return null;
  if (posthog) return posthog;
  if (!initPromise) {
    initPromise = import('posthog-js').then(({ default: ph }) => {
      posthog = ph;
      return ph;
    });
  }
  return initPromise;
}

export async function initPostHog() {
  if (!isPostHogEnabled || initialized) return posthog;
  const ph = await loadPostHog();
  if (!ph || initialized) return ph;

  ph.init(apiKey, {
    api_host: apiHost,
    defaults: '2026-01-30',
    capture_pageview: 'history_change',
    person_profiles: 'identified_only',
    enableExceptionAutocapture: true,
    cross_subdomain_cookie: isPocketEdgeHost(),
    persistence: 'localStorage+cookie',
  });

  initialized = true;
  return ph;
}

export function identifyPostHogUser(user) {
  if (!isPostHogEnabled || !user?.id) return;
  initPostHog().then((ph) => {
    ph?.identify(user.id, { email: user.email ?? undefined });
  });
}

export function resetPostHogUser() {
  if (!isPostHogEnabled || !posthog) return;
  posthog.reset();
}

export { posthog };
