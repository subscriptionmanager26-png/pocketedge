const SESSION_KEY = 'pe_social_session';
const ONBOARDING_KEY = 'pe_social_onboarding';

export function skipAuthForDev() {
  return new URLSearchParams(window.location.search).get('skipAuth') === '1';
}

export function loadSession() {
  if (skipAuthForDev()) {
    return { userId: 'u_me', email: 'demo@pocketedge.in', isNew: false };
  }
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ONBOARDING_KEY);
}

export function isOnboardingComplete() {
  if (skipAuthForDev()) return true;
  return localStorage.getItem(ONBOARDING_KEY) === '1';
}

export function setOnboardingComplete() {
  localStorage.setItem(ONBOARDING_KEY, '1');
}

export function resolveAuthView() {
  if (skipAuthForDev()) return 'app';
  const session = loadSession();
  if (!session) return 'landing';
  if (!isOnboardingComplete()) return 'onboarding';
  return 'app';
}
