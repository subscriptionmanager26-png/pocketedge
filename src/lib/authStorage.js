/** Shared auth storage across pocketedge.in subdomains (social + main).
 *
 * localStorage is the source of truth (sessions + PKCE code verifiers).
 * Cookie mirror is best-effort for small values / cross-subdomain handoff.
 */

const COOKIE_PREFIX = 'pe_sb_';
const POST_AUTH_REDIRECT_COOKIE = 'pe_post_auth_redirect';
const POST_AUTH_REDIRECT_MAX_AGE_SEC = 30 * 60;
/** Browsers typically reject cookies above ~4KB; leave headroom for attributes. */
const MAX_COOKIE_VALUE_CHARS = 3200;

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

/** True if this looks like a (possibly truncated) session blob — not a PKCE verifier. */
function isSessionShaped(raw) {
  if (!raw || typeof raw !== 'string') return false;
  if (!raw.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.access_token || parsed?.currentSession?.access_token || parsed?.user);
  } catch {
    return false;
  }
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
      // Always return localStorage as-is — includes PKCE code-verifier strings.
      try {
        const fromLs = window.localStorage.getItem(key);
        if (fromLs != null) return fromLs;
      } catch {
        /* ignore */
      }

      const fromCookie = readCookie(`${COOKIE_PREFIX}${key}`);
      if (fromCookie == null) return null;

      // Prefer valid session cookies; ignore truncated junk.
      if (isSessionShaped(fromCookie) || !fromCookie.startsWith('{')) {
        try {
          window.localStorage.setItem(key, fromCookie);
        } catch {
          /* ignore */
        }
        return fromCookie;
      }

      deleteCookie(`${COOKIE_PREFIX}${key}`);
      return null;
    },
    setItem(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* ignore quota errors */
      }

      const encodedLen = encodeURIComponent(String(value ?? '')).length;
      if (encodedLen <= MAX_COOKIE_VALUE_CHARS) {
        writeCookie(`${COOKIE_PREFIX}${key}`, value);
      } else {
        deleteCookie(`${COOKIE_PREFIX}${key}`);
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
