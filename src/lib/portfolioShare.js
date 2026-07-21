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

/** Invisible share-row columns (logo | name | value). */
export const SHARE_COL_LOGO = 28;
/** ~10% wider than prior 58px so +/- percentages don't clip. */
export const SHARE_COL_VALUE = 64;
export const SHARE_COL_GAP = 6;
/** Single-line row; two-line names grow naturally. */
export const SHARE_ROW_MIN_HEIGHT = 34;
export const SHARE_NAME_FONT_SIZE = 10;
export const SHARE_NAME_LINE_HEIGHT = 1.3;
export const SHARE_NAME_MAX_LINES = 2;
/** Approx chars per line for OG/Satori 2-line wrap (tighter name column). */
export const SHARE_NAME_CHARS_PER_LINE = 32;

export const SHARE_COLOR_TEXT = '#111827';
export const SHARE_COLOR_GREEN = '#16a34a';
export const SHARE_COLOR_RED = '#dc2626';
export const SHARE_COLOR_BRAND_GREEN = '#0e753f';

export function shortShareLabel(label, max = 16) {
  const text = String(label ?? '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function shareReturnColor(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n) || n === 0) return SHARE_COLOR_TEXT;
  if (n > 0) return SHARE_COLOR_GREEN;
  return SHARE_COLOR_RED;
}

/**
 * Split a security name into up to 2 lines for OG/Satori (no CSS line-clamp).
 * Truncates the second line with an ellipsis when needed.
 */
export function wrapShareLabel(label, maxCharsPerLine = SHARE_NAME_CHARS_PER_LINE) {
  const text = String(label ?? '').trim();
  if (!text) return [''];
  if (text.length <= maxCharsPerLine) return [text];

  const words = text.split(/\s+/);
  let line1 = '';
  let line2 = '';

  for (const word of words) {
    const next = line1 ? `${line1} ${word}` : word;
    if (!line2 && next.length <= maxCharsPerLine) {
      line1 = next;
      continue;
    }
    const next2 = line2 ? `${line2} ${word}` : word;
    if (next2.length <= maxCharsPerLine) {
      line2 = next2;
      continue;
    }
    if (!line2) {
      line2 = shortShareLabel(word, maxCharsPerLine);
      break;
    }
    line2 = shortShareLabel(next2, maxCharsPerLine);
    break;
  }

  if (!line1) return [shortShareLabel(text, maxCharsPerLine)];
  return line2 ? [line1, line2] : [line1];
}
