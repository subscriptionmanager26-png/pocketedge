import { isDevMockMode } from './appMode';
import { getStockHolders } from '../data/stockData';
import { getFundHolders } from '../data/fundData';
import { supabase, isSupabaseConfigured } from './supabase';
import { skipAuthForDev } from './sessionStore';
import { rememberPerson, resolvePeople } from './socialIdentity';

function useBackend() {
  return isSupabaseConfigured() && !skipAuthForDev();
}

/**
 * Users who disclose a holding of `assetKey` in a published live portfolio.
 * Falls back to demo seeds in mock mode.
 *
 * @returns {Promise<Array<{ userId: string }>>}
 */
export async function fetchAssetHolders(assetKey, { kind = 'stock' } = {}) {
  const key = String(assetKey ?? '').trim();
  if (!key) return [];

  if (!useBackend()) {
    if (isDevMockMode()) {
      const ids = kind === 'fund' ? getFundHolders(key) : getStockHolders(key);
      return (ids ?? []).map((userId) => ({ userId: String(userId) }));
    }
    return [];
  }

  const { data, error } = await supabase.rpc('list_social_asset_holders', {
    p_asset_key: key,
    p_limit: 50,
  });

  if (error) {
    console.error('fetchAssetHolders failed', error);
    return [];
  }

  const rows = Array.isArray(data) ? data : [];
  const holders = [];

  for (const row of rows) {
    const userId = row?.user_id ? String(row.user_id) : null;
    if (!userId) continue;

    if (row.username) {
      rememberPerson({
        id: userId,
        handle: row.username,
        name: row.display_name || row.username,
        avatarUrl: row.avatar_url ?? null,
      });
    }

    holders.push({ userId });
  }

  await resolvePeople(holders.map((h) => h.userId)).catch(() => {});
  return holders;
}
