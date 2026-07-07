/** Canonical origin for social.pocketedge OAuth redirects. */
export const SOCIAL_PRODUCTION_ORIGIN = 'https://social.pocketedge.in';

export function getSocialOrigin() {
  const configured = import.meta.env.VITE_SOCIAL_SITE_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined') return window.location.origin;
  return SOCIAL_PRODUCTION_ORIGIN;
}

export function isSocialOrigin(originOrUrl) {
  try {
    const origin =
      typeof originOrUrl === 'string' && /^https?:\/\//i.test(originOrUrl)
        ? new URL(originOrUrl).origin
        : originOrUrl;
    if (origin === getSocialOrigin()) return true;
    if (origin === SOCIAL_PRODUCTION_ORIGIN) return true;
    if (import.meta.env.DEV && origin === 'http://localhost:5175') return true;
    return false;
  } catch {
    return false;
  }
}

export function isAllowedAuthRedirect(urlString) {
  if (!urlString || typeof window === 'undefined') return false;
  try {
    const target = new URL(urlString, window.location.origin);
    return target.origin === window.location.origin || isSocialOrigin(target.origin);
  } catch {
    return false;
  }
}
