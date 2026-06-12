/** Canonical site origin for OAuth redirects (set VITE_SITE_URL in production). */
export function getSiteOrigin() {
  const configured = import.meta.env.VITE_SITE_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function toAbsoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return getSiteOrigin();
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl, `${getSiteOrigin()}/`).toString();
}

export function isSameSiteUrl(urlString) {
  if (!urlString || typeof window === 'undefined') return false;
  try {
    const target = new URL(urlString, window.location.origin);
    const site = new URL(getSiteOrigin());
    return target.origin === window.location.origin || target.origin === site.origin;
  } catch {
    return false;
  }
}
