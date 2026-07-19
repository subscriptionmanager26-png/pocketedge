const STORAGE_ASSET_TYPES = new Set([
  'stock',
  'etf',
  'fund',
  'commodity',
  'bond',
  'index',
]);

/** Public Pocket Edge Supabase — used when VITE_SUPABASE_URL is missing. */
const FALLBACK_SUPABASE_URL = 'https://zweqxjeuwwfrlpbuuayg.supabase.co';

const OBJECT_MARKER = '/storage/v1/object/public/asset-logos/';

/** List rows are ≤32px (≤96 CSS px on 3x); 128px icons are enough and ~3× smaller. */
export const LOGO_VARIANT_LIST = 'icon-128.png';
/** Detail headers (~48px) keep the sharper 256 asset. */
export const LOGO_VARIANT_DETAIL = 'icon-256.png';

const ICON_FILE_RE = /\/icon-(?:64|128|256)\.png$/i;

/**
 * Storage object keys sanitize some characters (e.g. M&M → M_M).
 */
function storageObjectKey(assetKey) {
  return String(assetKey ?? '')
    .trim()
    .replace(/&/g, '_')
    .replace(/\s+/g, '_');
}

/**
 * Swap icon-256 ↔ icon-128 (and normalize any icon-*.png) in a logo path/URL.
 */
export function withLogoVariant(url, variant = LOGO_VARIANT_LIST) {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw || !variant) return raw || null;
  if (ICON_FILE_RE.test(raw)) {
    return raw.replace(ICON_FILE_RE, `/${variant}`);
  }
  if (raw.includes('/asset-logos/') && !raw.endsWith('.png')) {
    return `${raw.replace(/\/$/, '')}/${variant}`;
  }
  return raw;
}

/**
 * Serve logos via same-origin `/asset-logos/...` (Vercel CDN rewrite + long
 * Cache-Control). Upstream Storage sends cache-control: no-cache.
 */
export function toCachedAssetLogoPath(url) {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw) return null;
  if (raw.startsWith('/asset-logos/')) return raw;
  // Legacy proxy path from the first deploy attempt.
  if (raw.startsWith('/api/asset-logos/')) {
    return `/asset-logos/${raw.slice('/api/asset-logos/'.length)}`;
  }

  try {
    const absolute = raw.startsWith('http')
      ? new URL(raw)
      : new URL(raw, FALLBACK_SUPABASE_URL);
    const idx = absolute.pathname.indexOf(OBJECT_MARKER);
    if (idx >= 0) {
      return `/asset-logos/${absolute.pathname.slice(idx + OBJECT_MARKER.length)}`;
    }
  } catch {
    /* keep absolute below */
  }
  return raw;
}

function buildPublicStorageUrl(assetType, assetKey, variant = LOGO_VARIANT_LIST) {
  const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_SUPABASE_URL
      : undefined;
  const base = String(envUrl || FALLBACK_SUPABASE_URL)
    .trim()
    .replace(/\/$/, '');
  const type =
    String(assetType ?? 'stock')
      .trim()
      .toLowerCase() || 'stock';
  const key = storageObjectKey(assetKey);
  if (!base || !key || !STORAGE_ASSET_TYPES.has(type)) return null;
  return `${base}${OBJECT_MARKER}${type}/${encodeURIComponent(key)}/${variant}`;
}

/**
 * Prefer `logo_icon_url` from the row; otherwise build the public Storage URL.
 * Always rewrite to the cached same-origin path when possible, and downscale
 * list icons to icon-128 (DB rows still point at icon-256).
 */
export function resolveAssetLogoUrl({
  logoIconUrl,
  assetType,
  assetKey,
  variant = LOGO_VARIANT_LIST,
} = {}) {
  const fromRow = typeof logoIconUrl === 'string' ? logoIconUrl.trim() : '';
  const absolute =
    withLogoVariant(fromRow, variant) ||
    buildPublicStorageUrl(assetType, assetKey, variant);
  return toCachedAssetLogoPath(absolute);
}

export function assetLogoInitial(label) {
  const raw = String(label ?? '').trim();
  if (!raw) return '?';
  const letter = raw.replace(/^[^A-Za-z0-9]+/, '').charAt(0);
  return (letter || raw.charAt(0)).toUpperCase();
}

const preloadInflight = new Set();
const preloadDone = new Set();

/**
 * Warm the browser HTTP cache for upcoming logo URLs (list-sized 128px).
 * Caps concurrency so we don't flood the connection pool.
 */
export function preloadAssetLogos(entries, { limit = 40, variant = LOGO_VARIANT_LIST } = {}) {
  if (typeof window === 'undefined' || !Array.isArray(entries) || !entries.length) {
    return;
  }

  const urls = [];
  for (const entry of entries) {
    if (urls.length >= limit) break;
    const src = resolveAssetLogoUrl({
      logoIconUrl: entry?.logoIconUrl ?? entry?.logo_icon_url,
      assetType: entry?.assetType ?? entry?.kind ?? entry?.type,
      assetKey: entry?.assetKey ?? entry?.symbol ?? entry?.id ?? entry?.ticker,
      variant,
    });
    if (!src || preloadDone.has(src) || preloadInflight.has(src)) continue;
    urls.push(src);
  }

  let i = 0;
  const workers = Math.min(6, urls.length);

  function pump() {
    if (i >= urls.length) return;
    const src = urls[i++];
    preloadInflight.add(src);
    const img = new Image();
    img.decoding = 'async';
    const finish = () => {
      preloadInflight.delete(src);
      preloadDone.add(src);
      pump();
    };
    img.onload = finish;
    img.onerror = finish;
    img.src = src;
  }

  for (let w = 0; w < workers; w += 1) pump();
}
