/** URL helpers — shareable paths for profiles, portfolios, and market assets. */

export function normalizeUsername(username) {
  return String(username ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
}

function encodeSegment(value) {
  return encodeURIComponent(String(value ?? '').trim());
}

function decodeSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function profilePath(username, { portfolioId } = {}) {
  const handle = normalizeUsername(username);
  if (!handle) return '/feed';
  if (portfolioId) return `/@${handle}/portfolio/${encodeSegment(portfolioId)}`;
  return `/@${handle}`;
}

export function stockPath(symbol) {
  const ticker = String(symbol ?? '')
    .trim()
    .toUpperCase();
  return ticker ? `/stock/${encodeSegment(ticker)}` : '/ideas';
}

export function etfPath(symbol) {
  const ticker = String(symbol ?? '')
    .trim()
    .toUpperCase();
  return ticker ? `/etf/${encodeSegment(ticker)}` : '/ideas';
}

export function fundPath(schemeCode) {
  const id = String(schemeCode ?? '').trim();
  return id ? `/fund/${encodeSegment(id)}` : '/ideas';
}

export function indexPath(indexId) {
  const id = String(indexId ?? '').trim();
  return id ? `/index/${encodeSegment(id)}` : '/ideas';
}

export function commodityPath(commodityId) {
  const id = String(commodityId ?? '').trim();
  return id ? `/commodity/${encodeSegment(id)}` : '/ideas';
}

export function postPath(postId) {
  const id = String(postId ?? '').trim();
  return id ? `/post/${encodeSegment(id)}` : '/feed';
}

export function tabPath(tab) {
  if (tab === 'feed') return '/feed';
  return `/${tab}`;
}

/** Ideas hub, e.g. /ideas */
export function ideasPath() {
  return '/ideas';
}

export const MARKET_SECTIONS = new Set([
  'stocks',
  'mutual_funds',
  'etf',
  'indices',
  'commodity',
]);

/**
 * @deprecated Markets hub retired — aliases to Ideas.
 * Section arg ignored; discovery is Ideas + global search.
 */
export function marketsPath(_section) {
  return ideasPath();
}

export function parseMarketSection(search) {
  const raw =
    typeof search === 'string'
      ? new URLSearchParams(search.startsWith('?') ? search : `?${search}`).get('section')
      : search instanceof URLSearchParams
        ? search.get('section')
        : null;
  const key = String(raw ?? '')
    .trim()
    .toLowerCase();
  return MARKET_SECTIONS.has(key) ? key : null;
}

/**
 * @deprecated Explore hub retired — aliases to Ideas.
 * Query is not preserved; use global search in the shell.
 */
export function explorePath(_query) {
  return ideasPath();
}

export function insightsPath() {
  return '/insights';
}

export function businessModelPath() {
  return '/business-model';
}

/** @deprecated use businessModelPath */
export function learningPath() {
  return businessModelPath();
}

/** Company Brief under Business Model, e.g. /business-model/TIPSFILMS */
export function businessModelBriefPath(symbol) {
  const ticker = String(symbol ?? '')
    .trim()
    .toUpperCase();
  return ticker ? `/business-model/${encodeSegment(ticker)}` : businessModelPath();
}

/** @deprecated use businessModelBriefPath */
export function learningBriefPath(symbol) {
  return businessModelBriefPath(symbol);
}

export function resourcesPath(tool) {
  const key = String(tool ?? '')
    .trim()
    .toLowerCase();
  if (key === 'mf-screener' || key === 'screener') return '/resources/mf-screener';
  if (
    key === 'etf-tracker' ||
    key === 'etf-inav' ||
    key === 'etf-inav-tracker' ||
    key === 'inav'
  ) {
    return '/etf-tracker';
  }
  if (
    key === 'gold-tracker' ||
    key === 'sgb' ||
    key === 'sgb-tracker' ||
    key === 'gold-sgb'
  ) {
    return '/gold-tracker';
  }
  return '/resources';
}

export function disclosuresPath(section) {
  const key = String(section ?? '')
    .trim()
    .toLowerCase();
  if (key === 'privacy') return '/disclosures/privacy';
  if (key === 'terms' || key === 'terms-and-conditions') return '/disclosures/terms';
  if (key === 'terms-of-service' || key === 'tos') return '/disclosures/terms-of-service';
  return '/disclosures';
}

const KNOWN_TABS = new Set([
  'feed',
  'explore',
  'ideas',
  'activity',
  'portfolio',
  'markets',
  'settings',
  // Legacy aliases — parseAppPath redirects these to Ideas.
  'search',
]);

const RETIRED_TABS = new Set(['explore', 'markets', 'search']);
const MARKETING_PAGES = new Set(['insights', 'learning', 'business-model', 'resources', 'disclosures']);
const DISCLOSURE_SECTIONS = new Set(['privacy', 'terms', 'terms-of-service']);

export function parseAppPath(pathname) {
  const profileMatch = pathname.match(/^\/@([^/]+)(?:\/portfolio\/([^/]+))?\/?$/);
  if (profileMatch) {
    return {
      kind: 'profile',
      username: normalizeUsername(profileMatch[1]),
      portfolioId: profileMatch[2] ? decodeSegment(profileMatch[2]) : null,
    };
  }

  const disclosuresMatch = pathname.match(/^\/disclosures(?:\/([^/]+))?\/?$/);
  if (disclosuresMatch) {
    const section = disclosuresMatch[1] ? decodeSegment(disclosuresMatch[1]).toLowerCase() : null;
    return {
      kind: 'marketing',
      page: 'disclosures',
      section: section && DISCLOSURE_SECTIONS.has(section) ? section : null,
    };
  }

  const trackerMatch = pathname.match(/^\/(gold-tracker|etf-tracker)\/?$/);
  if (trackerMatch) {
    return {
      kind: 'marketing',
      page: 'resources',
      section: trackerMatch[1] === 'gold-tracker' ? 'sgb' : 'etf-inav',
    };
  }

  // Legacy /resources/* tracker URLs — App may redirect to the new root paths.
  const resourcesToolMatch = pathname.match(
    /^\/resources\/(mf-screener|etf-inav|sgb)\/?$/
  );
  if (resourcesToolMatch) {
    const section = resourcesToolMatch[1];
    return {
      kind: 'marketing',
      page: 'resources',
      section,
      redirectTo:
        section === 'sgb'
          ? '/gold-tracker'
          : section === 'etf-inav'
            ? '/etf-tracker'
            : null,
    };
  }

  const businessModelBriefMatch = pathname.match(
    /^\/(?:business-model|learning)\/([^/]+)\/?$/
  );
  if (businessModelBriefMatch) {
    return {
      kind: 'marketing',
      page: 'business-model',
      section: 'brief',
      symbol: decodeSegment(businessModelBriefMatch[1]).toUpperCase(),
    };
  }

  const marketingMatch = pathname.match(
    /^\/(insights|learning|business-model|resources)\/?$/
  );
  if (marketingMatch && MARKETING_PAGES.has(marketingMatch[1])) {
    const page =
      marketingMatch[1] === 'learning' ? 'business-model' : marketingMatch[1];
    return { kind: 'marketing', page, section: null };
  }

  const stockMatch = pathname.match(/^\/stock\/([^/]+)\/?$/);
  if (stockMatch) {
    return {
      kind: 'stock',
      symbol: decodeSegment(stockMatch[1]).toUpperCase(),
    };
  }

  const etfMatch = pathname.match(/^\/etf\/([^/]+)\/?$/);
  if (etfMatch) {
    return {
      kind: 'etf',
      symbol: decodeSegment(etfMatch[1]).toUpperCase(),
    };
  }

  const fundMatch = pathname.match(/^\/fund\/([^/]+)\/?$/);
  if (fundMatch) {
    return {
      kind: 'fund',
      schemeCode: decodeSegment(fundMatch[1]),
    };
  }

  const indexMatch = pathname.match(/^\/index\/([^/]+)\/?$/);
  if (indexMatch) {
    return {
      kind: 'index',
      indexId: decodeSegment(indexMatch[1]),
    };
  }

  const commodityMatch = pathname.match(/^\/commodity\/([^/]+)\/?$/);
  if (commodityMatch) {
    return {
      kind: 'commodity',
      commodityId: decodeSegment(commodityMatch[1]),
    };
  }

  const postMatch = pathname.match(/^\/post\/([^/]+)\/?$/);
  if (postMatch) {
    return {
      kind: 'post',
      postId: decodeSegment(postMatch[1]),
    };
  }

  // Legacy theme URLs (/ideas/ai, etc.) collapse to the Ideas hub.
  if (pathname.match(/^\/ideas\/[^/]+\/?$/)) {
    return { kind: 'tab', tab: 'ideas' };
  }

  const tab = pathname.replace(/^\//, '').split('/')[0] || 'feed';
  if (!KNOWN_TABS.has(tab)) {
    return { kind: 'tab', tab: 'feed' };
  }
  // Retired hubs → Ideas (Explore, Markets, legacy Search).
  if (RETIRED_TABS.has(tab)) {
    return { kind: 'tab', tab: 'ideas', redirectFrom: tab };
  }
  return { kind: 'tab', tab };
}

/** Asset detail URLs that can render without auth. */
export function isPublicAssetPath(parsed) {
  if (!parsed) return false;
  return (
    parsed.kind === 'stock' ||
    parsed.kind === 'etf' ||
    parsed.kind === 'fund' ||
    parsed.kind === 'index' ||
    parsed.kind === 'commodity'
  );
}

/** @deprecated Use isPublicAssetPath */
export function isPublicMarketsPath(parsed) {
  return isPublicAssetPath(parsed);
}

export function pathFromAppState({
  tab,
  profileUserId,
  profilePortfolioId,
  selectedPostId,
  selectedTicker,
  selectedTickerKind = 'stock',
  selectedFundId,
  selectedIndexId,
  selectedCommodityId,
  marketsSectionTab,
  getHandleForUserId,
}) {
  if (selectedPostId) return postPath(selectedPostId);
  if (selectedCommodityId) return commodityPath(selectedCommodityId);
  if (selectedIndexId) return indexPath(selectedIndexId);
  if (selectedFundId) return fundPath(selectedFundId);
  if (selectedTicker) {
    return selectedTickerKind === 'etf'
      ? etfPath(selectedTicker)
      : stockPath(selectedTicker);
  }
  if (tab === 'profile') {
    const handle = getHandleForUserId?.(profileUserId);
    if (handle) return profilePath(handle, { portfolioId: profilePortfolioId });
    // Avoid `/profile` — it is not a known tab and parseAppPath falls back to feed.
    return null;
  }
  if (tab === 'markets' || tab === 'explore' || tab === 'search') {
    return ideasPath();
  }
  if (tab === 'ideas') {
    return ideasPath();
  }
  return tabPath(tab);
}
