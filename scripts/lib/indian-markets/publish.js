export const PREVIEW_LIMIT = 40;
export const SEARCH_LIMIT = 50;

export function sortByAbsChange(items, changeKey = 'changePct') {
  return [...items].sort(
    (a, b) => Math.abs(b[changeKey] ?? 0) - Math.abs(a[changeKey] ?? 0)
  );
}

export function buildPreview(items, { limit = PREVIEW_LIMIT, changeKey = 'changePct' } = {}) {
  const withChange = items.filter((item) => item[changeKey] != null);
  if (withChange.length >= limit) {
    return sortByAbsChange(withChange, changeKey).slice(0, limit);
  }
  return sortByAbsChange(items, changeKey).slice(0, limit);
}

export function buildMutualFundPreview(funds, limit = PREVIEW_LIMIT) {
  const directGrowth = funds.filter(
    (fund) => /direct/i.test(fund.name) && /growth/i.test(fund.name)
  );
  const pool = directGrowth.length >= limit ? directGrowth : funds;
  return pool.slice(0, limit);
}

export function compactStock(item) {
  return {
    id: item.symbol,
    symbol: item.symbol,
    name: item.name,
    price: item.price,
    changePct: item.changePct,
    segment: item.segment,
    isin: item.isin,
  };
}

export function compactFund(item) {
  return {
    id: item.schemeCode,
    schemeCode: item.schemeCode,
    name: item.name,
    nav: item.nav,
    navDate: item.navDate,
    category: item.category,
    subCategory: item.subCategory,
    amc: item.amc,
    schemeType: item.schemeType,
  };
}

export function compactEtf(item) {
  return {
    id: item.symbol,
    symbol: item.symbol,
    name: item.name,
    ltp: item.ltp,
    changePct: item.changePct,
    nav: item.nav,
  };
}

export function compactIndex(item) {
  return {
    id: item.id,
    symbol: item.symbol,
    name: item.name,
    group: item.group,
    value: item.value,
    changePct: item.changePct,
    change: item.change,
  };
}

export function compactCommodity(item) {
  return {
    id: `${item.id}-${item.location}`,
    name: item.name,
    symbol: item.symbol,
    unit: item.unit,
    location: item.location,
    spotPrice: item.spotPrice,
    change: item.change,
  };
}

export function filterMarketItems(items, query, fields) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return items.filter((item) =>
    fields.some((field) => String(item[field] ?? '').toLowerCase().includes(q))
  );
}
