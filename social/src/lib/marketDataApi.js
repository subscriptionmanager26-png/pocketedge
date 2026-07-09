const BASE = '/data/markets';

const TAB_FILES = {
  stocks: 'stocks.json',
  mutual_funds: 'mutual-funds.json',
  etf: 'etf.json',
  indices: 'indices.json',
  commodity: 'commodities.json',
};

const cache = new Map();

async function fetchJson(file) {
  if (cache.has(file)) return cache.get(file);
  const promise = fetch(`${BASE}/${file}`)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${file}`);
      return res.json();
    })
    .then((payload) => {
      cache.set(file, payload);
      return payload;
    });
  cache.set(file, promise);
  return promise;
}

export async function fetchMarketManifest() {
  return fetchJson('manifest.json');
}

export async function fetchMarketTab(tab) {
  const file = TAB_FILES[tab];
  if (!file) throw new Error(`Unknown market tab: ${tab}`);
  const payload = await fetchJson(file);
  return {
    syncedAt: payload.syncedAt ?? null,
    items: payload.items ?? [],
    asOn: payload.asOn ?? null,
  };
}

export function findMarketFund(schemeCode) {
  const cached = cache.get(TAB_FILES.mutual_funds);
  if (!cached || !cached.items) return null;
  return cached.items.find((f) => f.schemeCode === schemeCode || f.id === schemeCode) ?? null;
}

export function findMarketStock(symbol) {
  const cached = cache.get(TAB_FILES.stocks);
  if (!cached || !cached.items) return null;
  return (
    cached.items.find((s) => s.symbol === symbol || s.ticker === symbol) ?? null
  );
}

export function marketFundToDetail(fund) {
  if (!fund) return null;
  const category = [fund.category, fund.subCategory].filter(Boolean).join(' · ');
  return {
    id: fund.schemeCode,
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
    price: stock.price,
    changePct: stock.changePct,
    isin: stock.isin,
    series: stock.series,
    segment: stock.segment,
  };
}
