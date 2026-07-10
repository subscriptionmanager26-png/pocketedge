/** URL helpers — profiles use /@username (not internal IDs). */

export function normalizeUsername(username) {
  return String(username ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
}

export function profilePath(username, { portfolioId } = {}) {
  const handle = normalizeUsername(username);
  if (!handle) return '/feed';
  if (portfolioId) return `/@${handle}/portfolio/${portfolioId}`;
  return `/@${handle}`;
}

export function parseAppPath(pathname) {
  const profileMatch = pathname.match(/^\/@([^/]+)(?:\/portfolio\/([^/]+))?\/?$/);
  if (profileMatch) {
    return {
      kind: 'profile',
      username: normalizeUsername(profileMatch[1]),
      portfolioId: profileMatch[2] ?? null,
    };
  }

  const tab = pathname.replace(/^\//, '').split('/')[0] || 'feed';
  const known = new Set(['feed', 'search', 'activity', 'portfolio', 'markets', 'settings']);
  return { kind: 'tab', tab: known.has(tab) ? tab : 'feed' };
}

export function tabPath(tab) {
  if (tab === 'feed') return '/feed';
  return `/${tab}`;
}
