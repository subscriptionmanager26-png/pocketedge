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

/** Bump when logo paths/variants change — busts poisoned browser 404 disk cache. */
export const LOGO_ASSET_CACHE_VERSION = '4';

function withLogoCacheBust(path) {
  const raw = typeof path === 'string' ? path.trim() : '';
  if (!raw.startsWith('/asset-logos/')) return raw || null;
  const base = raw.split('?')[0];
  return `${base}?v=${LOGO_ASSET_CACHE_VERSION}`;
}

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
  if (raw.startsWith('/asset-logos/')) return withLogoCacheBust(raw);
  // Legacy proxy path from the first deploy attempt.
  if (raw.startsWith('/api/asset-logos/')) {
    return withLogoCacheBust(`/asset-logos/${raw.slice('/api/asset-logos/'.length)}`);
  }

  try {
    const absolute = raw.startsWith('http')
      ? new URL(raw)
      : new URL(raw, FALLBACK_SUPABASE_URL);
    const idx = absolute.pathname.indexOf(OBJECT_MARKER);
    if (idx >= 0) {
      return withLogoCacheBust(
        `/asset-logos/${absolute.pathname.slice(idx + OBJECT_MARKER.length)}`
      );
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
  // AMC logos live under stock/amc_{id}/ — not fund/{schemeCode}/.
  if (type === 'fund') return null;
  // Index/commodity/ETF logos are ingested under stock/{asset_key}/ (same bucket layout as equities).
  const folder = type === 'index' || type === 'commodity' || type === 'etf' ? 'stock' : type;
  return `${base}${OBJECT_MARKER}${folder}/${encodeURIComponent(key)}/${variant}`;
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

/** Shared with AssetLogo — warmed by preloadAssetLogos. */
export const loadedLogoSrcCache = new Set();
/** Skip re-requesting icons that 404 (common for ETF/fund/index). */
export const failedLogoSrcCache = new Set();

export function markLogoSrcLoaded(src) {
  if (!src) return;
  loadedLogoSrcCache.add(src);
  failedLogoSrcCache.delete(src);
}

export function markLogoSrcFailed(src) {
  if (src) failedLogoSrcCache.add(src);
}

/**
 * Pick a circle backdrop so light/white marks stay visible on the UI.
 * @returns {'light' | 'dark'}
 */
export function detectLogoBackdropTone(img) {
  if (typeof document === 'undefined' || !img?.naturalWidth) return 'light';

  try {
    const sampleSize = 32;
    const canvas = document.createElement('canvas');
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 'light';

    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
    const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);

    let opaque = 0;
    let lumSum = 0;
    let light = 0;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 48) continue;
      opaque++;
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      lumSum += lum;
      if (lum > 200) light++;
    }

    if (!opaque) return 'light';

    const avgLum = lumSum / opaque;
    const lightShare = light / opaque;
    if (lightShare > 0.45 && avgLum > 160) return 'dark';
    if (avgLum > 210) return 'dark';
    return 'light';
  } catch {
    return 'light';
  }
}

const LOGO_BACKDROP_CLASS = {
  light: 'bg-pe-surface',
  dark: 'bg-zinc-800',
};

export function logoBackdropClass(tone) {
  return LOGO_BACKDROP_CLASS[tone === 'dark' ? 'dark' : 'light'];
}

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
    const finish = (ok) => {
      preloadInflight.delete(src);
      preloadDone.add(src);
      if (ok) markLogoSrcLoaded(src);
      pump();
    };
    img.onload = () => finish(true);
    // Do not mark preload failures in failedLogoSrcCache — a transient miss must
    // not block AssetLogo from mounting the <img> (desktop list rows depend on it).
    img.onerror = () => finish(false);
    img.src = src;
  }

  for (let w = 0; w < workers; w += 1) pump();
}
