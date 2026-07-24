import { ETF_INAV_CATEGORIES, ETF_INAV_CATEGORY_SHORT } from './categories';

const SNAPSHOT_URL = '/data/etf-inav/etf-inav-snapshot.json';

export { ETF_INAV_CATEGORIES, ETF_INAV_CATEGORY_SHORT };

export async function loadEtfInavSnapshot() {
  const res = await fetch(SNAPSHOT_URL, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`Failed to load ETF iNAV snapshot (${res.status})`);
  }
  return res.json();
}

export function formatPrice(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** LTP / iNAV ratio, e.g. 1.0023 */
export function formatPremiumRatio(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toFixed(4);
}

/** (LTP/iNAV - 1) * 100 as signed percent */
export function formatPremiumPct(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

/**
 * Premium when LTP/iNAV > 1 (red), discount when < 1 (green).
 */
export function premiumTone(ratio) {
  if (ratio == null || !Number.isFinite(Number(ratio))) return 'text-pe-text-muted';
  const n = Number(ratio);
  if (n > 1) return 'text-red-600';
  if (n < 1) return 'text-emerald-600';
  return 'text-pe-text-secondary';
}

export function premiumLabel(ratio) {
  if (ratio == null || !Number.isFinite(Number(ratio))) return '—';
  const n = Number(ratio);
  if (n > 1) return 'Premium';
  if (n < 1) return 'Discount';
  return 'Fair';
}

export function formatSnapshotTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
