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
    const fallback = Number(portfolio?.todayPnlPct ?? portfolio?.dayReturnPct ?? portfolio?.day_return_pct);
    return Number.isFinite(fallback) ? fallback : null;
  }

  return weighted / weightSum;
}

/** Idea narrative prefers thesis, then objective. */
export function getIdeaNarrative(portfolio) {
  const thesis = String(portfolio?.thesis ?? '').trim();
  const objective = String(portfolio?.objective ?? '').trim();
  const looksLikeCode =
    /AMFI\s*\d+/i.test(objective) || /^INF[A-Z0-9]+$/i.test(objective);

  if (thesis && !/^Open Ended Schemes/i.test(thesis)) return thesis;
  if (objective && !looksLikeCode) return objective;

  const schemeMatch = thesis.match(/Equity Scheme\s*-\s*([^)·]+)/i);
  if (schemeMatch) return `${schemeMatch[1].trim()} idea`;

  const thematic = thesis.match(/\(([^)]+)\)/);
  if (thematic && !/open ended/i.test(thematic[1])) return thematic[1].trim();

  if (thesis) return thesis.split('·')[0].trim();
  return '';
}

export function formatIdeaReturn(pct) {
  if (pct == null || !Number.isFinite(Number(pct))) return '—';
  return formatPct(Number(pct));
}

export function ideaReturnClass(pct) {
  if (pct == null || !Number.isFinite(Number(pct))) return 'text-pe-text-muted';
  return pnlClass(Number(pct));
}
