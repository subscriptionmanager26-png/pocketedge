import { supabase, isSupabaseConfigured } from './supabase';
import { skipAuthForDev } from './sessionStore';

function useBackend() {
  return isSupabaseConfigured() && !skipAuthForDev();
}

function mapIdeaCardRow(row) {
  if (!row?.portfolio_id || !row?.owner_id) return null;
  const dayReturn = Number(row.day_return_pct);
  return {
    portfolio: {
      id: row.portfolio_id,
      name: row.name ?? '',
      thesis: row.thesis ?? '',
      dayReturnPct: Number.isFinite(dayReturn) ? dayReturn : null,
      updatedAt: row.updated_at ?? null,
    },
    owner: {
      id: row.owner_id,
      name: row.owner_name ?? 'Investor',
      handle: '',
    },
    dayReturn: Number.isFinite(dayReturn) ? dayReturn : null,
  };
}

/**
 * Public Ideas feed — name, thesis, maker, 1D only.
 * Works for anon and authenticated.
 */
export async function fetchPublicIdeaCards({ limit = 40, offset = 0 } = {}) {
  if (!useBackend()) return [];

  const { data, error } = await supabase.rpc('list_public_idea_cards', {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;

  const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return rows.map(mapIdeaCardRow).filter(Boolean);
}
