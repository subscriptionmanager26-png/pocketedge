/**
 * Tiny TTL + inflight cache for hot portfolio / market reads.
 * Shared across PortfolioPage, Profile holdings, and market search.
 */

const stores = new Map();

function store(name) {
  if (!stores.has(name)) stores.set(name, new Map());
  return stores.get(name);
}

/** @returns {undefined|*} undefined = miss; otherwise the cached value (may be null). */
export function getCached(name, key, ttlMs = 30_000) {
  const entry = store(name).get(String(key));
  if (!entry) return undefined;
  if (Date.now() - entry.at > ttlMs) {
    store(name).delete(String(key));
    return undefined;
  }
  return entry.value;
}

export function setCached(name, key, value) {
  store(name).set(String(key), { at: Date.now(), value });
  return value;
}

export function invalidateCache(name, key = null) {
  if (key == null) {
    store(name).clear();
    return;
  }
  store(name).delete(String(key));
}

/** Deduplicate concurrent identical fetches. */
export function cachedFetch(name, key, ttlMs, loader) {
  const hit = getCached(name, key, ttlMs);
  if (hit !== undefined) return Promise.resolve(hit);

  const inflightKey = `${name}::inflight`;
  const inflight = store(inflightKey);
  const id = String(key);
  if (inflight.has(id)) return inflight.get(id);

  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      setCached(name, id, value);
      return value;
    })
    .finally(() => {
      inflight.delete(id);
    });

  inflight.set(id, promise);
  return promise;
}
