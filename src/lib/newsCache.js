const NEWS_CACHE_KEY = 'pe_social_news_v1';
const NEWS_CACHE_TTL_MS = 15 * 60 * 1000;

/** Stable key for the current news filter (and guest vs signed-in). */
export function newsFilterKey({
  guestMode = false,
  scope = 'global',
  customDim = 'company',
  tickers = [],
  types = [],
  industries = [],
} = {}) {
  const normList = (list) =>
    [...new Set((list ?? []).map((x) => String(x ?? '').trim()).filter(Boolean))]
      .map((x) => x.toUpperCase())
      .sort()
      .join(',');

  const auth = guestMode ? 'guest' : 'auth';
  if (scope === 'portfolio') {
    return `${auth}|portfolio|${normList(tickers)}`;
  }
  if (scope === 'custom') {
    if (customDim === 'company') return `${auth}|custom|company|${normList(tickers)}`;
    if (customDim === 'type') return `${auth}|custom|type|${normList(types)}`;
    if (customDim === 'industry') return `${auth}|custom|industry|${normList(industries)}`;
    return `${auth}|custom|${customDim}|`;
  }
  return `${auth}|global`;
}

function readRaw() {
  try {
    const raw = sessionStorage.getItem(NEWS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (Date.now() - Number(parsed.ts ?? 0) > NEWS_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @returns {{ filterKey: string, items: any[], filterUi: object } | null}
 */
export function readCachedNews(filterKey = null) {
  const parsed = readRaw();
  if (!parsed || !Array.isArray(parsed.items)) return null;
  if (filterKey != null && parsed.filterKey !== filterKey) return null;
  return {
    filterKey: parsed.filterKey ?? '',
    items: parsed.items,
    filterUi: parsed.filterUi && typeof parsed.filterUi === 'object' ? parsed.filterUi : null,
  };
}

/** Latest cached news bag regardless of filter (for PostDetail likes seed). */
export function readLatestCachedNewsPosts() {
  const parsed = readRaw();
  if (!parsed || !Array.isArray(parsed.items)) return null;
  return parsed.items;
}

export function writeCachedNews({ filterKey, items, filterUi = null }) {
  try {
    sessionStorage.setItem(
      NEWS_CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        filterKey: String(filterKey ?? ''),
        items: items ?? [],
        filterUi: filterUi ?? null,
      })
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearCachedNews() {
  try {
    sessionStorage.removeItem(NEWS_CACHE_KEY);
  } catch {
    /* ignore */
  }
}
