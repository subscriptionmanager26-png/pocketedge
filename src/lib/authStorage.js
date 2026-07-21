/** Shared auth storage across pocketedge.in subdomains (social + main).
 *
 * Session is stored in localStorage (primary — sessions often exceed cookie size
 * limits) and mirrored to a cookie when small enough for cross-subdomain OAuth.
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

function looksLikeSession(raw) {
  if (!raw || typeof raw !== 'string') return false;
  try {
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.access_token || parsed?.currentSession?.access_token);
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
      // Prefer localStorage — full session survives; oversized cookies can truncate.
      try {
        const fromLs = window.localStorage.getItem(key);
        if (looksLikeSession(fromLs)) return fromLs;
      } catch {
        /* ignore */
      }

      const fromCookie = readCookie(`${COOKIE_PREFIX}${key}`);
      if (looksLikeSession(fromCookie)) {
        try {
          window.localStorage.setItem(key, fromCookie);
        } catch {
          /* ignore */
        }
        return fromCookie;
      }

      // Drop corrupt/truncated cookie so it cannot poison boot.
      if (fromCookie != null) deleteCookie(`${COOKIE_PREFIX}${key}`);
      return null;
    },
    setItem(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* ignore quota errors */
      }

      const encodedLen = encodeURIComponent(value).length;
      if (encodedLen <= MAX_COOKIE_VALUE_CHARS) {
        writeCookie(`${COOKIE_PREFIX}${key}`, value);
      } else {
        // Avoid writing a truncated cookie that would break the next read.
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
