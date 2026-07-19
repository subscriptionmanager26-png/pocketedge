import { isDevMockMode } from './appMode';
import { supabase, isSupabaseConfigured } from './supabase';
import { skipAuthForDev } from './sessionStore';
import { fetchFollowerIds } from './socialGraphApi';
import { fetchUserPortfolios } from './socialPortfolioApi';
import { getPerson } from '../data/mockData';

const CR = 1_00_00_000;

function useBackend() {
  return isSupabaseConfigured() && !skipAuthForDev();
}

/** Bucket label for influencing AUM (INR). */
export function formatInfluencingBucket(amountInr) {
  const n = Number(amountInr);
  if (!Number.isFinite(n) || n < CR) return '< 1 Cr';
  if (n < 10 * CR) return '1Cr+';
  if (n < 100 * CR) return '10Cr+';
  if (n < 1000 * CR) return '100Cr+';
  return '1000Cr+';
}

function portfolioSize(portfolio) {
  if (Number.isFinite(Number(portfolio?.totalValue))) return Number(portfolio.totalValue);
  return (portfolio?.holdings ?? []).reduce((sum, h) => sum + (Number(h?.value) || 0), 0);
}

async function sumFollowerPortfolioSizes(userId) {
  const followerIds = await fetchFollowerIds(userId);
  if (!followerIds.length) return 0;

  const sizes = await Promise.all(
    followerIds.map(async (followerId) => {
      try {
        const portfolios = await fetchUserPortfolios(followerId);
        return (portfolios ?? [])
          .filter((p) => !p.isDraft)
          .reduce((sum, p) => sum + portfolioSize(p), 0);
      } catch {
        return 0;
      }
    })
  );
  return sizes.reduce((a, b) => a + b, 0);
}

/** Total published portfolio value across this user's followers. */
export async function fetchInfluencingAmount(userId) {
  if (!userId) return 0;

  if (!useBackend() || isDevMockMode()) {
    const person = getPerson(userId);
    if (person?.assetsInfluenced != null) return Number(person.assetsInfluenced) || 0;
    return sumFollowerPortfolioSizes(userId);
  }

  const { data, error } = await supabase.rpc('get_influencing_amount', {
    p_user_id: userId,
  });

  if (!error && data != null) return Number(data) || 0;

  // Fallback if RPC not yet applied in this environment.
  return sumFollowerPortfolioSizes(userId);
}
