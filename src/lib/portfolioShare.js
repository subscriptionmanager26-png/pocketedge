import {
  getHoldingTotalReturnPct,
  getPortfolioTotalReturnPct,
  STOCKS,
} from '../data/mockData';
import { holdingDisplayLabel } from './portfolioAssetUniverse';

export const TOP_SHARE_HOLDINGS = 10;
export const TOP_SHARE_PERFORMERS = 5;
export const COMPOSE_SHARE_HOLDINGS = 5;

export const SHARE_SORT_ALLOCATION = 'allocation';
export const SHARE_SORT_PERFORMANCE = 'performance';

function holdingWeight(holding, totalValue) {
  const fromWeight = Number(holding?.weightPct ?? holding?.weight);
  if (Number.isFinite(fromWeight) && fromWeight > 0) return fromWeight;
  const value = Number(holding?.value) || 0;
  return totalValue > 0 ? (value / totalValue) * 100 : 0;
}

function holdingSectorKey(holding, asset) {
  const raw =
    holding?.sector ||
    holding?.category ||
    asset?.sector ||
    asset?.category ||
    asset?.subCategory ||
    holding?.assetType ||
    asset?.kind ||
    'Other';
  return String(raw).trim() || 'Other';
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
    sector: holdingSectorKey(holding, asset),
    logoIconUrl,
    weight: Number(holdingWeight(holding, totalValue).toFixed(1)),
    totalReturnPct: getHoldingTotalReturnPct(holding, asset),
  };
}

function buildRows(portfolio, assetsByKey = {}) {
  const holdings = (portfolio.holdings ?? []).filter(Boolean);
  if (holdings.length) {
    const totalValue = holdings.reduce((sum, h) => sum + (Number(h.value) || 0), 0);
    return holdings.map((h) => mapHoldingRow(h, assetsByKey[h.ticker], totalValue));
  }

  const tickers = portfolio.tickers ?? [];
  const equal = tickers.length ? 100 / tickers.length : 0;
  return tickers.map((ticker) => {
    const asset = assetsByKey[ticker];
    return {
      ticker,
      label: holdingDisplayLabel({ ticker, assetType: asset?.kind }, asset),
      name: asset?.name ?? STOCKS[ticker]?.name ?? '',
      assetType: asset?.kind ?? 'stock',
      sector: holdingSectorKey({ ticker }, asset),
      logoIconUrl: asset?.logoIconUrl ?? null,
      weight: Number(equal.toFixed(1)),
      totalReturnPct: getHoldingTotalReturnPct({ ticker }, asset),
    };
  });
}

/**
 * Build a privacy-safe portfolio snapshot for share images / OG cards.
 * Includes allocation top-N and performance top-N for the bubble template.
 */
export function buildPortfolioShareSnapshot(
  portfolio,
  {
    sort = SHARE_SORT_ALLOCATION,
    limit = TOP_SHARE_HOLDINGS,
    assetsByKey = {},
  } = {}
) {
  if (!portfolio) return null;

  const rows = buildRows(portfolio, assetsByKey);
  const byAllocation = [...rows].sort((a, b) => b.weight - a.weight);
  const byPerformance = [...rows].sort((a, b) => b.totalReturnPct - a.totalReturnPct);
  const topHoldings =
    sort === SHARE_SORT_PERFORMANCE
      ? byPerformance.slice(0, limit)
      : byAllocation.slice(0, limit);

  const sectorsCount = new Set(rows.map((row) => row.sector)).size;
  const tickers = rows.map((h) => h.ticker).filter(Boolean);

  return {
    portfolioId: portfolio.id,
    name: portfolio.name,
    thesis: portfolio.thesis ?? portfolio.objective ?? '',
    sort,
    returnPct: Number(getPortfolioTotalReturnPct(portfolio)) || 0,
    holdingsCount: rows.length,
    sectorsCount,
    topHoldings,
    topByAllocation: byAllocation.slice(0, TOP_SHARE_HOLDINGS),
    topPerformers: byPerformance.slice(0, TOP_SHARE_PERFORMERS),
    tickers,
  };
}

export function buildPortfolioShare(portfolio) {
  return buildPortfolioShareSnapshot(portfolio, {
    sort: SHARE_SORT_ALLOCATION,
    limit: COMPOSE_SHARE_HOLDINGS,
  });
}

export function portfolioSharePath(portfolioId, { sort } = {}) {
  const id = String(portfolioId ?? '').trim();
  if (!id) return '/feed';
  const params = new URLSearchParams();
  if (sort && sort !== SHARE_SORT_ALLOCATION) params.set('sort', sort);
  const query = params.toString();
  return query
    ? `/share/portfolio/${encodeURIComponent(id)}?${query}`
    : `/share/portfolio/${encodeURIComponent(id)}`;
}

export function absolutePortfolioShareUrl(portfolioId, { sort, origin } = {}) {
  const base = (
    origin ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://www.pocketedge.in')
  ).replace(/\/$/, '');
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

export function ownerPossessiveLabel(handle) {
  const raw = String(handle ?? '')
    .replace(/^@/, '')
    .trim();
  if (!raw) return 'My';
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);
  return /s$/i.test(label) ? `${label}'` : `${label}'s`;
}

/** Max chars before ellipsis — bubbles (large / small) and allocation tiles. */
export const SHARE_LABEL_BUBBLE_LG = 28;
export const SHARE_LABEL_BUBBLE_SM = 24;
export const SHARE_LABEL_TILE = 48;

export function shortShareLabel(label, max = 16) {
  const text = String(label ?? '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
