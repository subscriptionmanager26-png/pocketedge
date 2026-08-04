/**
 * Compact INR with Indian units.
 * - Under 1,000: whole rupees only (≤3 digits, no decimals)
 * - With K / L / Cr: up to 2 decimals after the unit scale
 * - Coefficient ≥100 (3 digits): whole number, no decimals
 */
function formatUnitCoefficient(value) {
  const rounded = Math.round(value * 100) / 100;
  if (rounded >= 100) return String(Math.round(rounded));
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

function formatInrCompact(abs, negative) {
  const sign = negative ? '−' : '';

  // Prefer the next unit when rounding would produce a 3-digit coefficient (100K → 1L).
  if (abs >= 1_00_00_000 || Math.round((abs / 1_00_000) * 100) / 100 >= 100) {
    return `${sign}₹${formatUnitCoefficient(abs / 1_00_00_000)}Cr`;
  }
  if (abs >= 1_00_000 || Math.round((abs / 1_000) * 100) / 100 >= 100) {
    return `${sign}₹${formatUnitCoefficient(abs / 1_00_000)}L`;
  }
  if (abs >= 1_000) {
    return `${sign}₹${formatUnitCoefficient(abs / 1_000)}K`;
  }
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

/** Absolute money amounts — always unit-scaled (K / L / Cr). `compact` kept for call-site compat. */
export function formatInr(n, { compact: _compact = false } = {}) {
  if (n == null || Number.isNaN(n)) return '-';
  const value = Number(n);
  if (!Number.isFinite(value)) return '-';
  return formatInrCompact(Math.abs(value), value < 0);
}

export function formatPct(n, { signed = true } = {}) {
  if (n == null || Number.isNaN(n)) return '-';
  const sign = signed && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function formatPrice(n) {
  if (n == null || Number.isNaN(n)) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}

/** Absolute day move from quote fields (prefers explicit change / previous close). */
export function dayChangeAmount({ price, changePct, previousClose, change } = {}) {
  if (change != null && Number.isFinite(Number(change))) return Number(change);
  const px = Number(price);
  const prev = Number(previousClose);
  if (Number.isFinite(px) && Number.isFinite(prev)) return px - prev;
  const pct = Number(changePct);
  if (Number.isFinite(px) && Number.isFinite(pct)) return px * (pct / 100);
  return null;
}

export function formatCount(n) {
  if (n == null || Number.isNaN(n)) return '0';
  const value = Math.round(Number(n));
  if (value >= 1_00_000) return `${Math.round(value / 1_00_000)}L`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

export function formatNewsDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** NAV as-of label like "3rd Aug 2026" from YYYY-MM-DD (IST calendar, no TZ shift). */
export function formatNavDate(ymd) {
  if (!ymd) return '';
  const raw = String(ymd).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return formatNewsDate(ymd);
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isFinite(year) || monthIdx < 0 || monthIdx > 11 || !Number.isFinite(day)) {
    return formatNewsDate(ymd);
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const j = day % 10;
  const k = day % 100;
  let suffix = 'th';
  if (j === 1 && k !== 11) suffix = 'st';
  else if (j === 2 && k !== 12) suffix = 'nd';
  else if (j === 3 && k !== 13) suffix = 'rd';
  return `${day}${suffix} ${months[monthIdx]} ${year}`;
}

export function timeAgo(iso) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const mins = Math.max(1, Math.round((now - then) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export function pnlClass(n) {
  if (n > 0) return 'text-pe-positive';
  if (n < 0) return 'text-pe-negative';
  return 'text-pe-text-secondary';
}
