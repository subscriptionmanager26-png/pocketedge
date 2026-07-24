import { listEtfMarketQuotes } from '../marketDataApi';
import { isInNseSession } from '../marketRefreshPolicy';

const LIVE_URL = '/api/etf-live';
export const ETF_INAV_POLL_MS = 60_000;

export async function fetchEtfLiveQuotes() {
  const res = await fetch(LIVE_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to load live ETF quotes (${res.status})`);
  }
  return res.json();
}

/**
 * Fast path: one RPC that returns all ETF LTP+NAV rows.
 * Falls back to NSE /api/etf-live only if many NAVs are still missing.
 */
export async function fetchMergedLiveQuotes(_symbols = []) {
  let dbItems = [];
  let dbSyncedAt = null;

  try {
    const db = await listEtfMarketQuotes();
    dbItems = db.items || [];
    dbSyncedAt = db.syncedAt || null;
  } catch (err) {
    console.warn('list_social_market_etf_quotes failed', err);
  }

  const bySymbol = new Map(dbItems.map((row) => [row.symbol, { ...row, source: 'db' }]));
  const missingNav = dbItems.filter((row) => row.nav == null).length;
  const shouldFillFromNse =
    dbItems.length === 0 || missingNav > Math.max(5, Math.floor(dbItems.length * 0.25));

  if (shouldFillFromNse) {
    try {
      const nse = await fetchEtfLiveQuotes();
      for (const row of nse.items || []) {
        const key = String(row.symbol).toUpperCase();
        const existing = bySymbol.get(key) || {
          symbol: key,
          name: row.name || key,
          ltp: null,
          nav: null,
          changePct: null,
          previousClose: null,
          syncedAt: null,
          source: 'nse',
        };
        bySymbol.set(key, {
          ...existing,
          name: existing.name || row.name || key,
          ltp: existing.ltp ?? row.ltp ?? null,
          nav: existing.nav ?? (row.nav != null && Number(row.nav) > 0 ? Number(row.nav) : null),
          changePct: existing.changePct ?? row.changePct ?? null,
          previousClose: existing.previousClose ?? row.previousClose ?? null,
          syncedAt: existing.syncedAt || nse.syncedAt,
          source: existing.ltp != null && existing.nav != null ? 'db' : 'db+nse',
        });
      }
      if (!dbSyncedAt) dbSyncedAt = nse.syncedAt || null;
    } catch {
      // DB-only is fine if NSE fill fails.
    }
  }

  const items = [...bySymbol.values()];
  const syncedAt =
    items
      .map((row) => row.syncedAt)
      .filter(Boolean)
      .sort()
      .at(-1) || dbSyncedAt;

  return { syncedAt, items, source: shouldFillFromNse ? 'db+nse' : 'db' };
}

export function shouldPollEtfInav({ date = new Date(), visible = true } = {}) {
  if (!visible) return false;
  return isInNseSession(date);
}

export function mergeLiveIntoSnapshotItems(snapshotItems, liveItems) {
  const liveBySymbol = new Map(
    (liveItems || []).map((row) => [String(row.symbol).toUpperCase(), row]),
  );

  return (snapshotItems || []).map((row) => {
    const live = liveBySymbol.get(String(row.symbol).toUpperCase());
    const ltp = live?.ltp ?? null;
    const amcInav = row.amcInav ?? row.inav ?? null;
    const nav = live?.nav ?? null;
    const inav = nav ?? amcInav;
    const premium =
      ltp != null && inav != null && Number(inav) !== 0 ? Number(ltp) / Number(inav) : null;

    return {
      ...row,
      // Never keep stale snapshot LTP/NAV once live merge runs.
      ltp,
      nav,
      amcInav,
      inav,
      changePct: live?.changePct ?? null,
      premium,
      premiumPct: premium == null ? null : (premium - 1) * 100,
      quoteSyncedAt: live?.syncedAt || null,
      quoteSource: live?.source || null,
    };
  });
}

/** Catalog-only rows for first paint before DB quotes arrive (no prices). */
export function catalogItemsWithoutQuotes(snapshotItems) {
  return (snapshotItems || []).map((row) => ({
    ...row,
    ltp: null,
    nav: null,
    amcInav: row.amcInav ?? row.inav ?? null,
    inav: null,
    changePct: null,
    premium: null,
    premiumPct: null,
  }));
}
