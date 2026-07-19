const FEED_CACHE_KEY = 'pe_social_feed_v1';
const FEED_CACHE_TTL_MS = 15 * 60 * 1000;

export function readCachedFeedPosts() {
  try {
    const raw = sessionStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.items)) return null;
    if (Date.now() - Number(parsed.ts ?? 0) > FEED_CACHE_TTL_MS) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

export function writeCachedFeedPosts(items) {
  try {
    sessionStorage.setItem(
      FEED_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), items: items ?? [] })
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearCachedFeedPosts() {
  try {
    sessionStorage.removeItem(FEED_CACHE_KEY);
  } catch {
    /* ignore */
  }
}
