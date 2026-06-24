import { supabase } from '../supabase';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDbBasketId(basketId) {
  return Boolean(basketId && UUID_RE.test(basketId));
}

export async function fetchBasketNavHistory(basketId) {
  if (!supabase || !isDbBasketId(basketId)) return null;

  const { data, error } = await supabase.rpc('get_basket_nav_history', {
    p_basket_id: basketId,
  });

  if (error) throw error;
  if (!Array.isArray(data) || !data.length) return null;

  return data.map((row) => ({
    date: row.date,
    nav: Number(row.nav),
    periodReturn: Number(row.period_return ?? 0),
    fetchSlot: row.fetch_slot,
    fetchedAt: row.fetched_at,
  }));
}

export async function fetchBasketNavSummary(basketId) {
  if (!supabase || !isDbBasketId(basketId)) return null;

  const { data, error } = await supabase.rpc('get_basket_nav_summary', {
    p_basket_id: basketId,
  });

  if (error) throw error;
  if (!data) return null;

  return {
    basketId: data.basket_id,
    nav: Number(data.nav),
    inceptionNav: Number(data.inception_nav),
    totalReturnPct: Number(data.total_return_pct),
    isActivated: Boolean(data.is_activated),
    navStatus: data.nav_status ?? 'ok',
    missingConids: Array.isArray(data.missing_conids)
      ? data.missing_conids.map(Number)
      : [],
    errorAt: data.error_at,
    lastFetchAt: data.last_fetch_at,
    lastFetchSlot: data.last_fetch_slot,
    historyPoints: Number(data.history_points ?? 0),
  };
}

export async function fetchBasketConstituentWeights(basketId) {
  if (!supabase || !isDbBasketId(basketId)) return null;

  const { data, error } = await supabase.rpc('get_basket_constituent_weights', {
    p_basket_id: basketId,
  });

  if (error) throw error;
  if (!Array.isArray(data)) return null;

  return data.map((row) => ({
    conid: Number(row.conid),
    symbol: row.symbol,
    name: row.name,
    targetWeight: Number(row.target_weight),
    currentWeight: Number(row.current_weight),
  }));
}

/** Map missing conids to symbols using basket constituents. */
export function missingSymbols(missingConids, constituents) {
  const byConid = new Map(
    (constituents || []).map((c) => [Number(c.conid), c.symbol || String(c.conid)])
  );
  return (missingConids || []).map((id) => byConid.get(Number(id)) || `#${id}`);
}

export function returnPctFromNavHistory(navHistory) {
  if (!navHistory?.length || navHistory.length < 2) return null;
  const first = navHistory[0].nav;
  const last = navHistory[navHistory.length - 1].nav;
  if (!first || first <= 0) return null;
  return ((last / first) - 1) * 100;
}
