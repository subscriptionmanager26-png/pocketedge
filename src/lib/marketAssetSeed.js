import { setCached } from './queryCache';

const MARKET_ASSET_TTL_MS = 30_000;

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
