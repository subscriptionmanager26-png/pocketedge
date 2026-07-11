import {
  findCachedMarketItem,
  loadSearchIndex,
  MARKET_MIN_SEARCH_CHARS,
  searchMarketTab,
} from './marketDataApi';

const PORTFOLIO_TABS = [
  { tab: 'stocks', kind: 'stock', label: 'Stock' },
  { tab: 'etf', kind: 'etf', label: 'ETF' },
  { tab: 'mutual_funds', kind: 'fund', label: 'Fund' },
];

export function portfolioAssetKey(item, kind) {
  if (kind === 'fund') return String(item.schemeCode ?? item.id ?? '').trim();
  return String(item.symbol ?? item.id ?? '')
    .trim()
    .toUpperCase();
}

export function portfolioAssetName(item) {
  return item.name ?? '';
}

export function portfolioAssetPrice(item, kind) {
  if (kind === 'fund') return item.nav ?? null;
  return item.price ?? item.ltp ?? null;
}

function toEntry(item, { kind, label }) {
  const key = portfolioAssetKey(item, kind);
  return {
    key,
    name: portfolioAssetName(item),
    kind,
    kindLabel: label,
    price: portfolioAssetPrice(item, kind),
    item,
  };
}

function scoreEntry(entry, needle) {
  const key = entry.key.toLowerCase();
  const name = entry.name.toLowerCase();
  if (key === needle) return 100;
  if (key.startsWith(needle)) return 80;
  if (name.startsWith(needle)) return 60;
  if (key.includes(needle) || name.includes(needle)) return 40;
  return 0;
}

export async function searchPortfolioAssets(query, { limit = 6, exclude = [] } = {}) {
  const q = query.trim();
  if (q.length < MARKET_MIN_SEARCH_CHARS) return [];

  const needle = q.toLowerCase();
  const excludeSet = new Set(
    exclude.map((value) => String(value ?? '').trim()).filter(Boolean)
  );

  const batches = await Promise.all(
    PORTFOLIO_TABS.map(async (meta) => {
      const { items } = await searchMarketTab(meta.tab, q, limit);
      return items.map((item) => toEntry(item, meta));
    })
  );

  const scored = batches
    .flat()
    .filter((entry) => !excludeSet.has(entry.key))
    .map((entry) => ({ entry, score: scoreEntry(entry, needle) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.key.localeCompare(b.entry.key);
    });

  return scored.slice(0, limit).map(({ entry }) => entry);
}

async function findPortfolioAssetExact(meta, needle) {
  const cached = findCachedMarketItem(meta.tab, needle);
  if (cached && portfolioAssetKey(cached, meta.kind) === needle) {
    return toEntry(cached, meta);
  }

  const items = await loadSearchIndex(meta.tab);
  const found = items.find((item) => portfolioAssetKey(item, meta.kind) === needle);
  return found ? toEntry(found, meta) : null;
}

export async function resolvePortfolioAsset(key) {
  const raw = String(key ?? '').trim();
  if (!raw) return null;

  for (const meta of PORTFOLIO_TABS) {
    const needle = meta.kind === 'fund' ? raw : raw.toUpperCase();
    const found = await findPortfolioAssetExact(meta, needle);
    if (found) return found;
  }

  return null;
}

export async function resolvePortfolioAssets(keys) {
  const unique = [...new Set(keys.map((key) => String(key ?? '').trim()).filter(Boolean))];
  const map = new Map();

  for (const key of unique) {
    const asset = await resolvePortfolioAsset(key);
    if (!asset) continue;
    map.set(asset.key, asset);
    map.set(key, asset);
  }

  return map;
}
