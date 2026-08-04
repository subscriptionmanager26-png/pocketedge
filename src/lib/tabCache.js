const TAB_CACHE_KEY = 'pe_tab_cache_v1';
/** Shorter TTL reduces portfolio data lingering on shared devices. */
const TAB_CACHE_TTL_MS = 5 * 60 * 1000;

function readRaw() {
  try {
    const raw = sessionStorage.getItem(TAB_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (Date.now() - Number(parsed.ts ?? 0) > TAB_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeRaw(next) {
  try {
    sessionStorage.setItem(
      TAB_CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        ...next,
      })
    );
  } catch {
    /* quota / private mode */
  }
}

function mergePatch(patch) {
  const current = readRaw() ?? { ts: Date.now() };
  writeRaw({ ...current, ...patch, ts: Date.now() });
}

export function invalidatePortfoliosTabCache(ownerId) {
  if (!ownerId) return;
  const raw = readRaw();
  if (!raw?.portfolios) return;
  const portfolios = { ...raw.portfolios };
  delete portfolios[String(ownerId)];
  mergePatch({ portfolios });
}

export function invalidateProfileGraphTabCache(userId) {
  if (!userId) return;
  const raw = readRaw();
  if (!raw?.profileGraph) return;
  const profileGraph = { ...raw.profileGraph };
  delete profileGraph[String(userId)];
  mergePatch({ profileGraph });
}

export function invalidateMarketPreviewTabCache(tab) {
  if (!tab) return;
  const raw = readRaw();
  if (!raw?.markets) return;
  const markets = { ...raw.markets };
  delete markets[String(tab)];
  mergePatch({ markets });
}

export function clearTabCache() {
  try {
    sessionStorage.removeItem(TAB_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function writePortfoliosCache(ownerId, portfolios) {
  if (!ownerId) return;
  const current = readRaw() ?? {};
  const portfoliosMap = { ...(current.portfolios ?? {}) };
  portfoliosMap[String(ownerId)] = portfolios;
  mergePatch({ portfolios: portfoliosMap });
}

export function peekPortfoliosCache(ownerId) {
  if (!ownerId) return null;
  const raw = readRaw();
  const rows = raw?.portfolios?.[String(ownerId)];
  return Array.isArray(rows) ? rows : null;
}

export function writeMarketPreviewCache(tab, payload) {
  if (!tab || !payload) return;
  const current = readRaw() ?? {};
  const markets = { ...(current.markets ?? {}) };
  markets[String(tab)] = { ...payload, _cachedAt: Date.now() };
  mergePatch({ markets });
}

/** @param {number|null} maxAgeMs null = ignore age (legacy); else miss when older. */
export function peekMarketPreviewCache(tab, maxAgeMs = null) {
  if (!tab) return null;
  const raw = readRaw();
  const entry = raw?.markets?.[String(tab)];
  if (!entry || typeof entry !== 'object') return null;
  if (maxAgeMs != null) {
    // Require per-entry _cachedAt — blob `ts` is refreshed by unrelated mergePatch
    // writes (portfolios, etc.) and would keep stale quotes "fresh" forever.
    const at = Number(entry._cachedAt ?? 0);
    if (!at || Date.now() - at > maxAgeMs) return null;
  }
  const { _cachedAt: _drop, ...payload } = entry;
  return payload;
}

export function writeProfileGraphCache(userId, payload) {
  if (!userId || !payload) return;
  const current = readRaw() ?? {};
  const profileGraph = { ...(current.profileGraph ?? {}) };
  profileGraph[String(userId)] = payload;
  mergePatch({ profileGraph });
}

export function peekProfileGraphCache(userId) {
  if (!userId) return null;
  const raw = readRaw();
  return raw?.profileGraph?.[String(userId)] ?? null;
}

export function writeInfluencingCache(userId, amount) {
  if (!userId) return;
  const current = readRaw() ?? {};
  const influencing = { ...(current.influencing ?? {}) };
  influencing[String(userId)] = amount;
  mergePatch({ influencing });
}

export function peekInfluencingCache(userId) {
  if (!userId) return null;
  const raw = readRaw();
  const value = raw?.influencing?.[String(userId)];
  return value ?? null;
}

/** Apply edge `/api/boot` payload into sessionStorage tab cache. */
export function applyBootPayloadToTabCache(boot) {
  if (!boot?.authenticated) return;

  const uid = boot.userId;
  if (uid && Array.isArray(boot.portfolios)) {
    writePortfoliosCache(uid, boot.portfolios);
  }

  if (boot.marketsPreview?.items) {
    // Boot returns raw RPC rows (snake_case). Markets UI peeks via
    // peekMarketPreview / fetchMarketPreview which normalize to camelCase.
    writeMarketPreviewCache('stocks', {
      items: boot.marketsPreview.items,
      syncedAt: boot.marketsPreview.synced_at ?? boot.marketsPreview.syncedAt ?? null,
      isPreview: true,
      source: 'rpc',
    });
  }

  if (uid && boot.followCounts) {
    writeProfileGraphCache(uid, {
      counts: boot.followCounts,
      following: boot.following ?? [],
      followers: boot.followers ?? [],
      source: 'boot',
    });
  }

  if (uid && boot.influencing != null) {
    writeInfluencingCache(uid, boot.influencing);
  }
}
