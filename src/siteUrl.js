/** Canonical site origin for the global tools app (set VITE_SITE_URL in production). */
import {
  GLOBAL_PRODUCTION_ORIGIN,
  SOCIAL_LEGACY_ORIGIN,
  SOCIAL_PRODUCTION_ORIGIN,
} from './origins';

export {
  GLOBAL_PRODUCTION_ORIGIN,
  SOCIAL_LEGACY_ORIGIN,
  SOCIAL_PRODUCTION_ORIGIN,
};

export function getSiteOrigin() {
  const configured = import.meta.env.VITE_SITE_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined') return window.location.origin;
  return GLOBAL_PRODUCTION_ORIGIN;
}

/** True for the social product hosts (www + legacy social subdomain). */
export function isSocialOrigin(originOrUrl) {
  try {
    const origin =
      typeof originOrUrl === 'string' && /^https?:\/\//i.test(originOrUrl)
        ? new URL(originOrUrl).origin
        : originOrUrl;
    if (origin === SOCIAL_PRODUCTION_ORIGIN) return true;
    if (origin === SOCIAL_LEGACY_ORIGIN) return true;
    if (import.meta.env.DEV && origin === 'http://localhost:5175') return true;
    return false;
  } catch {
    return false;
  }
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
    return (
      target.origin === window.location.origin ||
      target.origin === site.origin ||
      target.origin === GLOBAL_PRODUCTION_ORIGIN ||
      isSocialOrigin(target.origin)
    );
  } catch {
    return false;
  }
}
