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

const KNOWN_TABS = new Set(['feed', 'search', 'activity', 'portfolio', 'markets', 'settings']);

export function parseAppPath(pathname) {
  const profileMatch = pathname.match(/^\/@([^/]+)(?:\/portfolio\/([^/]+))?\/?$/);
  if (profileMatch) {
    return {
      kind: 'profile',
      username: normalizeUsername(profileMatch[1]),
      portfolioId: profileMatch[2] ? decodeSegment(profileMatch[2]) : null,
    };
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
