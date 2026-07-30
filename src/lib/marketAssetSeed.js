import { setCached } from './queryCache';

/** Keep ≤ poll interval so 15s ticks are not served from a 30s stale cache. */
const MARKET_ASSET_TTL_MS = 15_000;

/** Seed detail resolve from a list/search item so navigation paints without RPC. */
export function seedMarketAssetCache(item, keyHint = null) {
  if (!item) return;
  const keys = new Set();
  if (keyHint) keys.add(String(keyHint).trim());
  for (const k of [item.id, item.symbol, item.schemeCode, item.assetKey]) {
    const s = String(k ?? '').trim();
    if (s) keys.add(s);
  }
  for (const key of keys) {
    if (!key) continue;
    setCached('market-asset', key, item);
  }
}

export { MARKET_ASSET_TTL_MS };
