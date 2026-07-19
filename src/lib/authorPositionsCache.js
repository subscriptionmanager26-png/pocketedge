/** Pure in-memory cache for author holding disclosure (no API imports). */

/** @type {Map<string, { byKey: Map<string, object>, totalHeldValue: number }>} */
const cache = new Map();

function normalizeKey(value) {
  return String(value ?? '').trim();
}

export function setAuthorPositionIndex(userId, index) {
  if (!userId) return;
  cache.set(String(userId), index ?? { byKey: new Map(), totalHeldValue: 0 });
}

export function clearAuthorPositionIndex(userId) {
  if (!userId) return;
  cache.delete(String(userId));
}

export function hasAuthorPositionIndex(userId) {
  return Boolean(userId) && cache.has(String(userId));
}

function lookupEntry(index, ticker) {
  if (!index) return null;
  const key = normalizeKey(ticker);
  if (!key) return null;
  return index.byKey.get(key) ?? index.byKey.get(key.toUpperCase()) ?? null;
}

export function readCachedPosition(authorId, ticker) {
  if (!authorId) return null;
  const entry = lookupEntry(cache.get(String(authorId)), ticker);
  if (!entry) return null;
  // Never expose absolute qty / value / avg to social UI consumers.
  return {
    status: entry.status ?? 'none',
    pnlPct: entry.pnlPct ?? null,
  };
}

export function readCachedPortfolioWeightPct(authorId, ticker) {
  if (!authorId) return null;
  const index = cache.get(String(authorId));
  const entry = lookupEntry(index, ticker);
  if (!entry || entry.status !== 'holds') return null;
  if (!index?.totalHeldValue || entry.value == null) return null;
  return (entry.value / index.totalHeldValue) * 100;
}

export function rememberHoldingKeys(byKey, keys, entry) {
  for (const key of keys) {
    const raw = normalizeKey(key);
    if (!raw) continue;
    byKey.set(raw, entry);
    byKey.set(raw.toUpperCase(), entry);
  }
}
