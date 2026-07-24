const UNIVERSE_URL = '/data/sgb/sgb-universe.json';

export async function loadSgbUniverse() {
  const res = await fetch(UNIVERSE_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load SGB universe (${res.status})`);
  return res.json();
}

/** Maturity year from NSE symbol suffix, e.g. SGBFEB32IV → 2032. */
export function maturityYearFromSymbol(symbol) {
  const m = String(symbol || '')
    .toUpperCase()
    .match(/(\d{2})(?:[IVXLCDM]+)?$/);
  if (!m) return null;
  const yy = Number(m[1]);
  if (!Number.isFinite(yy)) return null;
  return yy >= 70 ? 1900 + yy : 2000 + yy;
}

/** Coupon % from bond name when present. */
export function couponFromName(name) {
  const m = String(name || '').match(/([\d.]+)\s*%/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function formatInr(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatChangePct(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function changeTone(value) {
  if (value == null || !Number.isFinite(Number(value))) return 'text-pe-text-muted';
  const n = Number(value);
  if (n > 0) return 'text-emerald-600';
  if (n < 0) return 'text-red-600';
  return 'text-pe-text-secondary';
}

export function formatSyncedAt(iso) {
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
