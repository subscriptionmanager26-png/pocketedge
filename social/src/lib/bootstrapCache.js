const BOOTSTRAP_CACHE_KEY = 'pe_social_bootstrap_v1';
const BOOTSTRAP_CACHE_TTL_MS = 15 * 60 * 1000;

export function readCachedBootstrap() {
  try {
    const raw = sessionStorage.getItem(BOOTSTRAP_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.profile) return null;
    if (Date.now() - Number(parsed.ts ?? 0) > BOOTSTRAP_CACHE_TTL_MS) return null;
    return {
      profile: parsed.profile,
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
    };
  } catch {
    return null;
  }
}

export function writeCachedBootstrap({ profile, posts }) {
  try {
    sessionStorage.setItem(
      BOOTSTRAP_CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        profile: profile ?? null,
        posts: posts ?? [],
      })
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearCachedBootstrap() {
  try {
    sessionStorage.removeItem(BOOTSTRAP_CACHE_KEY);
  } catch {
    /* ignore */
  }
}
