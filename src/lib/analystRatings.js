/**
 * TradingView analyst consensus view-model + fetch helpers.
 * Table: public.tradingview_analyst_consensus
 * Falls back to local mock rows when live data is missing.
 */

import { isSupabaseConfigured, ensureSupabase } from './supabase';
import { cachedFetch, getCached, setCached } from './queryCache';

const ANALYST_TTL_MS = 5 * 60_000;
const CACHE_NS = 'tv-analyst';

/**
 * Local mock rows (from TradingView India scanner dump) so Stock + Portfolio
 * show ratings in-app when the DB has no row for a ticker.
 */
export const MOCK_ANALYST_ROWS = {
  RELIANCE: {
    asset_key: 'RELIANCE',
    name: 'Reliance Industries Limited',
    last_price: 1310.7,
    currency: 'INR',
    target_price_avg: 1658.5,
    target_price_high: 1890,
    target_price_low: 1420,
    recommendation_buy: 22,
    recommendation_hold: 0,
    recommendation_sell: 0,
    analyst_count: 22,
    recommend_technical: 0.336,
    sync_status: 'ok',
    synced_at: '2026-08-09T12:00:00.000Z',
  },
  TCS: {
    asset_key: 'TCS',
    name: 'Tata Consultancy Services Limited',
    last_price: 2405.7,
    currency: 'INR',
    target_price_avg: 2430.395349,
    target_price_high: 2800,
    target_price_low: 2100,
    recommendation_buy: 23,
    recommendation_hold: 12,
    recommendation_sell: 4,
    analyst_count: 39,
    recommend_technical: 0.267,
    sync_status: 'ok',
    synced_at: '2026-08-09T12:00:00.000Z',
  },
  INFY: {
    asset_key: 'INFY',
    name: 'Infosys Limited',
    last_price: 1167.8,
    currency: 'INR',
    target_price_avg: 1191.719619,
    target_price_high: 1380,
    target_price_low: 980,
    recommendation_buy: 20,
    recommendation_hold: 21,
    recommendation_sell: 2,
    analyst_count: 43,
    recommend_technical: -0.048,
    sync_status: 'ok',
    synced_at: '2026-08-09T12:00:00.000Z',
  },
  HDFCBANK: {
    asset_key: 'HDFCBANK',
    name: 'HDFC Bank Limited',
    last_price: 735.6,
    currency: 'INR',
    target_price_avg: 1037.666667,
    target_price_high: 1180,
    target_price_low: 860,
    recommendation_buy: 34,
    recommendation_hold: 1,
    recommendation_sell: 0,
    analyst_count: 35,
    recommend_technical: -0.467,
    sync_status: 'ok',
    synced_at: '2026-08-09T12:00:00.000Z',
  },
  SBIN: {
    asset_key: 'SBIN',
    name: 'State Bank of India',
    last_price: 1058.4,
    currency: 'INR',
    target_price_avg: 1219.15,
    target_price_high: 1400,
    target_price_low: 1050,
    recommendation_buy: 27,
    recommendation_hold: 7,
    recommendation_sell: 0,
    analyst_count: 34,
    recommend_technical: 0.491,
    sync_status: 'ok',
    synced_at: '2026-08-09T12:00:00.000Z',
  },
  ICICIBANK: {
    asset_key: 'ICICIBANK',
    name: 'ICICI Bank Limited',
    last_price: 1200,
    currency: 'INR',
    target_price_avg: 1450,
    target_price_high: 1650,
    target_price_low: 1250,
    recommendation_buy: 28,
    recommendation_hold: 4,
    recommendation_sell: 1,
    analyst_count: 33,
    recommend_technical: 0.22,
    sync_status: 'ok',
    synced_at: '2026-08-09T12:00:00.000Z',
  },
  TATAMOTORS: {
    asset_key: 'TATAMOTORS',
    name: 'Tata Motors Limited',
    last_price: 720,
    currency: 'INR',
    target_price_avg: 850,
    target_price_high: 980,
    target_price_low: 700,
    recommendation_buy: 18,
    recommendation_hold: 8,
    recommendation_sell: 2,
    analyst_count: 28,
    recommend_technical: 0.15,
    sync_status: 'ok',
    synced_at: '2026-08-09T12:00:00.000Z',
  },
  ONGC: {
    asset_key: 'ONGC',
    name: 'Oil and Natural Gas Corporation Limited',
    last_price: 280,
    currency: 'INR',
    target_price_avg: 320,
    target_price_high: 380,
    target_price_low: 260,
    recommendation_buy: 15,
    recommendation_hold: 6,
    recommendation_sell: 2,
    analyst_count: 23,
    recommend_technical: 0.18,
    sync_status: 'ok',
    synced_at: '2026-08-09T12:00:00.000Z',
  },
};

function mockRowFor(key) {
  return MOCK_ANALYST_ROWS[String(key ?? '').trim().toUpperCase()] ?? null;
}

function mockViewModel(key, livePrice = null) {
  return applyLivePrice(mapAnalystConsensusRow(mockRowFor(key)), livePrice);
}

/** Consensus from buy/hold/sell counts (plan rules). */
export function deriveConsensusLabel(buy, hold, sell) {
  const b = Math.max(0, Number(buy) || 0);
  const h = Math.max(0, Number(hold) || 0);
  const s = Math.max(0, Number(sell) || 0);
  const n = b + h + s;
  if (n < 1) return 'Limited';
  if (b / n >= 0.6) return 'Buy';
  if (s / n >= 0.4) return 'Sell';
  return 'Hold';
}

export function technicalRatingLabel(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return null;
  if (n > 0.5) return 'Strong Buy';
  if (n > 0.1) return 'Buy';
  if (n > -0.1) return 'Neutral';
  if (n > -0.5) return 'Sell';
  return 'Strong Sell';
}

export function computeUpsidePct(targetAvg, livePrice) {
  const target = Number(targetAvg);
  const live = Number(livePrice);
  if (!Number.isFinite(target) || !Number.isFinite(live) || live <= 0) return null;
  return ((target - live) / live) * 100;
}

function pickPriceForUpside(livePrice, tvLast) {
  const live = Number(livePrice);
  const tv = Number(tvLast);
  const liveOk = Number.isFinite(live) && live > 0;
  const tvOk = Number.isFinite(tv) && tv > 0;
  if (liveOk && tvOk) {
    const ratio = live / tv;
    // Guard against holdings wiring bugs (e.g. BSE scrip codes leaking into price).
    if (ratio > 20 || ratio < 1 / 20) return tv;
    return live;
  }
  if (liveOk) return live;
  if (tvOk) return tv;
  return null;
}

/**
 * @param {object} row
 * @param {{ livePrice?: number|null }} [opts]
 */
export function mapAnalystConsensusRow(row, { livePrice = null } = {}) {
  if (!row || String(row.sync_status ?? row.syncStatus ?? '') !== 'ok') return null;

  const buy = Number(row.recommendation_buy ?? row.recommendationBuy ?? 0) || 0;
  const hold = Number(row.recommendation_hold ?? row.recommendationHold ?? 0) || 0;
  const sell = Number(row.recommendation_sell ?? row.recommendationSell ?? 0) || 0;
  const analystCount =
    Number(row.analyst_count ?? row.analystCount) || buy + hold + sell;
  const targetAvgRaw = Number(row.target_price_avg ?? row.targetPriceAvg);
  let targetHigh = Number(row.target_price_high ?? row.targetPriceHigh);
  let targetLow = Number(row.target_price_low ?? row.targetPriceLow);
  const targetAvg = Number.isFinite(targetAvgRaw) ? targetAvgRaw : null;
  // One analyst ⇒ one target; Min/Avg/Max are the same estimate.
  if (analystCount === 1 && targetAvg != null) {
    targetHigh = targetAvg;
    targetLow = targetAvg;
  }
  const tvLast = Number(row.last_price ?? row.lastPrice);
  const priceForUpside = pickPriceForUpside(livePrice, tvLast);
  const upsidePct = computeUpsidePct(targetAvg, priceForUpside);
  const tech = Number(row.recommend_technical ?? row.recommendTechnical);
  const label = deriveConsensusLabel(buy, hold, sell);

  return {
    assetKey: String(row.asset_key ?? row.assetKey ?? '')
      .trim()
      .toUpperCase(),
    name: row.name || null,
    currency: row.currency || 'INR',
    buy,
    hold,
    sell,
    analystCount,
    targetAvg,
    targetHigh: Number.isFinite(targetHigh) ? targetHigh : null,
    targetLow: Number.isFinite(targetLow) ? targetLow : null,
    lastPrice: Number.isFinite(tvLast) ? tvLast : null,
    livePrice: priceForUpside,
    upsidePct: upsidePct != null && Number.isFinite(upsidePct) ? upsidePct : null,
    consensusLabel: label,
    technicalScore: Number.isFinite(tech) ? tech : null,
    technicalLabel: technicalRatingLabel(tech),
    syncedAt: row.synced_at ?? row.syncedAt ?? null,
    chipLabel:
      label === 'Limited'
        ? null
        : upsidePct != null && Number.isFinite(upsidePct)
          ? `${label} · ${upsidePct >= 0 ? '+' : ''}${Math.round(upsidePct)}%`
          : label,
  };
}

function applyLivePrice(vm, livePrice) {
  if (!vm) return null;
  const live = pickPriceForUpside(livePrice, vm.lastPrice ?? vm.livePrice);
  const upsidePct = computeUpsidePct(vm.targetAvg, live);
  const label = vm.consensusLabel;
  return {
    ...vm,
    livePrice: live,
    upsidePct: upsidePct != null && Number.isFinite(upsidePct) ? upsidePct : null,
    chipLabel:
      label === 'Limited'
        ? null
        : upsidePct != null && Number.isFinite(upsidePct)
          ? `${label} · ${upsidePct >= 0 ? '+' : ''}${Math.round(upsidePct)}%`
          : label,
  };
}

export async function fetchAnalystConsensus(assetKey, { livePrice = null, force = false } = {}) {
  const key = String(assetKey ?? '')
    .trim()
    .toUpperCase();
  if (!key) return null;

  if (!isSupabaseConfigured()) {
    return mockViewModel(key, livePrice);
  }

  try {
    const row = await cachedFetch(CACHE_NS, key, force ? 0 : ANALYST_TTL_MS, async () => {
      const client = await ensureSupabase();
      const { data, error } = await client
        .from('tradingview_analyst_consensus')
        .select(
          'asset_key,name,last_price,currency,target_price_avg,target_price_high,target_price_low,recommendation_buy,recommendation_hold,recommendation_sell,analyst_count,recommend_technical,sync_status,synced_at'
        )
        .eq('asset_key', key)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    });
    const live = applyLivePrice(mapAnalystConsensusRow(row), livePrice);
    return live ?? mockViewModel(key, livePrice);
  } catch (err) {
    console.warn('fetchAnalystConsensus failed', key, err);
    return mockViewModel(key, livePrice);
  }
}

/**
 * Batch lookup by ticker keys. Returns Map<UPPER_KEY, viewModel>.
 * @param {string[]} keys
 * @param {{ livePriceByKey?: Record<string, number>, force?: boolean }} [opts]
 */
export async function fetchAnalystConsensusBatch(
  keys,
  { livePriceByKey = {}, force = false } = {}
) {
  const unique = [
    ...new Set(
      (keys ?? [])
        .map((k) => String(k ?? '').trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
  const out = new Map();
  if (!unique.length) return out;

  const fillMockGaps = () => {
    for (const key of unique) {
      if (out.has(key)) continue;
      const vm = mockViewModel(key, livePriceByKey[key] ?? null);
      if (vm) out.set(key, vm);
    }
  };

  if (!isSupabaseConfigured()) {
    fillMockGaps();
    return out;
  }

  const missing = [];
  for (const key of unique) {
    if (!force) {
      const hit = getCached(CACHE_NS, key, ANALYST_TTL_MS);
      if (hit !== undefined) {
        const vm = applyLivePrice(
          mapAnalystConsensusRow(hit),
          livePriceByKey[key] ?? null
        );
        if (vm) out.set(key, vm);
        continue;
      }
    }
    missing.push(key);
  }

  if (!missing.length) {
    fillMockGaps();
    return out;
  }

  try {
    const client = await ensureSupabase();
    const chunkSize = 80;
    for (let i = 0; i < missing.length; i += chunkSize) {
      const chunk = missing.slice(i, i + chunkSize);
      const { data, error } = await client
        .from('tradingview_analyst_consensus')
        .select(
          'asset_key,name,last_price,currency,target_price_avg,target_price_high,target_price_low,recommendation_buy,recommendation_hold,recommendation_sell,analyst_count,recommend_technical,sync_status,synced_at'
        )
        .in('asset_key', chunk);
      if (error) throw error;

      const found = new Set();
      for (const row of data ?? []) {
        const key = String(row.asset_key ?? '')
          .trim()
          .toUpperCase();
        setCached(CACHE_NS, key, row);
        found.add(key);
        const vm = applyLivePrice(
          mapAnalystConsensusRow(row),
          livePriceByKey[key] ?? null
        );
        if (vm) out.set(key, vm);
      }
      for (const key of chunk) {
        if (!found.has(key)) setCached(CACHE_NS, key, null);
      }
    }
  } catch (err) {
    console.warn('fetchAnalystConsensusBatch failed', err);
  }

  fillMockGaps();
  return out;
}
