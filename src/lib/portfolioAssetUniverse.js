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
const PORTFOLIO_BOND_META = { kind: 'bond', label: 'Bond' };

function useMarketRpc() {
  return Boolean(supabase) && isSupabaseConfigured() && !skipAuthForDev();
}

function useMarketLogoLookup() {
  return Boolean(supabase) && isSupabaseConfigured();
}

export function portfolioAssetKey(item, kind) {
  if (kind === 'fund') return String(item.schemeCode ?? item.id ?? '').trim();
  if (
    String(item.id ?? '').toUpperCase().startsWith('BSE:') ||
    String(item.exchange ?? '').toUpperCase() === 'BSE'
  ) {
    return String(item.id).trim().toUpperCase();
  }
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
  if (/^[A-Z0-9]{12}$/i.test(ticker) && name) return name;
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
    symbol: item.symbol ?? key,
    name: portfolioAssetName(item),
    kind,
    kindLabel: label,
    price: portfolioAssetPrice(item, kind),
    isin: item.isin ?? null,
    logoIconUrl: item.logoIconUrl ?? null,
    item,
  };
}

function metaForAssetType(assetType) {
  if (assetType === 'fund') return PORTFOLIO_TABS[2];
  if (assetType === 'etf') return PORTFOLIO_TABS[1];
  if (assetType === 'bond') return PORTFOLIO_BOND_META;
  return PORTFOLIO_TABS[0];
}

/**
 * Seed an assetsByKey map from already-enriched holdings so the UI can paint
 * immediately without waiting on a second market batch lookup.
 */
export function assetsFromHoldings(holdings) {
  const map = {};
  for (const holding of holdings ?? []) {
    const ticker = String(holding?.ticker ?? holding?.symbol ?? '').trim();
    if (!ticker) continue;
    const price = Number(holding?.price);
    const changePct = holding?.changePct;
    const hasLive =
      (Number.isFinite(price) && price > 0) ||
      changePct != null ||
      Boolean(holding?.assetName);
    if (!hasLive) continue;

    const assetType = holding?.assetType ?? 'stock';
    const meta = metaForAssetType(assetType);
    const logoIconUrl = holding?.logoIconUrl ?? holding?.logo_icon_url ?? null;
    map[ticker] = {
      key: ticker,
      symbol: ticker,
      name: holding?.assetName ?? holding?.name ?? '',
      kind: meta.kind,
      kindLabel: meta.label,
      price: Number.isFinite(price) && price > 0 ? price : null,
      isin: holding?.isin ?? null,
      logoIconUrl,
      item: {
        changePct: changePct ?? null,
        previousClose: holding?.previousClose ?? null,
        assetType,
        logoIconUrl,
      },
    };
  }
  return map;
}

/** True when any holding still needs a client-side market resolve. */
export function holdingsNeedLiveResolve(holdings) {
  const list = holdings ?? [];
  if (!list.length) return false;
  return list.some((holding) => {
    if (!holding?.ticker) return false;
    const price = Number(holding?.price);
    const hasPrice = Number.isFinite(price) && price > 0;
    const hasChange = holding?.changePct != null;
    return !hasPrice || !hasChange;
  });
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
    if (meta.kind !== 'fund' && String(item.symbol ?? '').trim().toUpperCase() === needle) {
      return true;
    }
    if (meta.kind === 'fund') {
      const name = String(item.name ?? '').trim().toLowerCase();
      return name === needleLower || name.includes(needleLower);
    }
    return false;
  });
  return found ? toEntry(found, meta) : null;
}

// Broker screenshots (e.g. Zerodha Kite) render a series/segment badge next to
// the symbol that OCR captures as a trailing suffix — GOLDBEES-E, SILVERBEES-E,
// LIQUIDBEES-F, SGBFEB32IV-GB, QPOWER-BE. These never match a market asset_key,
// so the base symbol must be recovered before resolution.
const SEGMENT_SUFFIX_RE = /-[A-Z]{1,2}$/;

export function stripBrokerSegmentSuffix(ticker) {
  const raw = String(ticker ?? '').trim().toUpperCase();
  if (!raw || !SEGMENT_SUFFIX_RE.test(raw)) return null;
  const base = raw.replace(SEGMENT_SUFFIX_RE, '');
  return base && base !== raw ? base : null;
}

export async function resolvePortfolioAsset(key) {
  const raw = String(key ?? '').trim();
  if (!raw) return null;
  const direct = await resolvePortfolioAssetExact(raw);
  if (direct) return direct;
  const base = stripBrokerSegmentSuffix(raw);
  if (base) return resolvePortfolioAssetExact(base);
  return null;
}

async function resolvePortfolioAssetExact(key) {
  const raw = String(key ?? '').trim();
  if (!raw) return null;

  if (useMarketLogoLookup()) {
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

  if (useMarketLogoLookup()) {
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
