/** Round absolute money into integer Indian units — never show paisa / decimals. */
function formatInrCompact(abs, negative) {
  const sign = negative ? '−' : '';
  if (abs >= 1_00_00_000) {
    return `${sign}₹${Math.round(abs / 1_00_00_000)}Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${Math.round(abs / 1_00_000)}L`;
  }
  if (abs >= 1_000) {
    return `${sign}₹${Math.round(abs / 1_000)}K`;
  }
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

export function formatInr(n, { compact = false } = {}) {
  if (n == null || Number.isNaN(n)) return '-';
  const value = Number(n);
  if (!Number.isFinite(value)) return '-';
  const abs = Math.abs(value);
  if (compact) return formatInrCompact(abs, value < 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(value));
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
