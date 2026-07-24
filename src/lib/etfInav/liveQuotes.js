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

/**
 * Prefer fresher Supabase LTP when available; always take NAV from NSE live payload.
 */
export async function fetchMergedLiveQuotes(symbols = []) {
  const nse = await fetchEtfLiveQuotes();
  const bySymbol = new Map(
    (nse.items || []).map((row) => [String(row.symbol).toUpperCase(), { ...row }]),
  );

  if (symbols.length) {
    try {
      const dbMap = await lookupMarketAssetsBatch(symbols);
      for (const symbol of symbols) {
        const key = String(symbol).toUpperCase();
        const db = dbMap.get(key) || dbMap.get(symbol);
        const live = bySymbol.get(key);
        if (!db && !live) continue;
        const price = db?.price ?? db?.ltp ?? live?.ltp ?? null;
        bySymbol.set(key, {
          symbol: key,
          name: live?.name || db?.name || key,
          ltp: price != null ? Number(price) : null,
          nav: live?.nav ?? null,
          changePct: db?.changePct ?? live?.changePct ?? null,
          previousClose: db?.previousClose ?? live?.previousClose ?? null,
          syncedAt: db?.syncedAt || nse.syncedAt,
          source: db?.price != null ? 'db+nse' : 'nse',
        });
      }
    } catch {
      // NSE-only is fine if Supabase lookup fails.
    }
  }

  return {
    syncedAt: nse.syncedAt,
    items: [...bySymbol.values()],
  };
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
    const ltp = live?.ltp ?? row.ltp ?? null;
    // Snapshot `inav` is AMC-scraped; prefer live NSE NAV so the column refreshes.
    const amcInav = row.amcInav ?? row.inav ?? null;
    const nav = live?.nav ?? row.nav ?? row.nseNav ?? null;
    const inav = nav ?? amcInav;
    const premium =
      ltp != null && inav != null && Number(inav) !== 0 ? Number(ltp) / Number(inav) : null;

    return {
      ...row,
      ltp,
      nav,
      amcInav,
      inav,
      changePct: live?.changePct ?? row.changePct ?? null,
      premium,
      premiumPct: premium == null ? null : (premium - 1) * 100,
      quoteSyncedAt: live?.syncedAt || null,
      quoteSource: live?.source || null,
    };
  });
}
