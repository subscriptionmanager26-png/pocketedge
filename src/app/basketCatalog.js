import { formatRebalanceFrequency } from './rebalanceOptions';
import { CATALOG_SEED_BASKETS } from './catalogSeedData';
import { resolveCatalogBasketId } from './catalogIds';

/** Design-time fallback; production uses `fetchMarketplaceBaskets()`. */
export const catalogBaskets = CATALOG_SEED_BASKETS;

export { CATALOG_SEED_BASKETS };

export const stockUniverse = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'META', name: 'Meta' },
  { symbol: 'NFLX', name: 'Netflix' },
  { symbol: 'AMD', name: 'AMD' },
  { symbol: 'AVGO', name: 'Broadcom' },
  { symbol: 'TSM', name: 'TSMC' },
  { symbol: 'JPM', name: 'JPMorgan' },
  { symbol: 'V', name: 'Visa' },
  { symbol: 'MA', name: 'Mastercard' },
  { symbol: 'NIO', name: 'NIO' },
  { symbol: 'RIVN', name: 'Rivian' },
];

export const IBKR_SYMBOL_NOTE =
  'Search 80,000+ IBKR-tradable stocks and ETFs. Primary USD listings are shown first. Only universe instruments can be added.';

const STOCK_SYMBOL_PATTERN = /^[A-Z][A-Z0-9.\-]{0,11}$/;

export function normalizeStockSymbol(raw) {
  return raw.trim().toUpperCase();
}

export function isValidStockSymbol(raw) {
  const symbol = normalizeStockSymbol(raw);
  return symbol.length >= 1 && symbol.length <= 12 && STOCK_SYMBOL_PATTERN.test(symbol);
}

export function buildCustomStock(raw) {
  const symbol = normalizeStockSymbol(raw);
  return { symbol, name: 'Custom symbol', isCustom: true };
}

/** Mock invested positions for dashboard demo */
export const demoInvestments = [
  {
    basketId: resolveCatalogBasketId('us-tech-giants'),
    investedAmount: 25000,
    currentValue: 31125,
    returnPct: 24.5,
    since: '2025-11-12',
  },
  {
    basketId: resolveCatalogBasketId('ai-data-center'),
    investedAmount: 15000,
    currentValue: 21645,
    returnPct: 44.3,
    since: '2026-01-08',
  },
];

export function mergeDiscoverBaskets(userBaskets = [], marketplaceBaskets = []) {
  const byId = new Map();
  for (const basket of marketplaceBaskets) {
    byId.set(basket.id, { ...basket, isOwn: false });
  }
  for (const basket of userBaskets) {
    byId.set(basket.id, { ...byId.get(basket.id), ...basket, isOwn: true });
  }
  return [...byId.values()];
}

export function getBasketById(id, userBaskets = [], marketplaceBaskets = []) {
  const resolved = resolveCatalogBasketId(id);
  const pools = mergeDiscoverBaskets(userBaskets, marketplaceBaskets);
  return (
    pools.find(
      (b) =>
        b.id === resolved ||
        b.id === id ||
        b.catalogSlug === id ||
        b.catalogSlug === resolved
    ) ?? null
  );
}

export function searchBaskets(query, baskets) {
  const q = query.trim().toLowerCase();
  if (!q) return baskets;
  return baskets.filter(
    (b) =>
      b.name.toLowerCase().includes(q) ||
      b.shortDescription.toLowerCase().includes(q) ||
      b.tags?.some((t) => t.toLowerCase().includes(q)) ||
      b.constituents?.some(
        (c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
      )
  );
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function getBasketReturn(basket) {
  if (basket.navSummary?.navStatus === 'error') {
    return basket.navSummary?.totalReturnPct ?? 0;
  }
  if (basket.navSummary?.totalReturnPct != null) {
    return basket.navSummary.totalReturnPct;
  }
  if (basket.navHistory?.length >= 2) {
    const first = basket.navHistory[0].nav;
    const last = basket.navHistory[basket.navHistory.length - 1].nav;
    if (first > 0) return ((last / first) - 1) * 100;
  }
  return basket.stats?.cagr ?? basket.returnPct ?? 0;
}

export function getBasketReturnLabel(basket) {
  if (basket.navSummary?.lastFetchAt) return 'Live NAV';
  return basket.stats?.returnLabel || 'Returns';
}

const VOLATILITY_RANK = { Low: 1, Medium: 2, High: 3 };

export function getBasketVolatilityLabel(basket) {
  const enriched = enrichBasket(basket);
  return enriched.risk?.volatilityLabel || 'Medium';
}

export function getBasketVolatilityRank(basket) {
  return VOLATILITY_RANK[getBasketVolatilityLabel(basket)] ?? 2;
}

/** Rank baskets by return (desc), tie-break by lower volatility */
export function buildLeaderboard(baskets) {
  return [...baskets]
    .map((b) => enrichBasket(b))
    .sort((a, b) => {
      const returnDiff = getBasketReturn(b) - getBasketReturn(a);
      if (returnDiff !== 0) return returnDiff;
      return getBasketVolatilityRank(a) - getBasketVolatilityRank(b);
    })
    .map((basket, index) => ({
      basket,
      rank: index + 1,
      returnPct: getBasketReturn(basket),
      returnLabel: getBasketReturnLabel(basket),
      volatility: getBasketVolatilityLabel(basket),
      creatorName: basket.creator?.name || basket.creatorName || 'Unknown',
    }));
}

function defaultNavHistory(cagr) {
  const start = 100;
  const months = 5;
  const monthly = Math.pow(1 + (cagr || 10) / 100, 1 / 12) - 1;
  const points = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(2026, i, 28);
    points.push({
      date: d.toISOString().slice(0, 10),
      nav: +(start * Math.pow(1 + monthly, i + 1)).toFixed(1),
    });
  }
  return points;
}

const defaultMethodology = [
  { title: 'Universe', body: 'Define investable stocks aligned with the basket theme.' },
  { title: 'Screening', body: 'Filter by liquidity, fundamentals, and thematic fit.' },
  { title: 'Weighting', body: 'Allocate using equal or custom weights set by the creator.' },
  { title: 'Rebalance', body: 'Periodic review to maintain target allocation.' },
];

/** Fill factsheet, methodology, NAV, and risk for user-created baskets */
export function enrichBasket(basket) {
  if (!basket) return null;
  const cagr = getBasketReturn(basket);
  const vol = basket.stats?.volatility || 'Medium Volatility';
  const volLabel = vol.replace(' Volatility', '');

  const useLiveNav = Boolean(basket.navHistory?.length && basket.navSummary?.lastFetchAt);

  return {
    ...basket,
    methodology: basket.methodology || defaultMethodology,
    factsheet: basket.factsheet || {
      launched: basket.createdAt
        ? new Date(basket.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
        : 'Recently',
      rebalance: formatRebalanceFrequency(basket.rebalanceFrequency || 'on_publish'),
      benchmark: 'Custom',
      expenseNote: 'Platform fees apply on invest.',
    },
    creator: basket.creator || {
      name: basket.creatorName || 'You',
      bio: basket.isOwn
        ? 'Independent basket creator on PocketEdge.'
        : 'Curated portfolio manager on PocketEdge.',
      followers: basket.followers ?? 0,
    },
    risk: basket.risk || {
      volatilityLabel: volLabel,
      sharpeRatio: volLabel === 'High' ? 0.95 : volLabel === 'Low' ? 1.35 : 1.15,
      maxDrawdown: volLabel === 'High' ? -18.5 : volLabel === 'Low' ? -8.2 : -12.4,
      pe: 28.4,
      pb: 4.2,
      divYield: 1.1,
    },
    navHistory: useLiveNav
      ? basket.navHistory
      : basket.navHistory?.length
        ? basket.navHistory
        : defaultNavHistory(cagr),
  };
}
