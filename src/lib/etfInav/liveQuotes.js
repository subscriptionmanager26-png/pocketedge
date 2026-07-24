import { listEtfMarketQuotes } from '../marketDataApi';
import { isInNseSession } from '../marketRefreshPolicy';

const LIVE_URL = '/api/etf-live';
export const ETF_INAV_POLL_MS = 60_000;

async function fetchNseLtpOnly() {
  const res = await fetch(LIVE_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to load live ETF LTPs (${res.status})`);
  }
  const payload = await res.json();
  return {
    syncedAt: payload.syncedAt || null,
    items: (payload.items || []).map((row) => ({
      symbol: String(row.symbol).toUpperCase(),
      ltp: row.ltp ?? null,
      changePct: row.changePct ?? null,
      syncedAt: payload.syncedAt || null,
      source: 'nse-ltp',
    })),
  };
}

/**
 * Live LTP only (DB / NSE). AMC iNAV never comes from here — that stays on the snapshot scrape.
 */
export async function fetchMergedLiveQuotes() {
  try {
    const db = await listEtfMarketQuotes();
    if (db.items?.length) {
      return {
        syncedAt: db.syncedAt,
        items: db.items.map((row) => ({
          symbol: row.symbol,
          ltp: row.ltp ?? row.price ?? null,
          changePct: row.changePct ?? null,
          syncedAt: row.syncedAt || db.syncedAt,
          source: 'db',
        })),
        source: 'db',
      };
    }
  } catch (err) {
    console.warn('list_social_market_etf_quotes failed', err);
  }

  try {
    const nse = await fetchNseLtpOnly();
    return { ...nse, source: 'nse-ltp' };
  } catch {
    return { syncedAt: null, items: [], source: 'none' };
  }
}

export function shouldPollEtfInav({ date = new Date(), visible = true } = {}) {
  if (!visible) return false;
  return isInNseSession(date);
}

function amcInavFromRow(row) {
  const raw = row?.amcInav ?? row?.inav ?? null;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Premium = live LTP ÷ AMC iNAV scrape.
 * Never use NSE NAV for the iNAV column.
 */
export function mergeLiveIntoSnapshotItems(snapshotItems, liveItems) {
  const liveBySymbol = new Map(
    (liveItems || []).map((row) => [String(row.symbol).toUpperCase(), row]),
  );

  return (snapshotItems || []).map((row) => {
    const live = liveBySymbol.get(String(row.symbol).toUpperCase());
    const ltp = live?.ltp ?? null;
    const amcInav = amcInavFromRow(row);
    const premium =
      ltp != null && amcInav != null ? Number(ltp) / Number(amcInav) : null;

    return {
      ...row,
      ltp,
      amcInav,
      inav: amcInav,
      // Keep NSE nav off the displayed NAV field.
      nav: null,
      nseNav: row.nseNav ?? null,
      changePct: live?.changePct ?? null,
      premium,
      premiumPct: premium == null ? null : (premium - 1) * 100,
      quoteSyncedAt: live?.syncedAt || null,
      quoteSource: live?.source || null,
    };
  });
}

/** First paint: show AMC iNAV immediately; LTP fills in after DB quotes. */
export function catalogItemsWithoutQuotes(snapshotItems) {
  return (snapshotItems || []).map((row) => {
    const amcInav = amcInavFromRow(row);
    return {
      ...row,
      ltp: null,
      nav: null,
      amcInav,
      inav: amcInav,
      changePct: null,
      premium: null,
      premiumPct: null,
    };
  });
}
