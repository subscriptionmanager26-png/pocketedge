import { createNseCookieSession, nseGet } from '../lib/nse-session.mjs';

const SEED_URL = 'https://www.nseindia.com/market-data/exchange-traded-funds-etf';

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function fetchNseEtfLiveQuotes() {
  const session = await createNseCookieSession(SEED_URL);
  const payload = await nseGet('/api/etf', session);
  const rows = Array.isArray(payload?.data) ? payload.data : [];

  const items = [];
  for (const row of rows) {
    const symbol = String(row?.symbol ?? '')
      .trim()
      .toUpperCase();
    const ltp = numberOrNull(row?.ltP);
    if (!symbol || ltp == null) continue;
    const chn = numberOrNull(row?.chn);
    items.push({
      symbol,
      name: String(row?.assets ?? symbol).trim() || symbol,
      ltp,
      nav: numberOrNull(row?.nav),
      previousClose: chn != null ? ltp - chn : null,
      changePct: numberOrNull(row?.per),
    });
  }

  return {
    syncedAt: new Date().toISOString(),
    source: 'nse',
    count: items.length,
    items,
  };
}
