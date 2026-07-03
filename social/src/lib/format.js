export function formatInr(n, { compact = false } = {}) {
  if (n == null || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (compact) {
    if (abs >= 1_00_00_000) return `${n < 0 ? '−' : ''}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
    if (abs >= 1_00_000) return `${n < 0 ? '−' : ''}₹${(abs / 1_00_000).toFixed(2)}L`;
    if (abs >= 1_000) return `${n < 0 ? '−' : ''}₹${(abs / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: abs >= 100 ? 0 : 2,
  }).format(n);
}

export function formatPct(n, { signed = true } = {}) {
  if (n == null || Number.isNaN(n)) return '—';
  const sign = signed && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function formatPrice(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatCount(n) {
  if (n >= 1_00_000) return `${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
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
