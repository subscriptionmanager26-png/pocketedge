import { formatRebalanceFrequency } from './rebalanceOptions';

/** Marketplace baskets — inspired by smallcase-style thematic portfolios */

export const catalogBaskets = [
  {
    id: 'ai-data-center',
    name: 'AI & Data Center Theme',
    shortDescription: 'Physical infrastructure behind AI, cloud, and digital revolutions.',
    description:
      'India is witnessing a structural surge in data localisation, AI workloads, and cloud adoption. This basket captures the infrastructure layer that benefits irrespective of which tech platform wins.',
    imageUrl:
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=960&h=600&fit=crop&q=80',
    imageGradient: 'from-violet-600 to-cyan-500',
    badge: 'hot',
    type: 'Thematic',
    tags: ['AI', 'Infrastructure', 'Cloud'],
    weightingType: 'custom',
    rebalanceFrequency: 'quarterly',
    constituents: [
      { symbol: 'NVDA', name: 'NVIDIA Corp', weight: 12, segment: 'Largecap' },
      { symbol: 'MSFT', name: 'Microsoft', weight: 10, segment: 'Largecap' },
      { symbol: 'AMZN', name: 'Amazon', weight: 9, segment: 'Largecap' },
      { symbol: 'GOOGL', name: 'Alphabet', weight: 9, segment: 'Largecap' },
      { symbol: 'EQIX', name: 'Equinix', weight: 8, segment: 'Largecap' },
      { symbol: 'DLR', name: 'Digital Realty', weight: 7, segment: 'Midcap' },
      { symbol: 'ANET', name: 'Arista Networks', weight: 7, segment: 'Midcap' },
      { symbol: 'SMCI', name: 'Super Micro', weight: 8, segment: 'Smallcap' },
      { symbol: 'VRT', name: 'Vertiv Holdings', weight: 8, segment: 'Midcap' },
      { symbol: 'TSM', name: 'TSMC', weight: 10, segment: 'Largecap' },
      { symbol: 'AVGO', name: 'Broadcom', weight: 6, segment: 'Largecap' },
      { symbol: 'AMD', name: 'AMD', weight: 6, segment: 'Largecap' },
    ],
    stats: {
      cagr: 44.3,
      returnLabel: '4M Returns',
      minInvestAmount: 5000,
      volatility: 'High Volatility',
      constituents: 12,
    },
    creatorName: 'Growth Investing',
    followers: 1240,
    methodology: [
      { title: 'Defining the universe', body: 'Companies engaged in AI, cloud, data center, and digital infrastructure.' },
      { title: 'Constituent screening', body: 'Sector relevance, financial health, strategic moat, valuation discipline, and governance.' },
      { title: 'Weighting', body: 'Quant-driven allocation using momentum, relative strength, liquidity, and risk signals.' },
      { title: 'Rebalance', body: 'Quarterly rebalance to realign weights with the strategy.' },
    ],
    factsheet: {
      launched: 'Jan 2026',
      rebalance: 'Quarterly',
      benchmark: 'Nifty 500',
      expenseNote: 'No direct expense ratio; platform fees apply on invest.',
    },
    creator: {
      name: 'Growth Investing',
      bio: 'Model-driven portfolios focused on structural themes with disciplined quantitative allocation.',
      followers: 1240,
    },
    risk: {
      volatilityLabel: 'High',
      sharpeRatio: 1.12,
      maxDrawdown: -14.2,
      pe: 68.8,
      pb: 9.16,
      divYield: 0.32,
    },
    navHistory: [
      { date: '2026-01-31', nav: 100 },
      { date: '2026-02-28', nav: 108.4 },
      { date: '2026-03-31', nav: 121.2 },
      { date: '2026-04-30', nav: 132.6 },
      { date: '2026-05-31', nav: 144.3 },
    ],
  },
  {
    id: 'us-tech-giants',
    name: 'US Tech Giants',
    shortDescription: 'Leading American technology companies driving global innovation.',
    description: 'Invest in the megacap technology leaders with durable cash flows and platform moats.',
    imageUrl:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=960&h=600&fit=crop&q=80',
    imageGradient: 'from-emerald-600 to-teal-500',
    badge: 'trending',
    type: 'Thematic',
    tags: ['US', 'Technology'],
    weightingType: 'equal',
    constituents: [
      { symbol: 'AAPL', name: 'Apple', weight: 20, segment: 'Largecap' },
      { symbol: 'MSFT', name: 'Microsoft', weight: 20, segment: 'Largecap' },
      { symbol: 'GOOGL', name: 'Alphabet', weight: 20, segment: 'Largecap' },
      { symbol: 'AMZN', name: 'Amazon', weight: 20, segment: 'Largecap' },
      { symbol: 'NVDA', name: 'NVIDIA', weight: 20, segment: 'Largecap' },
    ],
    stats: {
      cagr: 24.5,
      returnLabel: '1Y Returns',
      minInvestAmount: 5000,
      volatility: 'Medium Volatility',
      constituents: 5,
    },
    creatorName: 'PocketEdge Research',
    followers: 3890,
  },
  {
    id: 'global-ev',
    name: 'Global EV Revolution',
    shortDescription: 'Electric vehicle manufacturers and suppliers worldwide.',
    description: 'Exposure to the electrification of transport across OEMs and battery supply chain.',
    imageUrl:
      'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=960&h=600&fit=crop&q=80',
    imageGradient: 'from-lime-600 to-emerald-500',
    badge: 'trending',
    type: 'Thematic',
    tags: ['EV', 'Clean Energy'],
    weightingType: 'equal',
    constituents: [
      { symbol: 'TSLA', name: 'Tesla', weight: 20, segment: 'Largecap' },
      { symbol: 'RIVN', name: 'Rivian', weight: 20, segment: 'Smallcap' },
      { symbol: 'NIO', name: 'NIO', weight: 20, segment: 'Midcap' },
      { symbol: 'LI', name: 'Li Auto', weight: 20, segment: 'Midcap' },
      { symbol: 'LCID', name: 'Lucid', weight: 20, segment: 'Smallcap' },
    ],
    stats: {
      cagr: 18.2,
      returnLabel: '1Y Returns',
      minInvestAmount: 5000,
      volatility: 'High Volatility',
      constituents: 5,
    },
    creatorName: 'PocketEdge Research',
    followers: 2105,
  },
  {
    id: 'dividend-quality',
    name: 'Dividend Quality Leaders',
    shortDescription: 'Stable dividend payers with strong balance sheets.',
    description: 'Quality compounders with consistent payout histories and defensive characteristics.',
    imageUrl:
      'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=960&h=600&fit=crop&q=80',
    imageGradient: 'from-amber-600 to-orange-500',
    badge: 'hidden_gem',
    type: 'Strategy',
    tags: ['Dividend', 'Quality'],
    weightingType: 'custom',
    constituents: [
      { symbol: 'JNJ', name: 'Johnson & Johnson', weight: 15, segment: 'Largecap' },
      { symbol: 'PG', name: 'Procter & Gamble', weight: 15, segment: 'Largecap' },
      { symbol: 'KO', name: 'Coca-Cola', weight: 14, segment: 'Largecap' },
      { symbol: 'PEP', name: 'PepsiCo', weight: 14, segment: 'Largecap' },
      { symbol: 'VZ', name: 'Verizon', weight: 14, segment: 'Largecap' },
      { symbol: 'T', name: 'AT&T', weight: 13, segment: 'Largecap' },
      { symbol: 'MMM', name: '3M', weight: 13, segment: 'Largecap' },
      { symbol: 'IBM', name: 'IBM', weight: 12, segment: 'Largecap' },
    ],
    stats: {
      cagr: 11.4,
      returnLabel: '1Y Returns',
      minInvestAmount: 3000,
      volatility: 'Low Volatility',
      constituents: 8,
    },
    creatorName: 'Income Desk',
    followers: 876,
  },
];

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

/** Mock invested positions for dashboard demo */
export const demoInvestments = [
  {
    basketId: 'us-tech-giants',
    investedAmount: 25000,
    currentValue: 31125,
    returnPct: 24.5,
    since: '2025-11-12',
  },
  {
    basketId: 'ai-data-center',
    investedAmount: 15000,
    currentValue: 21645,
    returnPct: 44.3,
    since: '2026-01-08',
  },
];

export function getBasketById(id, userBaskets = []) {
  const fromCatalog = catalogBaskets.find((b) => b.id === id);
  if (fromCatalog) return fromCatalog;
  return userBaskets.find((b) => b.id === id) ?? null;
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
  return basket.stats?.cagr ?? basket.returnPct ?? 0;
}

export function getBasketReturnLabel(basket) {
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
  const monthly = Math.pow(1 + cagr / 100, 1 / 12) - 1;
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
    navHistory: basket.navHistory || defaultNavHistory(cagr),
  };
}
