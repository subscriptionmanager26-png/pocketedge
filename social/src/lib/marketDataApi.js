import { supabase, isSupabaseConfigured } from './supabase';
import { skipAuthForDev } from './sessionStore';

const BASE = '/data/markets';

export const MARKET_PREVIEW_LIMIT = 40;
export const MARKET_SEARCH_LIMIT = 50;
export const MARKET_MIN_SEARCH_CHARS = 2;

const TAB_PREVIEW = {
  stocks: 'stocks-preview.json',
  mutual_funds: 'mutual-funds-preview.json',
  etf: 'etf-preview.json',
  indices: 'indices-preview.json',
  commodity: 'commodities-preview.json',
};

const TAB_SEARCH = {
  stocks: 'stocks-search.json',
  mutual_funds: 'mutual-funds-search.json',
  etf: 'etf-search.json',
  indices: 'indices-search.json',
  commodity: 'commodities-search.json',
};

const TAB_FULL = {
  stocks: 'stocks.json',
  mutual_funds: 'mutual-funds.json',
  etf: 'etf.json',
  indices: 'indices.json',
  commodity: 'commodities.json',
};

const SEARCH_FIELDS = {
  stocks: ['symbol', 'name', 'isin'],
  mutual_funds: ['schemeCode', 'name', 'category', 'subCategory', 'amc'],
  etf: ['symbol', 'name'],
  indices: ['id', 'symbol', 'name', 'group'],
  commodity: ['id', 'name', 'symbol', 'location', 'unit'],
};

const TAB_TO_ASSET_TYPE = {
  stocks: 'stock',
  etf: 'etf',
  mutual_funds: 'fund',
};

const cache = new Map();

function useMarketRpc() {
  return Boolean(supabase) && isSupabaseConfigured() && !skipAuthForDev();
}

function tabToAssetType(tab) {
  return TAB_TO_ASSET_TYPE[tab] ?? null;
}

export function marketAssetRowToItem(row) {
  if (!row) return null;
  const type = row.asset_type ?? row.assetType;
  const key = row.asset_key ?? row.assetKey;
  const name = row.name;
  const price = row.price ?? null;
  const changePct = row.change_pct ?? row.changePct ?? null;

  if (type === 'fund') {
    return {
      schemeCode: key,
      id: key,
      name,
      nav: price,
      price,
      changePct,
      assetType: 'fund',
    };
  }

  return {
    symbol: key,
    id: key,
    name,
    price,
    ltp: price,
    changePct,
    assetType: type,
  };
}

async function fetchJson(file) {
  if (cache.has(file)) {
    const cached = cache.get(file);
    return cached instanceof Promise ? cached : Promise.resolve(cached);
  }

  const promise = fetch(`${BASE}/${file}`)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${file}`);
      return res.json();
    })
    .then((payload) => {
      cache.set(file, payload);
      return payload;
    })
    .catch((err) => {
      cache.delete(file);
      throw err;
    });

  cache.set(file, promise);
  return promise;
}

export async function fetchMarketManifest() {
  return fetchJson('manifest.json');
}

export async function fetchMarketPreview(tab) {
  const file = TAB_PREVIEW[tab] ?? TAB_FULL[tab];
  if (!file) throw new Error(`Unknown market tab: ${tab}`);
  const payload = await fetchJson(file);
  return {
    syncedAt: payload.syncedAt ?? null,
    items: payload.items ?? [],
    asOn: payload.asOn ?? null,
    isPreview: Boolean(TAB_PREVIEW[tab]),
  };
}

export async function loadSearchIndex(tab) {
  const file = TAB_SEARCH[tab];
  if (!file) return [];
  const payload = await fetchJson(file);
  return payload.items ?? [];
}

function scoreMarketSearchItem(item, fields, needle) {
  const symbol = String(item.symbol ?? item.id ?? '').toLowerCase();
  const name = String(item.name ?? '').toLowerCase();

  if (symbol === needle) return 100;
  if (symbol.startsWith(needle)) return 80;
  if (name.startsWith(needle)) return 60;

  const fieldHit = fields.some((field) =>
    String(item[field] ?? '').toLowerCase().includes(needle)
  );
  return fieldHit ? 40 : 0;
}

async function searchMarketTabLocal(tab, query, limit) {
  const items = await loadSearchIndex(tab);
  const fields = SEARCH_FIELDS[tab] ?? ['name'];
  const needle = query.toLowerCase();

  const scored = [];
  for (const item of items) {
    const score = scoreMarketSearchItem(item, fields, needle);
    if (score > 0) scored.push({ item, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.item.symbol ?? a.item.id ?? '').localeCompare(
      String(b.item.symbol ?? b.item.id ?? '')
    );
  });

  const matches = scored.slice(0, limit).map((entry) => entry.item);
  return { items: matches, total: scored.length };
}

async function searchMarketTabRpc(tab, query, limit) {
  const assetType = tabToAssetType(tab);
  if (!assetType || !useMarketRpc()) return null;

  const { data, error } = await supabase.rpc('search_social_market_assets', {
    p_query: query,
    p_asset_type: assetType,
    p_limit: limit,
  });
  if (error) throw error;

  const rows = Array.isArray(data?.items) ? data.items : [];
  return {
    items: rows.map(marketAssetRowToItem).filter(Boolean),
    total: Number(data?.total ?? rows.length),
  };
}

export async function searchMarketTab(tab, query, limit = MARKET_SEARCH_LIMIT) {
  const q = query.trim();
  if (q.length < MARKET_MIN_SEARCH_CHARS) {
    return { items: [], total: 0 };
  }

  // Indices / commodities stay on static JSON (not in social_market_assets).
  if (!tabToAssetType(tab)) {
    return searchMarketTabLocal(tab, q, limit);
  }

  if (useMarketRpc()) {
    try {
      const rpcResult = await searchMarketTabRpc(tab, q, limit);
      if (rpcResult) return rpcResult;
    } catch (err) {
      console.warn('search_social_market_assets failed, falling back to JSON', err);
    }
  }

  return searchMarketTabLocal(tab, q, limit);
}

export async function searchAllMarkets(query, limitPerTab = 12) {
  const tabs = Object.keys(TAB_SEARCH);
  const results = await Promise.all(
    tabs.map(async (tab) => {
      const { items } = await searchMarketTab(tab, query, limitPerTab);
      return [tab, items];
    })
  );
  return Object.fromEntries(results);
}

export function findCachedMarketItem(tab, id) {
  const previewFile = TAB_PREVIEW[tab];
  const searchFile = TAB_SEARCH[tab];
  for (const file of [previewFile, searchFile]) {
    if (!file) continue;
    const cached = cache.get(file);
    if (!cached?.items) continue;
    const found = cached.items.find(
      (item) => item.id === id || item.symbol === id || item.schemeCode === id
    );
    if (found) return found;
  }
  return null;
}

async function lookupMarketAssetRpc(key) {
  if (!useMarketRpc()) return null;
  const { data, error } = await supabase.rpc('lookup_social_market_asset', {
    p_key: key,
  });
  if (error) throw error;
  return data ? marketAssetRowToItem(data) : null;
}

export async function lookupMarketAssetsBatch(keys) {
  const unique = [...new Set(keys.map((key) => String(key ?? '').trim()).filter(Boolean))];
  if (!unique.length) return new Map();

  if (useMarketRpc()) {
    try {
      const { data, error } = await supabase.rpc('lookup_social_market_assets_batch', {
        p_keys: unique,
      });
      if (error) throw error;
      const map = new Map();
      for (const row of data ?? []) {
        const item = marketAssetRowToItem(row);
        if (!item) continue;
        const key = row.asset_key ?? item.symbol ?? item.schemeCode;
        map.set(key, item);
        if (row.query_key) map.set(row.query_key, item);
      }
      return map;
    } catch (err) {
      console.warn('lookup_social_market_assets_batch failed', err);
    }
  }

  return new Map();
}

export async function resolveMarketStock(symbol) {
  const cached = findCachedMarketItem('stocks', symbol);
  if (cached) return cached;

  const etfCached = findCachedMarketItem('etf', symbol);
  if (etfCached) return etfCached;

  if (useMarketRpc()) {
    try {
      const found = await lookupMarketAssetRpc(symbol);
      if (found && (found.assetType === 'stock' || found.assetType === 'etf')) {
        return found;
      }
    } catch (err) {
      console.warn('lookup_social_market_asset failed', err);
    }
  }

  const [stockMatches, etfMatches] = await Promise.all([
    searchMarketTab('stocks', symbol, 5),
    searchMarketTab('etf', symbol, 5),
  ]);

  return (
    stockMatches.items.find((item) => item.symbol === symbol) ??
    etfMatches.items.find((item) => item.symbol === symbol) ??
    null
  );
}

export async function resolveMarketFund(schemeCode) {
  const cached = findCachedMarketItem('mutual_funds', schemeCode);
  if (cached) return cached;

  if (useMarketRpc()) {
    try {
      const found = await lookupMarketAssetRpc(schemeCode);
      if (found && found.assetType === 'fund') return found;
    } catch (err) {
      console.warn('lookup_social_market_asset failed', err);
    }
  }

  const { items } = await searchMarketTab('mutual_funds', schemeCode, 20);
  return items.find((item) => item.schemeCode === schemeCode) ?? null;
}

async function loadFullMarketTab(tab) {
  const file = TAB_FULL[tab];
  if (!file) return [];
  const payload = await fetchJson(file);
  return payload.items ?? [];
}

export async function resolveMarketIndex(indexId) {
  const cached = findCachedMarketItem('indices', indexId);
  if (cached) return cached;

  const items = await loadFullMarketTab('indices');
  return (
    items.find((item) => item.id === indexId || item.symbol === indexId) ?? null
  );
}

export async function resolveMarketCommodity(commodityId) {
  const cached = findCachedMarketItem('commodity', commodityId);
  if (cached) return cached;

  const items = await loadFullMarketTab('commodity');
  return items.find((item) => item.id === commodityId) ?? null;
}

export function marketFundToDetail(fund) {
  if (!fund) return null;
  const category = [fund.category, fund.subCategory].filter(Boolean).join(' · ');
  return {
    id: fund.schemeCode ?? fund.id,
    name: fund.name,
    category: category || fund.schemeType || 'Mutual Fund',
    amc: fund.amc,
    nav: fund.nav ?? fund.price,
    navDate: fund.navDate,
    schemeType: fund.schemeType,
    subCategory: fund.subCategory,
  };
}

export function marketStockToDetail(stock) {
  if (!stock) return null;
  return {
    ticker: stock.symbol,
    symbol: stock.symbol,
    name: stock.name,
    price: stock.price ?? stock.ltp,
    changePct: stock.changePct,
    isin: stock.isin,
    series: stock.series,
    segment: stock.segment,
  };
}

// Legacy alias used by detail pages during migration.
export async function fetchMarketTab(tab) {
  return fetchMarketPreview(tab);
}
