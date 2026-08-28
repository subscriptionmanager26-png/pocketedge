/** OpenFin lives at openfin.pocketedge.in — separate from the social app. */

export const OPENFIN_ORIGIN = 'https://openfin.pocketedge.in';
export const OPENFIN_HOST = 'openfin.pocketedge.in';
export const WWW_ORIGIN = 'https://www.pocketedge.in';

export function isOpenFinHost(hostname) {
  const host =
    hostname ??
    (typeof window !== 'undefined' ? window.location.hostname : '');
  return host === OPENFIN_HOST;
}

/**
 * Path or absolute URL to an OpenFin section.
 * @param {'products'|'api'|'docs'|'roadmap'|null|undefined} section
 * @param {{ absolute?: boolean }} [opts] — force full URL (use when linking from www)
 */
export function openfinPath(section, { absolute = false } = {}) {
  const key = String(section ?? '')
    .trim()
    .toLowerCase();
  let path = '/';
  if (key === 'api' || key === 'docs') path = '/docs';
  else if (key === 'roadmap') path = '/roadmap';

  if (absolute || !isOpenFinHost()) {
    return path === '/' ? OPENFIN_ORIGIN : `${OPENFIN_ORIGIN}${path}`;
  }
  return path;
}

/** API base for docs examples (always on OpenFin host). */
export function openfinApiOrigin() {
  return OPENFIN_ORIGIN;
}

/** Absolute URL on www.pocketedge.in for market tools linked from OpenFin. */
export function wwwPath(pathname) {
  const path = String(pathname ?? '').startsWith('/') ? pathname : `/${pathname ?? ''}`;
  return `${WWW_ORIGIN}${path}`;
}

/**
 * @param {string} pathname
 * @returns {{ section: 'products'|'api'|'roadmap' }}
 */
export function parseOpenFinPath(pathname) {
  const path = String(pathname || '/').replace(/\/$/, '') || '/';
  if (path === '/roadmap' || path === '/openfin/roadmap') return { section: 'roadmap' };
  if (path === '/docs' || path === '/openfin/api') return { section: 'api' };
  return { section: 'products' };
}

/** Legacy www paths → OpenFin subdomain (for client-side redirect fallback). */
export function openfinLegacyRedirect(pathname) {
  const match = String(pathname || '').match(/^\/openfin(?:\/(api|roadmap))?\/?$/);
  if (!match) return null;
  const section = match[1] || 'products';
  return openfinPath(section === 'products' ? null : section, { absolute: true });
}
