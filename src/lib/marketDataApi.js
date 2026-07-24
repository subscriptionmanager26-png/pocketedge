import { supabase, isSupabaseConfigured, ensureSupabase } from './supabase';
import { skipAuthForDev } from './sessionStore';
import { cachedFetch, getCached, setCached } from './queryCache';
import { peekMarketPreviewCache, writeMarketPreviewCache } from './tabCache';
import { seedMarketAssetCache } from './marketAssetSeed';

export { seedMarketAssetCache } from './marketAssetSeed';

const BASE = '/data/markets';
const MARKET_SEARCH_TTL_MS = 30_000;
const MARKET_ASSET_TTL_MS = 30_000;

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
  commodity: 'commodity',
  indices: 'index',
};

const cache = new Map();
const previewListeners = new Map();

function notifyMarketPreviewUpdated(tab, payload) {
  previewListeners.get(tab)?.forEach((listener) => {
    try {
      listener(payload);
    } catch {
      /* ignore listener errors */
    }
  });
}

export function subscribeMarketPreview(tab, listener) {
  const key = String(tab);
  if (!previewListeners.has(key)) previewListeners.set(key, new Set());
  previewListeners.get(key).add(listener);
  return () => previewListeners.get(key)?.delete(listener);
}

export function peekMarketPreview(tab) {
  const cached = peekMarketPreviewCache(tab);
  if (!cached) return null;
  return normalizeMarketPreviewPayload(cached);
}

/** Boot / RPC rows use snake_case; UI expects camelCase from marketAssetRowToItem. */
export function normalizeMarketPreviewItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (!item) return null;
      if (
        item.asset_key != null ||
        item.asset_type != null ||
        item.change_pct != null ||
        item.logo_icon_url != null ||
        item.previous_close != null
      ) {
        return marketAssetRowToItem(item);
      }
      return item;
    })
    .filter(Boolean);
}

function normalizeMarketPreviewPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const items = normalizeMarketPreviewItems(payload.items);
  return {
    ...payload,
    items,
    syncedAt: payload.syncedAt ?? payload.synced_at ?? null,
  };
}

function useMarketRpc() {
  return Boolean(supabase) && isSupabaseConfigured() && !skipAuthForDev();
}

/** Logo batch lookup works whenever Supabase is configured (incl. dev skipAuth). */
function useMarketLogoLookup() {
  return Boolean(supabase) && isSupabaseConfigured();
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
  const previousClose = row.previous_close ?? row.previousClose ?? null;
  const rawChangePct = row.change_pct ?? row.changePct ?? null;
  // AMFI fund rows provide the latest NAV and prior NAV, but not a computed
  // percentage. Normalize them here so every caller (search, detail, and
  // portfolio) receives the same live daily change.
  const changePct =
    rawChangePct != null && Number.isFinite(Number(rawChangePct))
      ? Number(rawChangePct)
      : price != null && previousClose != null && Number(previousClose) !== 0
        ? ((Number(price) - Number(previousClose)) / Number(previousClose)) * 100
        : null;
  const asOfDate = row.as_of_date ?? row.asOfDate ?? null;
  const priceSource = row.price_source ?? row.priceSource ?? null;
  const syncedAt = row.synced_at ?? row.syncedAt ?? null;
  const exchange = row.exchange ?? null;
  const exchangeSymbol = row.exchange_symbol ?? row.exchangeSymbol ?? null;
  const isin = row.isin ?? null;
  const logoIconUrl = row.logo_icon_url ?? row.logoIconUrl ?? null;
  const logoUrl = row.logo_url ?? row.logoUrl ?? null;

  if (type === 'fund') {
    return {
      schemeCode: key,
      id: key,
      name,
      nav: price,
      price,
      changePct,
      previousClose,
      asOfDate,
      navDate: asOfDate,
      priceSource,
      syncedAt,
      logoIconUrl,
      logoUrl,
      assetType: 'fund',
    };
  }

  if (type === 'commodity') {
    const dash = String(key).lastIndexOf('-');
    const symbol = dash > 0 ? String(key).slice(0, dash) : key;
    const location = dash > 0 ? String(key).slice(dash + 1) : null;
    return {
      id: key,
      symbol,
      name: name ?? symbol,
      location,
      spotPrice: price,
      price,
      change: previousClose != null && price != null ? price - previousClose : null,
      changePct,
      previousClose,
      asOfDate,
      priceSource,
      syncedAt,
      logoIconUrl,
      logoUrl,
      assetType: 'commodity',
    };
  }

  if (type === 'index') {
    return {
      id: key,
      symbol: exchangeSymbol ?? key,
      name: name ?? exchangeSymbol ?? key,
      group: exchange,
      value: price,
      price,
      change:
        previousClose != null && price != null ? Number(price) - Number(previousClose) : null,
      changePct,
      previousClose,
      asOfDate,
      priceSource,
      syncedAt,
      logoIconUrl,
      logoUrl,
      assetType: 'index',
    };
  }

  return {
    symbol: exchangeSymbol ?? key,
    id: key,
    name,
    price,
    ltp: price,
    nav: row.nav ?? null,
    changePct,
    previousClose,
    asOfDate,
    priceSource,
    syncedAt,
    exchange,
    isin,
    logoIconUrl,
    logoUrl,
    assetType: type,
  };
}

function previewItemKey(row, assetType) {
  if (assetType === 'fund') return row.schemeCode ?? row.id ?? row.asset_key ?? row.assetKey;
  return row.symbol ?? row.id ?? row.asset_key ?? row.assetKey;
}

async function enrichMarketItemsWithLogos(items, assetType) {
  if (!assetType || !useMarketLogoLookup() || !Array.isArray(items) || !items.length) {
    return items;
  }

  const needsLogo = items.some((row) => !(row.logoIconUrl ?? row.logo_icon_url));
  if (!needsLogo) return items;

  const keys = [
    ...new Set(
      items
        .map((row) => String(previewItemKey(row, assetType) ?? '').trim())
        .filter(Boolean)
    ),
  ];
  if (!keys.length) return items;

  try {
    const { data, error } = await supabase.rpc('lookup_social_market_assets_batch', {
      p_keys: keys,
    });
    if (error) throw error;

    const logoByKey = new Map();
    for (const row of data ?? []) {
      const item = marketAssetRowToItem(row);
      if (!item?.logoIconUrl) continue;
      const key = row.asset_key ?? row.assetKey ?? previewItemKey(item, assetType);
      if (key) logoByKey.set(String(key), item.logoIconUrl);
      if (row.query_key) logoByKey.set(String(row.query_key), item.logoIconUrl);
    }

    return items.map((row) => {
      const key = String(previewItemKey(row, assetType) ?? '');
      const logoIconUrl = row.logoIconUrl ?? row.logo_icon_url ?? logoByKey.get(key) ?? null;
      if (!logoIconUrl || row.logoIconUrl === logoIconUrl) return row;
      return { ...row, logoIconUrl };
    });
  } catch (err) {
    console.warn('preview logo enrich failed', err);
    return items;
  }
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

async function fetchMarketPreviewFromRpc(tab, assetType) {
  const { data, error } = await supabase.rpc('list_social_market_preview', {
    p_asset_type: assetType,
    p_limit: MARKET_PREVIEW_LIMIT,
  });
  if (error) throw error;
  const rows = Array.isArray(data?.items) ? data.items : [];
  const result = {
    syncedAt: data?.synced_at ?? null,
    items: rows.map(marketAssetRowToItem).filter(Boolean),
    asOn: null,
    isPreview: true,
    source: 'rpc',
  };
  writeMarketPreviewCache(tab, result);
  return result;
}

function reconcileMarketPreviewInBackground(tab, assetType) {
  if (!assetType || !isSupabaseConfigured() || skipAuthForDev()) return;
  Promise.resolve()
    .then(() => ensureSupabase())
    .then(() => {
      if (!useMarketRpc()) return null;
      return fetchMarketPreviewFromRpc(tab, assetType);
    })
    .then((payload) => {
      if (!payload) return;
      notifyMarketPreviewUpdated(tab, payload);
    })
    .catch((err) => {
      console.warn('list_social_market_preview reconcile failed', err);
    });
}

export async function fetchMarketPreview(tab, { force = false } = {}) {
  const assetType = tabToAssetType(tab);
  const cached = peekMarketPreviewCache(tab);
  if (
    !force &&
    cached?.source === 'rpc' &&
    Array.isArray(cached.items) &&
    cached.items.length
  ) {
    const normalized = normalizeMarketPreviewPayload(cached);
    // Rewrite poisoned boot cache (raw snake_case rows) so later peeks are correct.
    if (normalized.items !== cached.items) {
      writeMarketPreviewCache(tab, { ...normalized, source: 'rpc' });
    }
    // Always refresh in background — previously we returned forever and polling stalled.
    reconcileMarketPreviewInBackground(tab, assetType);
    return normalized;
  }

  const previewFile = TAB_PREVIEW[tab];
  if (previewFile && !force) {
    try {
      const payload = await fetchJson(previewFile);
      const staticResult = {
        syncedAt: payload.syncedAt ?? null,
        items: payload.items ?? [],
        asOn: payload.asOn ?? null,
        isPreview: true,
        source: 'static',
      };
      writeMarketPreviewCache(tab, staticResult);
      reconcileMarketPreviewInBackground(tab, assetType);
      return staticResult;
    } catch (err) {
      console.warn('market preview JSON failed, falling back to RPC', err);
    }
  }

  if (assetType && isSupabaseConfigured() && !skipAuthForDev()) {
    try {
      await ensureSupabase();
      if (useMarketRpc()) {
        return await fetchMarketPreviewFromRpc(tab, assetType);
      }
    } catch (err) {
      console.warn('list_social_market_preview failed, falling back to JSON', err);
    }
  }

  const file = TAB_PREVIEW[tab] ?? TAB_FULL[tab];
  if (!file) throw new Error(`Unknown market tab: ${tab}`);
  const payload = await fetchJson(file);
  const items = await enrichMarketItemsWithLogos(payload.items ?? [], assetType);
  const result = {
    syncedAt: payload.syncedAt ?? null,
    items,
    asOn: payload.asOn ?? null,
    isPreview: Boolean(TAB_PREVIEW[tab]),
    source: 'static',
  };
  writeMarketPreviewCache(tab, result);
  return result;
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
  if (!assetType || !useMarketLogoLookup()) return null;

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

  const assetType = tabToAssetType(tab);

  // Tabs without a mapped asset type stay on static JSON.
  if (!assetType) {
    return searchMarketTabLocal(tab, q, limit);
  }

  if (useMarketLogoLookup()) {
    const cacheKey = `${tab}|${q.toLowerCase()}|${limit}`;
    return cachedFetch('market-search', cacheKey, MARKET_SEARCH_TTL_MS, async () => {
      try {
        const rpcResult = await searchMarketTabRpc(tab, q, limit);
        if (rpcResult) {
          return {
            ...rpcResult,
            items: await enrichMarketItemsWithLogos(rpcResult.items ?? [], assetType),
          };
        }
      } catch (err) {
        console.warn('search_social_market_assets failed', err);
      }

      const local = await searchMarketTabLocal(tab, q, limit);
      return {
        ...local,
        items: await enrichMarketItemsWithLogos(local.items ?? [], assetType),
      };
    });
  }

  const local = await searchMarketTabLocal(tab, q, limit);
  return {
    ...local,
    items: await enrichMarketItemsWithLogos(local.items ?? [], assetType),
  };
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
  const needle = String(id ?? '').trim();
  if (!needle) return null;
  const needleUpper = needle.toUpperCase();

  const matchItem = (item) => {
    if (!item) return false;
    const candidates = [item.id, item.symbol, item.schemeCode, item.assetKey];
    return candidates.some((c) => {
      const s = String(c ?? '').trim();
      return s === needle || s.toUpperCase() === needleUpper;
    });
  };

  // Hot queryCache from prior list/detail/batch lookups.
  const fromQuery = getCached('market-asset', needle, MARKET_ASSET_TTL_MS);
  if (fromQuery) return fromQuery;
  const fromQueryUpper = getCached('market-asset', needleUpper, MARKET_ASSET_TTL_MS);
  if (fromQueryUpper) return fromQueryUpper;

  // Session tab preview (boot / Markets list) — often warmer than module JSON cache.
  const preview = peekMarketPreviewCache(tab);
  if (Array.isArray(preview?.items)) {
    const found = preview.items.find(matchItem);
    if (found) {
      seedMarketAssetCache(found, needle);
      return found;
    }
  }

  const previewFile = TAB_PREVIEW[tab];
  const searchFile = TAB_SEARCH[tab];
  for (const file of [previewFile, searchFile]) {
    if (!file) continue;
    const cached = cache.get(file);
    if (!cached?.items) continue;
    const found = cached.items.find(matchItem);
    if (found) {
      seedMarketAssetCache(found, needle);
      return found;
    }
  }
  return null;
}

async function lookupMarketAssetRpc(key) {
  if (!useMarketLogoLookup()) return null;
  const hit = getCached('market-asset', key, MARKET_ASSET_TTL_MS);
  if (hit !== undefined) return hit;

  const { data, error } = await supabase.rpc('lookup_social_market_asset', {
    p_key: key,
  });
  if (error) throw error;
  const item = data ? marketAssetRowToItem(data) : null;
  setCached('market-asset', key, item);
  if (item) seedMarketAssetCache(item, key);
  return item;
}

export async function lookupMarketAssetsBatch(keys) {
  const unique = [...new Set(keys.map((key) => String(key ?? '').trim()).filter(Boolean))];
  if (!unique.length) return new Map();

  const map = new Map();
  const missing = [];
  for (const key of unique) {
    const hit = getCached('market-asset', key, MARKET_ASSET_TTL_MS);
    if (hit !== undefined) {
      if (hit) {
        map.set(key, hit);
        const alias = hit.symbol ?? hit.schemeCode ?? hit.id;
        if (alias) map.set(alias, hit);
      }
      continue;
    }
    missing.push(key);
  }

  if (!missing.length) return map;

  if (useMarketLogoLookup()) {
    try {
      const { data, error } = await supabase.rpc('lookup_social_market_assets_batch', {
        p_keys: missing,
      });
      if (error) throw error;
      const foundKeys = new Set();
      for (const row of data ?? []) {
        const item = marketAssetRowToItem(row);
        if (!item) continue;
        const key = row.asset_key ?? item.symbol ?? item.schemeCode;
        map.set(key, item);
        if (row.query_key) {
          map.set(row.query_key, item);
          setCached('market-asset', row.query_key, item);
          foundKeys.add(row.query_key);
        }
        if (key) {
          setCached('market-asset', key, item);
          foundKeys.add(key);
        }
      }
      for (const key of missing) {
        if (!foundKeys.has(key) && !map.has(key)) {
          setCached('market-asset', key, null);
        }
      }
      return map;
    } catch (err) {
      console.warn('lookup_social_market_assets_batch failed', err);
    }
  }

  return map;
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
        seedMarketAssetCache(found, symbol);
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

  const match =
    stockMatches.items.find((item) => item.symbol === symbol) ??
    etfMatches.items.find((item) => item.symbol === symbol) ??
    null;
  if (match) seedMarketAssetCache(match, symbol);
  return match;
}

export async function resolveMarketFund(schemeCode) {
  const code = String(schemeCode ?? '').trim();
  if (!code) return null;

  const cached = findCachedMarketItem('mutual_funds', code);
  if (cached) return cached;

  if (useMarketRpc()) {
    try {
      const found = await lookupMarketAssetRpc(code);
      if (found && found.assetType === 'fund') {
        seedMarketAssetCache(found, code);
        return found;
      }
    } catch (err) {
      console.warn('lookup_social_market_asset failed', err);
    }
  }

  const { items } = await searchMarketTab('mutual_funds', code, 20);
  const match =
    items.find((item) => String(item.schemeCode ?? item.id ?? '') === code) ?? null;
  if (match) seedMarketAssetCache(match, code);
  return match;
}

async function loadFullMarketTab(tab) {
  const file = TAB_FULL[tab];
  if (!file) return [];
  const payload = await fetchJson(file);
  return payload.items ?? [];
}

export async function resolveMarketIndex(indexId) {
  const id = String(indexId ?? '').trim();
  if (!id) return null;

  const cached = findCachedMarketItem('indices', id);
  if (cached) return cached;

  if (useMarketRpc()) {
    try {
      const found = await lookupMarketAssetRpc(id);
      if (found?.assetType === 'index') {
        seedMarketAssetCache(found, id);
        return found;
      }
    } catch (err) {
      console.warn('lookup_social_market_asset index failed', err);
    }

    try {
      const { items } = await searchMarketTab('indices', id, 20);
      const match = items.find(
        (item) =>
          item.id === id ||
          item.symbol === id ||
          String(item.id ?? '').toUpperCase() === id.toUpperCase() ||
          String(item.symbol ?? '').toUpperCase() === id.toUpperCase()
      );
      if (match) {
        seedMarketAssetCache(match, id);
        return match;
      }
    } catch (err) {
      console.warn('search index failed, falling back to JSON', err);
    }
  }

  const items = await loadFullMarketTab('indices');
  const match =
    items.find(
      (item) =>
        item.id === id ||
        item.symbol === id ||
        String(item.id ?? '').toUpperCase() === id.toUpperCase()
    ) ?? null;
  if (match) seedMarketAssetCache(match, id);
  return match;
}

export async function resolveMarketCommodity(commodityId) {
  const id = String(commodityId ?? '').trim();
  if (!id) return null;

  const cached = findCachedMarketItem('commodity', id);
  if (cached) return cached;

  if (useMarketRpc()) {
    try {
      const live = await lookupMarketAssetRpc(id);
      if (live?.assetType === 'commodity') {
        seedMarketAssetCache(live, id);
        return live;
      }
    } catch (err) {
      console.warn('lookup commodity failed, falling back to JSON', err);
    }
  }

  const items = await loadFullMarketTab('commodity');
  const match =
    items.find(
      (item) =>
        item.id === id ||
        item.symbol === id ||
        `${item.symbol}-${item.location}` === id ||
        String(item.id ?? '').toUpperCase() === id.toUpperCase()
    ) ?? null;
  if (match) seedMarketAssetCache(match, id);
  return match;
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
    navDate: fund.navDate ?? fund.asOfDate,
    asOfDate: fund.asOfDate ?? fund.navDate,
    changePct: fund.changePct,
    change: fund.change,
    previousClose: fund.previousClose,
    syncedAt: fund.syncedAt,
    priceSource: fund.priceSource,
    schemeType: fund.schemeType,
    subCategory: fund.subCategory,
    logoIconUrl: fund.logoIconUrl ?? null,
    logoUrl: fund.logoUrl ?? null,
    assetType: fund.assetType ?? 'fund',
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
    previousClose: stock.previousClose,
    asOfDate: stock.asOfDate,
    syncedAt: stock.syncedAt,
    priceSource: stock.priceSource,
    exchange: stock.exchange,
    isin: stock.isin,
    series: stock.series,
    segment: stock.segment,
    logoIconUrl: stock.logoIconUrl ?? null,
    logoUrl: stock.logoUrl ?? null,
    assetType: stock.assetType ?? null,
    id: stock.id ?? stock.symbol,
  };
}

/** Daily close / NAV history for analytics charts. */
export async function getSocialMarketPriceHistory(assetType, assetKey, limit = 120) {
  if (!useMarketRpc() || !assetType || !assetKey) return [];
  const { data, error } = await supabase.rpc('get_social_market_price_history', {
    p_asset_type: assetType,
    p_asset_key: assetKey,
    p_limit: limit,
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/**
 * When live change_pct / previous_close are missing, derive them from the
 * two most recent history closes (newest first from get_social_market_price_history).
 */
export async function deriveDayChangeFromHistory(assetType, assetKey, currentPrice = null) {
  const rows = await getSocialMarketPriceHistory(assetType, assetKey, 5);
  if (!Array.isArray(rows) || rows.length < 2) return null;

  const latest = rows[0];
  const prior = rows[1];
  const price =
    currentPrice != null && Number.isFinite(Number(currentPrice))
      ? Number(currentPrice)
      : latest?.close_price != null
        ? Number(latest.close_price)
        : null;
  const previousClose =
    prior?.close_price != null ? Number(prior.close_price) : null;
  if (!Number.isFinite(price) || !Number.isFinite(previousClose) || previousClose === 0) {
    return null;
  }

  const change = price - previousClose;
  return {
    previousClose,
    change,
    changePct: (change / previousClose) * 100,
  };
}

export async function withDerivedDayChange(item, assetType = 'fund') {
  if (!item) return item;
  const hasPct = item.changePct != null && Number.isFinite(Number(item.changePct));
  const hasPrev =
    item.previousClose != null && Number.isFinite(Number(item.previousClose));
  if (hasPct && hasPrev) return item;

  const key = item.schemeCode ?? item.id ?? item.symbol ?? item.asset_key;
  if (!key) return item;

  try {
    const derived = await deriveDayChangeFromHistory(
      assetType,
      key,
      item.nav ?? item.price ?? null
    );
    if (!derived) return item;
    return {
      ...item,
      previousClose: item.previousClose ?? derived.previousClose,
      change: item.change ?? derived.change,
      changePct: item.changePct ?? derived.changePct,
    };
  } catch {
    return item;
  }
}

// Legacy alias used by detail pages during migration.
export async function fetchMarketTab(tab) {
  return fetchMarketPreview(tab);
}

/** Distinct Screener industries for stock filters (public RPC; works logged-out). */
export async function fetchDistinctStockIndustries() {
  if (!isSupabaseConfigured()) return [];
  try {
    const client = await ensureSupabase();
    if (!client) return [];
    const { data, error } = await client.rpc('list_distinct_stock_industries');
    if (error) {
      console.warn('list_distinct_stock_industries failed', error);
      return [];
    }
    return (data ?? [])
      .map((row) => String(row.industry ?? '').trim())
      .filter(Boolean);
  } catch (err) {
    console.warn('fetchDistinctStockIndustries failed', err);
    return [];
  }
}

/** Map ticker → Screener industry for the given symbols. */
export async function lookupStockIndustries(tickers) {
  const keys = [...new Set((tickers ?? []).map((t) => String(t ?? '').trim().toUpperCase()).filter(Boolean))];
  if (!keys.length || !isSupabaseConfigured()) return new Map();
  try {
    const client = await ensureSupabase();
    if (!client) return new Map();
    const { data, error } = await client.rpc('lookup_stock_industries', { p_keys: keys });
    if (error) {
      console.warn('lookup_stock_industries failed', error);
      return new Map();
    }
    const map = new Map();
    for (const row of data ?? []) {
      const key = String(row.asset_key ?? '').trim().toUpperCase();
      const industry = String(row.industry ?? '').trim();
      if (key && industry) map.set(key, industry);
    }
    return map;
  } catch (err) {
    console.warn('lookupStockIndustries failed', err);
    return new Map();
  }
}
