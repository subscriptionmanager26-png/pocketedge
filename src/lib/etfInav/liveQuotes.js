import { lookupMarketAssetsBatch } from '../marketDataApi';
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

/** Primary path: LTP + NAV from social_market_assets. */
export async function fetchDbEtfQuotes(symbols = []) {
  const unique = [...new Set(symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean))];
  if (!unique.length) return { syncedAt: null, items: [], source: 'db' };

  const dbMap = await lookupMarketAssetsBatch(unique);
  let latest = null;
  const items = unique.map((symbol) => {
    const db = dbMap.get(symbol);
    const syncedAt = db?.syncedAt || null;
    if (syncedAt && (!latest || syncedAt > latest)) latest = syncedAt;
    return {
      symbol,
      name: db?.name || symbol,
      ltp: db?.price ?? db?.ltp ?? null,
      nav: db?.nav != null && Number(db.nav) > 0 ? Number(db.nav) : null,
      changePct: db?.changePct ?? null,
      previousClose: db?.previousClose ?? null,
      syncedAt,
      source: 'db',
    };
  });

  return { syncedAt: latest, items, source: 'db' };
}

/**
 * DB-first quotes. If many NAVs are still missing (pre-backfill), fill NAV from NSE once.
 */
export async function fetchMergedLiveQuotes(symbols = []) {
  const db = await fetchDbEtfQuotes(symbols);
  const bySymbol = new Map(db.items.map((row) => [row.symbol, { ...row }]));

  const missingNav = db.items.filter((row) => row.nav == null).length;
  const shouldFillFromNse = missingNav > Math.max(5, Math.floor(db.items.length * 0.25));

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
          nav: existing.nav ?? row.nav ?? null,
          changePct: existing.changePct ?? row.changePct ?? null,
          previousClose: existing.previousClose ?? row.previousClose ?? null,
          syncedAt: existing.syncedAt || nse.syncedAt,
          source: existing.ltp != null && existing.nav != null ? 'db' : 'db+nse',
        });
      }
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
      .at(-1) || db.syncedAt;

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
