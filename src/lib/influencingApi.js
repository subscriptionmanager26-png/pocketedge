import { isDevMockMode } from './appMode';
import { supabase, isSupabaseConfigured } from './supabase';
import { skipAuthForDev } from './sessionStore';
import { getPerson } from '../data/mockData';

function useBackend() {
  return isSupabaseConfigured() && !skipAuthForDev();
}

/** Bucket label for influencing AUM (INR). Used for mock / display fallbacks. */
export function formatInfluencingBucket(amountInr) {
  const n = Number(amountInr);
  const CR = 1_00_00_000;
  if (!Number.isFinite(n) || n < CR) return '< 1 Cr';
  if (n < 10 * CR) return '1Cr+';
  if (n < 100 * CR) return '10Cr+';
  if (n < 1000 * CR) return '100Cr+';
  return '1000Cr+';
}

/**
 * Influencing label for a profile. Exact follower AUM never leaves the server —
 * RPC returns a bucket string only.
 */
export async function fetchInfluencingAmount(userId) {
  if (!userId) return '< 1 Cr';

  if (!useBackend() || isDevMockMode()) {
    const person = getPerson(userId);
    if (person?.assetsInfluenced != null) {
      return formatInfluencingBucket(Number(person.assetsInfluenced) || 0);
    }
    return '< 1 Cr';
  }

  const { data, error } = await supabase.rpc('get_influencing_bucket', {
    p_user_id: userId,
  });

  if (!error && typeof data === 'string' && data.trim()) {
    return data.trim();
  }

  return '< 1 Cr';
}
