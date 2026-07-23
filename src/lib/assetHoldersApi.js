import { isDevMockMode } from './appMode';
import { getStockHolders } from '../data/stockData';
import { getFundHolders } from '../data/fundData';
import { supabase, isSupabaseConfigured } from './supabase';
import { skipAuthForDev } from './sessionStore';
import { rememberPerson, resolvePeople } from './socialIdentity';

function useBackend() {
  return isSupabaseConfigured() && !skipAuthForDev();
}

/** First token of display name (e.g. "HDFC Mutual Fund" → "HDFC"). */
export function holderFirstName(displayName, fallback = 'Member') {
  const raw = String(displayName ?? '').trim();
  if (!raw) return fallback;
  return raw.split(/\s+/)[0] || fallback;
}

/**
 * Users who disclose a holding of `assetKey` in a published portfolio/watchlist.
 * Each row points at the portfolio where the asset has the highest weight.
 *
 * @returns {Promise<Array<{
 *   userId: string,
 *   displayName: string|null,
 *   firstName: string,
 *   portfolioId: string|null,
 *   portfolioName: string|null,
 *   extraPortfolios: number,
 *   weightPct: number|null,
 * }>>}
 */
export async function fetchAssetHolders(assetKey, { kind = 'stock' } = {}) {
  const key = String(assetKey ?? '').trim();
  if (!key) return [];

  if (!useBackend()) {
    if (isDevMockMode()) {
      const ids = kind === 'fund' ? getFundHolders(key) : getStockHolders(key);
      return (ids ?? []).map((userId) => ({
        userId: String(userId),
        displayName: null,
        firstName: 'Member',
        portfolioId: null,
        portfolioName: null,
        extraPortfolios: 0,
        weightPct: null,
      }));
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

    const displayName = row.display_name || row.username || null;
    if (row.username) {
      rememberPerson({
        id: userId,
        handle: row.username,
        name: displayName || row.username,
        avatarUrl: row.avatar_url ?? null,
      });
    }

    const extra = Number(row.extra_portfolios);
    const weight = row.weight_pct == null ? null : Number(row.weight_pct);

    holders.push({
      userId,
      displayName,
      firstName: holderFirstName(displayName),
      avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
      portfolioId: row.portfolio_id ? String(row.portfolio_id) : null,
      portfolioName: row.portfolio_name ? String(row.portfolio_name) : null,
      extraPortfolios: Number.isFinite(extra) && extra > 0 ? Math.floor(extra) : 0,
      weightPct: Number.isFinite(weight) ? weight : null,
    });
  }

  await resolvePeople(holders.map((h) => h.userId)).catch(() => {});
  return holders;
}
