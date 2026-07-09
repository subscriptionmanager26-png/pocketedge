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

const cache = new Map();

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

async function loadSearchIndex(tab) {
  const file = TAB_SEARCH[tab];
  if (!file) return [];
  const payload = await fetchJson(file);
  return payload.items ?? [];
}

export async function searchMarketTab(tab, query, limit = MARKET_SEARCH_LIMIT) {
  const q = query.trim();
  if (q.length < MARKET_MIN_SEARCH_CHARS) {
    return { items: [], total: 0 };
  }

  const items = await loadSearchIndex(tab);
  const fields = SEARCH_FIELDS[tab] ?? ['name'];
  const needle = q.toLowerCase();

  const matches = [];
  for (const item of items) {
    const hit = fields.some((field) =>
      String(item[field] ?? '').toLowerCase().includes(needle)
    );
    if (hit) {
      matches.push(item);
      if (matches.length >= limit) break;
    }
  }

  return { items: matches, total: matches.length };
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

export async function resolveMarketStock(symbol) {
  const cached = findCachedMarketItem('stocks', symbol);
  if (cached) return cached;

  const etfCached = findCachedMarketItem('etf', symbol);
  if (etfCached) return etfCached;

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
    nav: fund.nav,
    navDate: fund.navDate,
    schemeType: fund.schemeType,
    subCategory: fund.subCategory,
  };
}

export function marketStockToDetail(stock) {
  if (!stock) return null;
  return {
    ticker: stock.symbol,
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
