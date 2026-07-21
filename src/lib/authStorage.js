/** Shared auth storage across pocketedge.in subdomains (social + main).
 *
 * Session lives in a first-party cookie (JS-readable so Supabase client can
 * attach the user JWT — required while we still call Supabase from the browser).
 * We no longer mirror the session into localStorage (reduces XSS blast radius).
 * Full httpOnly-only auth needs a BFF and is intentionally not enabled yet.
 */

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
      // One-time migration from legacy localStorage sessions, then clear.
      try {
        const legacy = window.localStorage.getItem(key);
        if (legacy != null) {
          writeCookie(`${COOKIE_PREFIX}${key}`, legacy);
          window.localStorage.removeItem(key);
          return legacy;
        }
      } catch {
        /* ignore */
      }
      return null;
    },
    setItem(key, value) {
      writeCookie(`${COOKIE_PREFIX}${key}`, value);
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
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
