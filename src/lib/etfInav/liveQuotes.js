import { listEtfMarketQuotes } from '../marketDataApi';
import { isInNseSession } from '../marketRefreshPolicy';

const LIVE_URL = '/api/etf-live';
export const ETF_INAV_POLL_MS = 60_000;
/** If |LTP/AMC iNAV - 1| exceeds this, use NSE iNAV for display/premium. */
export const AMC_PREMIUM_FALLBACK_PCT = 30;

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
      nseNav: row.nav != null && Number(row.nav) > 0 ? Number(row.nav) : null,
      changePct: row.changePct ?? null,
      syncedAt: payload.syncedAt || null,
      source: 'nse-ltp',
    })),
  };
}

function positiveNum(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Live quotes: LTP + NSE nav + AMC iNAV from DB (snapshot fills AMC gaps).
 */
export async function fetchMergedLiveQuotes() {
  try {
    const db = await listEtfMarketQuotes();
    if (db.items?.length) {
      return {
        syncedAt: db.syncedAt,
        amcSyncedAt: db.amcSyncedAt,
        items: db.items.map((row) => ({
          symbol: row.symbol,
          ltp: row.ltp ?? row.price ?? null,
          nseNav: positiveNum(row.nav ?? row.nseNav),
          amcInav: positiveNum(row.amcInav),
          changePct: row.changePct ?? null,
          syncedAt: row.syncedAt || db.syncedAt,
          amcInavSyncedAt: row.amcInavSyncedAt || null,
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
    return { ...nse, amcSyncedAt: null, source: 'nse-ltp' };
  } catch {
    return { syncedAt: null, amcSyncedAt: null, items: [], source: 'none' };
  }
}

export function shouldPollEtfInav({ date = new Date(), visible = true } = {}) {
  if (!visible) return false;
  return isInNseSession(date);
}

/**
 * Prefer AMC iNAV; if |premium vs AMC| > 30% and NSE iNAV exists, use NSE.
 * Always keep both amcInav and nseNav on the row for analysis.
 */
export function resolveDisplayInav({ ltp, amcInav, nseNav }) {
  const amc = positiveNum(amcInav);
  const nse = positiveNum(nseNav);
  const ltpN = ltp == null ? null : Number(ltp);

  if (amc != null && ltpN != null && Number.isFinite(ltpN)) {
    const amcPremiumPct = (ltpN / amc - 1) * 100;
    if (Math.abs(amcPremiumPct) > AMC_PREMIUM_FALLBACK_PCT && nse != null) {
      return {
        inav: nse,
        inavSource: 'nse',
        amcPremiumPct,
        usedNseFallback: true,
      };
    }
    return {
      inav: amc,
      inavSource: 'amc',
      amcPremiumPct,
      usedNseFallback: false,
    };
  }

  if (amc != null) {
    return { inav: amc, inavSource: 'amc', amcPremiumPct: null, usedNseFallback: false };
  }
  if (nse != null) {
    return { inav: nse, inavSource: 'nse', amcPremiumPct: null, usedNseFallback: false };
  }
  return { inav: null, inavSource: null, amcPremiumPct: null, usedNseFallback: false };
}

export function mergeLiveIntoSnapshotItems(snapshotItems, liveItems) {
  const liveBySymbol = new Map(
    (liveItems || []).map((row) => [String(row.symbol).toUpperCase(), row]),
  );

  return (snapshotItems || []).map((row) => {
    const live = liveBySymbol.get(String(row.symbol).toUpperCase());
    const ltp = live?.ltp ?? null;
    const amcInav =
      positiveNum(live?.amcInav) ?? positiveNum(row.amcInav) ?? positiveNum(row.inav);
    const nseNav =
      positiveNum(live?.nseNav) ?? positiveNum(live?.nav) ?? positiveNum(row.nseNav);
    const resolved = resolveDisplayInav({ ltp, amcInav, nseNav });
    const premium =
      ltp != null && resolved.inav != null
        ? Number(ltp) / Number(resolved.inav)
        : null;

    return {
      ...row,
      ltp,
      amcInav,
      nseNav,
      nav: nseNav,
      inav: resolved.inav,
      inavSource: resolved.inavSource,
      usedNseFallback: resolved.usedNseFallback,
      amcPremiumPct: resolved.amcPremiumPct,
      changePct: live?.changePct ?? null,
      premium,
      premiumPct: premium == null ? null : (premium - 1) * 100,
      quoteSyncedAt: live?.syncedAt || null,
      amcInavSyncedAt: live?.amcInavSyncedAt || null,
      quoteSource: live?.source || null,
    };
  });
}

/** First paint from snapshot AMC iNAV; LTP/NSE fill after live quotes. */
export function catalogItemsWithoutQuotes(snapshotItems) {
  return (snapshotItems || []).map((row) => {
    const amcInav = positiveNum(row.amcInav) ?? positiveNum(row.inav);
    const nseNav = positiveNum(row.nseNav);
    return {
      ...row,
      ltp: null,
      amcInav,
      nseNav,
      nav: nseNav,
      inav: amcInav,
      inavSource: amcInav != null ? 'amc' : nseNav != null ? 'nse' : null,
      usedNseFallback: false,
      changePct: null,
      premium: null,
      premiumPct: null,
    };
  });
}
