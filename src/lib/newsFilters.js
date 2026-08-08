import { searchMarketTab, MARKET_MIN_SEARCH_CHARS } from './marketDataApi';
import { searchPortfolioAssets } from './portfolioAssetUniverse';
import { parseNewsSocialContent } from './newsPostBody';

export { MARKET_MIN_SEARCH_CHARS };

/**
 * Distinct news type labels from posts (via.type).
 * @param {object[]} posts
 * @returns {string[]}
 */
export function collectNewsTypes(posts) {
  const set = new Set();
  for (const post of posts ?? []) {
    const type = String(post?.via?.type ?? '').trim();
    if (type) set.add(type);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Tickers referenced by news posts.
 * @param {object[]} posts
 * @returns {string[]}
 */
export function collectNewsTickers(posts) {
  const set = new Set();
  for (const post of posts ?? []) {
    const { symbol } = parseNewsSocialContent(post);
    const ticker = String(symbol ?? post?.via?.ticker ?? '')
      .trim()
      .toUpperCase();
    if (ticker) set.add(ticker);
  }
  return [...set];
}

/**
 * Filter news posts.
 * Scope: optional Portfolio (holdings set).
 * Custom: at most one dimension — company | type | industry — with multi-select values.
 *
 * @param {object[]} posts
 * @param {{ myHoldingsOnly?: boolean, customDim?: 'company'|'type'|'industry'|null, companies?: string[], types?: string[], industries?: string[] }} filters
 * @param {{ holdings?: Set<string>|string[], industryByTicker?: Map<string, string> }} ctx
 */
export function filterNewsPosts(posts, filters = {}, ctx = {}) {
  const list = Array.isArray(posts) ? posts : [];
  const holdings = ctx.holdings instanceof Set
    ? ctx.holdings
    : new Set(
        [...(ctx.holdings ?? [])].map((t) => String(t).trim().toUpperCase()).filter(Boolean)
      );
  const industryByTicker = ctx.industryByTicker instanceof Map ? ctx.industryByTicker : new Map();

  const customDim = filters.customDim ?? null;
  const companies = new Set(
    (filters.companies ?? []).map((t) => String(t).trim().toUpperCase()).filter(Boolean)
  );
  const types = new Set(
    (filters.types ?? []).map((t) => String(t).trim()).filter(Boolean)
  );
  const industries = new Set(
    (filters.industries ?? []).map((t) => String(t).trim()).filter(Boolean)
  );
  const myHoldingsOnly = Boolean(filters.myHoldingsOnly);

  return list.filter((post) => {
    const { symbol } = parseNewsSocialContent(post);
    const ticker = String(symbol ?? post?.via?.ticker ?? '')
      .trim()
      .toUpperCase();
    const type = String(post?.via?.type ?? '').trim();
    const industry = ticker ? industryByTicker.get(ticker) ?? '' : '';

    if (myHoldingsOnly) {
      if (!ticker || !holdings.has(ticker)) return false;
    }

    if (customDim === 'company' && companies.size) {
      if (!ticker || !companies.has(ticker)) return false;
    } else if (customDim === 'type' && types.size) {
      if (!type || !types.has(type)) return false;
    } else if (customDim === 'industry' && industries.size) {
      if (!industry || !industries.has(industry)) return false;
    }

    return true;
  });
}

export function countActiveNewsFilters(filters = {}) {
  let n = 0;
  if (filters.myHoldingsOnly) n += 1;
  const dim = filters.customDim;
  if (dim === 'company') n += (filters.companies ?? []).length;
  else if (dim === 'type') n += (filters.types ?? []).length;
  else if (dim === 'industry') n += (filters.industries ?? []).length;
  return n;
}

/** Stable id for “all portfolios combined” scope option. */
export const NEWS_ALL_PORTFOLIOS_ID = '__all__';

/**
 * Search stocks, ETFs, funds, and commodities for the company multi-select.
 */
export async function searchNewsFilterCompanies(query, { exclude = [], limit = 12 } = {}) {
  const q = String(query ?? '').trim();
  if (q.length < MARKET_MIN_SEARCH_CHARS) return [];

  const excludeSet = new Set(
    exclude.map((v) => String(v ?? '').trim().toUpperCase()).filter(Boolean)
  );

  const [assets, commodityResult] = await Promise.all([
    searchPortfolioAssets(q, { exclude: [...excludeSet], limit }),
    searchMarketTab('commodity', q, 6).catch(() => ({ items: [] })),
  ]);

  const out = [];
  const seen = new Set();

  for (const asset of assets ?? []) {
    const key = String(asset.key ?? '').trim().toUpperCase();
    if (!key || seen.has(key) || excludeSet.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      symbol: asset.symbol ?? key,
      name: asset.name ?? '',
      kind: asset.kind ?? 'stock',
      kindLabel: asset.kindLabel ?? 'Stock',
      logoIconUrl: asset.logoIconUrl ?? null,
    });
  }

  for (const item of commodityResult?.items ?? []) {
    const key = String(item.id ?? item.symbol ?? '')
      .trim()
      .toUpperCase();
    if (!key || seen.has(key) || excludeSet.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      symbol: item.symbol ?? key,
      name: item.name ?? key,
      kind: 'commodity',
      kindLabel: 'Commodity',
      logoIconUrl: item.logoIconUrl ?? null,
    });
  }

  return out.slice(0, limit);
}

/**
 * Collect holding/watchlist tickers from portfolio list API rows.
 */
export function tickersFromPortfolios(portfolios) {
  const set = new Set();
  for (const p of portfolios ?? []) {
    for (const h of p?.holdings ?? []) {
      const t = String(h?.ticker ?? '')
        .trim()
        .toUpperCase();
      if (t) set.add(t);
    }
    for (const t of p?.tickers ?? []) {
      const key = String(t ?? '')
        .trim()
        .toUpperCase();
      if (key) set.add(key);
    }
  }
  return set;
}
