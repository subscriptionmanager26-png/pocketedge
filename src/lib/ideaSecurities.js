/**
 * Ideas hub helpers — individual securities (stocks, funds, ETFs, commodities, bonds).
 */

export const IDEA_ASSET_TYPES = [
  { id: 'all', label: 'All', tab: null },
  { id: 'stock', label: 'Stocks', tab: 'stocks' },
  { id: 'fund', label: 'Funds', tab: 'mutual_funds' },
  { id: 'etf', label: 'ETF', tab: 'etf' },
  { id: 'commodity', label: 'Commodity', tab: 'commodity' },
  { id: 'bond', label: 'Bonds', tab: null },
];

export const IDEA_MARKET_TABS = ['stocks', 'mutual_funds', 'etf', 'commodity'];

const TYPE_LABEL = {
  stock: 'Stock',
  fund: 'Fund',
  etf: 'ETF',
  commodity: 'Commodity',
  bond: 'Bond',
  index: 'Index',
};

export function ideaAssetTypeLabel(assetType) {
  return TYPE_LABEL[assetType] ?? 'Security';
}

/** Stable key for list/rail identity. */
export function ideaSecurityKey(item) {
  if (!item) return '';
  const type = String(item.assetType ?? item._ideaType ?? '').trim();
  const id = String(
    item.id ?? item.symbol ?? item.schemeCode ?? item.assetKey ?? item.name ?? ''
  ).trim();
  return id ? `${type}:${id}` : '';
}

/** Normalize a market preview / search / SGB row for Ideas UI. */
export function toIdeaSecurity(item, assetType) {
  if (!item) return null;
  const type = String(assetType || item.assetType || '').trim() || 'stock';
  const symbol = String(item.symbol ?? item.id ?? item.schemeCode ?? '').trim();
  const name = String(item.name ?? symbol).trim();
  if (!name && !symbol) return null;

  const price =
    item.price ?? item.ltp ?? item.nav ?? item.spotPrice ?? item.value ?? null;
  const changePct =
    item.changePct != null && Number.isFinite(Number(item.changePct))
      ? Number(item.changePct)
      : null;

  return {
    ...item,
    assetType: type,
    _ideaType: type,
    id: item.id ?? symbol,
    symbol: symbol || null,
    schemeCode: item.schemeCode ?? (type === 'fund' ? symbol : null),
    name,
    price: price != null && Number.isFinite(Number(price)) ? Number(price) : null,
    changePct,
    previousClose:
      item.previousClose != null && Number.isFinite(Number(item.previousClose))
        ? Number(item.previousClose)
        : null,
    logoIconUrl: item.logoIconUrl ?? item.logo_icon_url ?? null,
  };
}

export function rankTrendingSecurities(items, limit = 12) {
  return [...items]
    .filter((item) => item?.changePct != null && Number.isFinite(Number(item.changePct)))
    .sort((a, b) => Math.abs(Number(b.changePct)) - Math.abs(Number(a.changePct)))
    .slice(0, limit);
}

/** Secondary rail: largest positive 1D moves (attention proxy until holder counts exist). */
export function rankMostWatchedSecurities(items, limit = 12) {
  return [...items]
    .filter((item) => item?.changePct != null && Number.isFinite(Number(item.changePct)))
    .sort((a, b) => Number(b.changePct) - Number(a.changePct))
    .slice(0, limit);
}

export function openIdeaSecurity(item, handlers = {}) {
  if (!item) return;
  const type = item.assetType || item._ideaType;
  const {
    onSelectStock,
    onSelectFund,
    onSelectCommodity,
    onSelectIndex,
  } = handlers;

  if (type === 'fund') {
    onSelectFund?.(item.schemeCode || item.id || item.symbol, item);
    return;
  }
  if (type === 'commodity') {
    onSelectCommodity?.(item.id || item.symbol, item);
    return;
  }
  if (type === 'index') {
    onSelectIndex?.(item.id || item.symbol, item);
    return;
  }
  if (type === 'etf') {
    onSelectStock?.(item.symbol || item.id, { kind: 'etf', assetType: 'etf', seed: item });
    return;
  }
  // stock + bond (SGB) open as equity detail for now
  onSelectStock?.(item.symbol || item.id, { kind: 'stock', assetType: 'stock', seed: item });
}
