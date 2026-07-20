import {
  getHoldingTotalReturnPct,
  getPortfolioReturn,
  STOCKS,
} from '../data/mockData';
import { holdingDisplayLabel } from './portfolioAssetUniverse';

export const TOP_SHARE_HOLDINGS = 10;
export const COMPOSE_SHARE_HOLDINGS = 5;

export const SHARE_SORT_ALLOCATION = 'allocation';
export const SHARE_SORT_PERFORMANCE = 'performance';

function holdingWeight(holding, totalValue) {
  const fromWeight = Number(holding?.weightPct ?? holding?.weight);
  if (Number.isFinite(fromWeight) && fromWeight > 0) return fromWeight;
  const value = Number(holding?.value) || 0;
  return totalValue > 0 ? (value / totalValue) * 100 : 0;
}

function mapHoldingRow(holding, asset, totalValue) {
  const label = holdingDisplayLabel(holding, asset);
  const assetType = holding?.assetType ?? asset?.kind ?? 'stock';
  const logoIconUrl =
    holding?.logoIconUrl ??
    holding?.logo_icon_url ??
    asset?.logoIconUrl ??
    null;
  return {
    ticker: holding.ticker,
    label,
    name: holding?.assetName ?? asset?.name ?? STOCKS[holding.ticker]?.name ?? '',
    assetType,
    logoIconUrl,
    weight: Number(holdingWeight(holding, totalValue).toFixed(1)),
    totalReturnPct: getHoldingTotalReturnPct(holding, asset),
  };
}

/**
 * Build a privacy-safe portfolio snapshot for share images / OG cards.
 * @param {object} portfolio
 * @param {{ sort?: 'allocation'|'performance', period?: string, limit?: number, assetsByKey?: Record<string, object> }} options
 */
export function buildPortfolioShareSnapshot(
  portfolio,
  {
    sort = SHARE_SORT_ALLOCATION,
    period = '1M',
    limit = TOP_SHARE_HOLDINGS,
    assetsByKey = {},
  } = {}
) {
  if (!portfolio) return null;

  const holdings = (portfolio.holdings ?? []).filter(Boolean);
  let rows = [];

  if (holdings.length) {
    const totalValue = holdings.reduce((sum, h) => sum + (Number(h.value) || 0), 0);
    rows = holdings.map((h) => mapHoldingRow(h, assetsByKey[h.ticker], totalValue));
  } else {
    const tickers = portfolio.tickers ?? [];
    const equal = tickers.length ? 100 / tickers.length : 0;
    rows = tickers.map((ticker) => {
      const asset = assetsByKey[ticker];
      return {
        ticker,
        label: holdingDisplayLabel({ ticker, assetType: asset?.kind }, asset),
        name: asset?.name ?? STOCKS[ticker]?.name ?? '',
        assetType: asset?.kind ?? 'stock',
        logoIconUrl: asset?.logoIconUrl ?? null,
        weight: Number(equal.toFixed(1)),
        totalReturnPct: getHoldingTotalReturnPct({ ticker }, asset),
      };
    });
  }

  const sorted =
    sort === SHARE_SORT_PERFORMANCE
      ? [...rows].sort((a, b) => b.totalReturnPct - a.totalReturnPct)
      : [...rows].sort((a, b) => b.weight - a.weight);

  const topHoldings = sorted.slice(0, limit);
  const tickers = holdings.length
    ? holdings.map((h) => h.ticker).filter(Boolean)
    : (portfolio.tickers ?? []);

  return {
    portfolioId: portfolio.id,
    name: portfolio.name,
    thesis: portfolio.thesis ?? portfolio.objective ?? '',
    period,
    sort,
    returnPct: Number(getPortfolioReturn(portfolio, period)) || 0,
    holdingsCount: rows.length,
    topHoldings,
    tickers,
  };
}

/** @deprecated Use buildPortfolioShareSnapshot for new share flows. */
export function buildPortfolioShare(portfolio, period = '1M') {
  return buildPortfolioShareSnapshot(portfolio, {
    sort: SHARE_SORT_ALLOCATION,
    period,
    limit: COMPOSE_SHARE_HOLDINGS,
  });
}

export function portfolioSharePath(portfolioId, { sort } = {}) {
  const id = String(portfolioId ?? '').trim();
  if (!id) return '/feed';
  const params = new URLSearchParams();
  if (sort && sort !== SHARE_SORT_ALLOCATION) params.set('sort', sort);
  const query = params.toString();
  return query ? `/share/portfolio/${encodeURIComponent(id)}?${query}` : `/share/portfolio/${encodeURIComponent(id)}`;
}

export function absolutePortfolioShareUrl(portfolioId, { sort, origin } = {}) {
  const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : 'https://www.pocketedge.in')).replace(/\/$/, '');
  return `${base}${portfolioSharePath(portfolioId, { sort })}`;
}

export function portfolioShareCaption(snapshot, url) {
  if (!snapshot) return url ?? '';
  const name = snapshot.name?.trim();
  const intro = name
    ? `Check out my portfolio "${name}" on PocketEdge`
    : 'Check out my portfolio on PocketEdge';
  return url ? `${intro}\n${url}` : intro;
}

export function defaultPortfolioShareBody(share) {
  if (!share) return '';
  if (share.thesis) return share.thesis;
  const names = (share.topHoldings ?? [])
    .slice(0, 3)
    .map((h) => `@${h.ticker}`)
    .join(' ');
  return names
    ? `Sharing my portfolio focus - ${names}`
    : `Sharing my portfolio: ${share.name}`;
}
