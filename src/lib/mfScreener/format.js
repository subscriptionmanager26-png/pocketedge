import { getFundReturn, parseUpvalyMetric } from './metrics';

export function formatAum(cr) {
  if (cr == null || !Number.isFinite(cr)) return '—';
  if (cr >= 1000) return `₹${(cr / 1000).toFixed(1)}k Cr`;
  return `₹${cr.toFixed(1)} Cr`;
}

export function formatTer(pct) {
  if (pct == null || !Number.isFinite(pct)) return '—';
  return `${pct.toFixed(1)}%`;
}

export function formatRatio(n, digits = 1) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

export function formatVolatility(pct) {
  if (pct == null || !Number.isFinite(pct)) return '—';
  return `${pct.toFixed(1)}%`;
}

export function formatReturnPct(valuePct) {
  if (valuePct == null || !Number.isFinite(valuePct)) return '—';
  const sign = valuePct >= 0 ? '+' : '−';
  return `${sign}${Math.abs(valuePct).toFixed(1)}%`;
}

export function formatCategoryRank(rank) {
  if (rank == null || !Number.isFinite(rank)) return '—';
  return String(Math.round(rank));
}

export function returnTone(valuePct) {
  if (valuePct == null || !Number.isFinite(valuePct)) return 'text-pe-text-muted';
  if (valuePct > 0) return 'text-pe-positive';
  if (valuePct < 0) return 'text-pe-negative';
  return 'text-pe-text-muted';
}

export function shortCategoryLabel(label) {
  return String(label ?? '')
    .replace(/ Fund$/, '')
    .replace(/^Equity Scheme - /, '');
}

export function cellNumeric(col, scheme) {
  if (col.kind === 'fundamental') {
    switch (col.id) {
      case 'aum':
        return scheme?.aumCr ?? null;
      case 'ter':
        return scheme?.expenseRatio ?? null;
      case 'pe':
        return parseUpvalyMetric(scheme?.fundamentals?.pe);
      case 'categoryRank':
        return scheme?.categoryRank3y ?? null;
      default:
        return null;
    }
  }
  if (col.kind === 'risk') {
    switch (col.id) {
      case 'volatility':
        return scheme?.volatility3y ?? null;
      case 'sharpe':
        return scheme?.sharpe3y ?? null;
      case 'sortino':
        return scheme?.sortino3y ?? null;
      default:
        return null;
    }
  }
  if (col.kind === 'rolling') {
    return scheme?.rollingByPeriod?.[col.period]?.average ?? null;
  }
  if (col.period === '3y' || col.period === '5y') {
    return scheme?.cagrByPeriod?.[col.period] ?? null;
  }
  return getFundReturn(scheme, col.period)?.valuePct ?? null;
}

export function formatDisplayCell(col, value) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (col.kind === 'fundamental') {
    if (col.id === 'aum') return formatAum(value);
    if (col.id === 'ter') return formatTer(value);
    if (col.id === 'categoryRank') return formatCategoryRank(value);
    return formatRatio(value, 1);
  }
  if (col.kind === 'risk') {
    if (col.id === 'volatility') return formatVolatility(value);
    return formatRatio(value, 1);
  }
  return formatReturnPct(value);
}

export function sortValue(row, key, metrics) {
  const m = metrics[row.amfiCode];
  switch (key) {
    case 'name':
      return row.amcSortKey;
    case 'roll_1y':
      return m?.rollingByPeriod?.['1y']?.average ?? Number.NEGATIVE_INFINITY;
    case 'roll_3y':
      return m?.rollingByPeriod?.['3y']?.average ?? Number.NEGATIVE_INFINITY;
    case 'roll_5y':
      return m?.rollingByPeriod?.['5y']?.average ?? Number.NEGATIVE_INFINITY;
    case 'cagr_1y':
      return getFundReturn(m, '1y')?.valuePct ?? Number.NEGATIVE_INFINITY;
    case 'cagr_3y':
      return m?.cagrByPeriod?.['3y'] ?? Number.NEGATIVE_INFINITY;
    case 'cagr_5y':
      return m?.cagrByPeriod?.['5y'] ?? Number.NEGATIVE_INFINITY;
    case 'volatility_3y':
      return m?.volatility3y ?? Number.NEGATIVE_INFINITY;
    case 'sharpe_3y':
      return m?.sharpe3y ?? Number.NEGATIVE_INFINITY;
    case 'sortino_3y':
      return m?.sortino3y ?? Number.NEGATIVE_INFINITY;
    case 'cat_rank_3y':
      return m?.categoryRank3y ?? Number.POSITIVE_INFINITY;
    case 'aum':
      return m?.aumCr ?? Number.NEGATIVE_INFINITY;
    case 'ter':
      return m?.expenseRatio != null ? -m.expenseRatio : Number.NEGATIVE_INFINITY;
    case 'pe':
      return parseUpvalyMetric(m?.fundamentals?.pe) ?? Number.NEGATIVE_INFINITY;
    default:
      return row.name;
  }
}
