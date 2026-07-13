import {
  findCachedMarketItem,
  lookupMarketAssetsBatch,
  MARKET_MIN_SEARCH_CHARS,
  marketAssetRowToItem,
  searchMarketTab,
} from './marketDataApi';
import { supabase, isSupabaseConfigured } from './supabase';
import { skipAuthForDev } from './sessionStore';

const PORTFOLIO_TABS = [
  { tab: 'stocks', kind: 'stock', label: 'Stock' },
  { tab: 'etf', kind: 'etf', label: 'ETF' },
  { tab: 'mutual_funds', kind: 'fund', label: 'Fund' },
];

function useMarketRpc() {
  return Boolean(supabase) && isSupabaseConfigured() && !skipAuthForDev();
}

export function portfolioAssetKey(item, kind) {
  if (kind === 'fund') return String(item.schemeCode ?? item.id ?? '').trim();
  return String(item.symbol ?? item.id ?? '')
    .trim()
    .toUpperCase();
}

export function portfolioAssetName(item) {
  return item.name ?? '';
}

/**
 * Label for a holding in portfolio UI.
 * Mutual funds always prefer the fund name over the AMFI scheme code.
 */
export function holdingDisplayLabel(holding, asset) {
  const ticker = String(holding?.ticker ?? holding?.symbol ?? '').trim();
  const assetType = holding?.assetType ?? asset?.kind ?? asset?.assetType ?? null;
  const name = String(
    holding?.assetName ?? holding?.name ?? asset?.name ?? ''
  ).trim();
  const isFund =
    assetType === 'fund' ||
    asset?.kind === 'fund' ||
    (/^\d{6,}$/.test(ticker) && Boolean(name));

  if (isFund) return name || ticker;
  if (ticker) {
    return String(ticker)
      .trim()
      .toUpperCase();
  }
  return name;
}

export function portfolioAssetPrice(item, kind) {
  if (kind === 'fund') return item.nav ?? item.price ?? null;
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

function metaForAssetType(assetType) {
  if (assetType === 'fund') return PORTFOLIO_TABS[2];
  if (assetType === 'etf') return PORTFOLIO_TABS[1];
  return PORTFOLIO_TABS[0];
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

async function findPortfolioAssetExactLocal(meta, needle) {
  const cached = findCachedMarketItem(meta.tab, needle);
  if (cached && portfolioAssetKey(cached, meta.kind) === needle) {
    return toEntry(cached, meta);
  }

  const { items } = await searchMarketTab(meta.tab, needle, meta.kind === 'fund' ? 12 : 5);
  const needleLower = needle.toLowerCase();
  const found = items.find((item) => {
    const key = portfolioAssetKey(item, meta.kind);
    if (key === needle) return true;
    if (meta.kind === 'fund') {
      const name = String(item.name ?? '').trim().toLowerCase();
      return name === needleLower || name.includes(needleLower);
    }
    return false;
  });
  return found ? toEntry(found, meta) : null;
}

export async function resolvePortfolioAsset(key) {
  const raw = String(key ?? '').trim();
  if (!raw) return null;

  if (useMarketRpc()) {
    try {
      const map = await lookupMarketAssetsBatch([raw]);
      const item = map.get(raw) ?? map.get(raw.toUpperCase());
      if (item) {
        const meta = metaForAssetType(item.assetType);
        return toEntry(item, meta);
      }
    } catch {
      /* fall through */
    }
  }

  // Prefer fund name search when the key looks like a name (has spaces / not a scheme code).
  const looksLikeFundName = /\s/.test(raw) || (!/^\d{6,}$/.test(raw) && raw.length > 12);
  const order = looksLikeFundName
    ? [PORTFOLIO_TABS[2], PORTFOLIO_TABS[0], PORTFOLIO_TABS[1]]
    : PORTFOLIO_TABS;

  for (const meta of order) {
    const needle = meta.kind === 'fund' ? raw : raw.toUpperCase();
    const found = await findPortfolioAssetExactLocal(meta, needle);
    if (found) return found;
  }

  return null;
}

export async function resolvePortfolioAssets(keys) {
  const unique = [...new Set(keys.map((key) => String(key ?? '').trim()).filter(Boolean))];
  const map = new Map();
  if (!unique.length) return map;

  if (useMarketRpc()) {
    try {
      const batch = await lookupMarketAssetsBatch(unique);
      for (const key of unique) {
        const item = batch.get(key) ?? batch.get(key.toUpperCase());
        if (!item) continue;
        const meta = metaForAssetType(item.assetType);
        const entry = toEntry(item, meta);
        map.set(entry.key, entry);
        map.set(key, entry);
      }
      if (map.size >= unique.length) return map;
    } catch {
      /* fall through to parallel local resolve */
    }
  }

  const remaining = unique.filter((key) => !map.has(key));
  const resolved = await Promise.all(remaining.map((key) => resolvePortfolioAsset(key)));
  for (let i = 0; i < remaining.length; i += 1) {
    const asset = resolved[i];
    if (!asset) continue;
    map.set(asset.key, asset);
    map.set(remaining[i], asset);
  }

  return map;
}

// Re-export for callers that need raw RPC row mapping.
export { marketAssetRowToItem };
