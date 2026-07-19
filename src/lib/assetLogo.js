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
 * Serve logos via same-origin `/api/asset-logos/...` so Vercel/browser can
 * cache aggressively (upstream Storage sends cache-control: no-cache).
 */
export function toCachedAssetLogoPath(url) {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw) return null;
  if (raw.startsWith('/api/asset-logos/')) return raw;

  try {
    const absolute = raw.startsWith('http')
      ? new URL(raw)
      : new URL(raw, FALLBACK_SUPABASE_URL);
    const idx = absolute.pathname.indexOf(OBJECT_MARKER);
    if (idx >= 0) {
      return `/api/asset-logos/${absolute.pathname.slice(idx + OBJECT_MARKER.length)}`;
    }
  } catch {
    /* keep absolute below */
  }
  return raw;
}

function buildPublicStorageUrl(assetType, assetKey) {
  const base = String(import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL)
    .trim()
    .replace(/\/$/, '');
  const type =
    String(assetType ?? 'stock')
      .trim()
      .toLowerCase() || 'stock';
  const key = storageObjectKey(assetKey);
  if (!base || !key || !STORAGE_ASSET_TYPES.has(type)) return null;
  return `${base}${OBJECT_MARKER}${type}/${encodeURIComponent(key)}/icon-256.png`;
}

/**
 * Prefer `logo_icon_url` from the row; otherwise build the public Storage URL.
 * Always rewrite to the cached same-origin proxy path when possible.
 */
export function resolveAssetLogoUrl({ logoIconUrl, assetType, assetKey } = {}) {
  const fromRow = typeof logoIconUrl === 'string' ? logoIconUrl.trim() : '';
  const absolute = fromRow || buildPublicStorageUrl(assetType, assetKey);
  return toCachedAssetLogoPath(absolute);
}

export function assetLogoInitial(label) {
  const raw = String(label ?? '').trim();
  if (!raw) return '?';
  const letter = raw.replace(/^[^A-Za-z0-9]+/, '').charAt(0);
  return (letter || raw.charAt(0)).toUpperCase();
}
