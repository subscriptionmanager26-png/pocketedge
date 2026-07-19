/** Shared auth storage across pocketedge.in subdomains (social + main). */

const COOKIE_PREFIX = 'pe_sb_';
const POST_AUTH_REDIRECT_COOKIE = 'pe_post_auth_redirect';
const POST_AUTH_REDIRECT_MAX_AGE_SEC = 30 * 60;

function sharedCookieDomain() {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  if (host === 'localhost' || host.endsWith('.localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null;
  }
  if (host.endsWith('pocketedge.in')) return '.pocketedge.in';
  return null;
}

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name, value, { maxAgeDays = 30, maxAgeSec } = {}) {
  const domain = sharedCookieDomain();
  const maxAge = maxAgeSec ?? maxAgeDays * 86400;
  let cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  if (domain) cookie += `; domain=${domain}`;
  if (window.location.protocol === 'https:') cookie += '; Secure';
  document.cookie = cookie;
}

function deleteCookie(name) {
  const domain = sharedCookieDomain();
  let cookie = `${name}=; path=/; max-age=0`;
  if (domain) cookie += `; domain=${domain}`;
  document.cookie = cookie;
}

/** Cross-subdomain post-auth destination (survives OAuth landing on global.pocketedge.in). */
export function setPostAuthRedirect(url) {
  writeCookie(POST_AUTH_REDIRECT_COOKIE, url, { maxAgeSec: POST_AUTH_REDIRECT_MAX_AGE_SEC });
}

export function getPostAuthRedirect() {
  return readCookie(POST_AUTH_REDIRECT_COOKIE);
}

export function clearPostAuthRedirect() {
  deleteCookie(POST_AUTH_REDIRECT_COOKIE);
}

export function createSharedAuthStorage() {
  return {
    getItem(key) {
      const fromCookie = readCookie(`${COOKIE_PREFIX}${key}`);
      if (fromCookie != null) return fromCookie;
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      writeCookie(`${COOKIE_PREFIX}${key}`, value);
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* ignore quota errors */
      }
    },
    removeItem(key) {
      deleteCookie(`${COOKIE_PREFIX}${key}`);
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}
