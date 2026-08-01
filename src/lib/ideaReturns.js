import { formatPct, pnlClass } from '../lib/format';

/** Weight-averaged 1D % from public holdings (changePct × weightPct). */
export function getPortfolioDayReturnPct(portfolio) {
  const holdings = portfolio?.holdings ?? [];
  let weightSum = 0;
  let weighted = 0;

  for (const holding of holdings) {
    const weight = Number(holding.weightPct ?? holding.weight);
    const change = Number(holding.changePct ?? holding.change_pct);
    if (!(weight > 0) || !Number.isFinite(change)) continue;
    weightSum += weight;
    weighted += weight * change;
  }

  if (weightSum <= 0) {
    const fallback = Number(
      portfolio?.todayPnlPct ?? portfolio?.dayReturnPct ?? portfolio?.day_return_pct
    );
    return Number.isFinite(fallback) ? fallback : null;
  }

  return weighted / weightSum;
}

/** Ideas surface uses thesis only — no objective / AMFI fallbacks. */
export function getIdeaThesis(portfolio) {
  return String(portfolio?.thesis ?? '').trim();
}

/** @deprecated Use getIdeaThesis for Ideas cards. */
export function getIdeaNarrative(portfolio) {
  return getIdeaThesis(portfolio);
}

export function formatIdeaReturn(pct) {
  if (pct == null || !Number.isFinite(Number(pct))) return '—';
  return formatPct(Number(pct));
}

export function ideaReturnClass(pct) {
  if (pct == null || !Number.isFinite(Number(pct))) return 'text-pe-text-muted';
  return pnlClass(Number(pct));
}
