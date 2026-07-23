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
  return ticker ? `/stock/${encodeSegment(ticker)}` : '/markets';
}

export function etfPath(symbol) {
  const ticker = String(symbol ?? '')
    .trim()
    .toUpperCase();
  return ticker ? `/etf/${encodeSegment(ticker)}` : '/markets';
}

export function fundPath(schemeCode) {
  const id = String(schemeCode ?? '').trim();
  return id ? `/fund/${encodeSegment(id)}` : '/markets';
}

export function indexPath(indexId) {
  const id = String(indexId ?? '').trim();
  return id ? `/index/${encodeSegment(id)}` : '/markets';
}

export function commodityPath(commodityId) {
  const id = String(commodityId ?? '').trim();
  return id ? `/commodity/${encodeSegment(id)}` : '/markets';
}

export function postPath(postId) {
  const id = String(postId ?? '').trim();
  return id ? `/post/${encodeSegment(id)}` : '/feed';
}

export function tabPath(tab) {
  if (tab === 'feed') return '/feed';
  return `/${tab}`;
}

export function insightsPath() {
  return '/insights';
}

export function learningPath() {
  return '/learning';
}

export function resourcesPath(tool) {
  const key = String(tool ?? '')
    .trim()
    .toLowerCase();
  if (key === 'mf-screener' || key === 'screener') return '/resources/mf-screener';
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

const KNOWN_TABS = new Set(['feed', 'search', 'activity', 'portfolio', 'markets', 'settings']);
const MARKETING_PAGES = new Set(['insights', 'learning', 'resources', 'disclosures']);
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

  const resourcesToolMatch = pathname.match(/^\/resources\/(mf-screener)\/?$/);
  if (resourcesToolMatch) {
    return {
      kind: 'marketing',
      page: 'resources',
      section: resourcesToolMatch[1],
    };
  }

  const marketingMatch = pathname.match(/^\/(insights|learning|resources)\/?$/);
  if (marketingMatch && MARKETING_PAGES.has(marketingMatch[1])) {
    return { kind: 'marketing', page: marketingMatch[1], section: null };
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

  const tab = pathname.replace(/^\//, '').split('/')[0] || 'feed';
  return { kind: 'tab', tab: KNOWN_TABS.has(tab) ? tab : 'feed' };
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
  return tabPath(tab);
}
