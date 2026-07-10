import { SOURCES, UA } from './constants.js';

export async function createNseSession(seedUrl = 'https://www.nseindia.com/') {
  const res = await fetch(seedUrl, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    redirect: 'follow',
  });
  const cookie = (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(';')[0])
    .join('; ');

  return async function nseFetch(path, options = {}) {
    const response = await fetch(`https://www.nseindia.com${path}`, {
      ...options,
      headers: {
        'User-Agent': UA,
        Accept: '*/*',
        Referer: seedUrl,
        Cookie: cookie,
        ...(options.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`NSE ${path} failed: ${response.status}`);
    }
    return response.json();
  };
}

function mapPreOpenRow(row) {
  const meta = row?.metadata ?? row;
  if (!meta?.symbol) return null;
  return {
    symbol: meta.symbol,
    series: meta.series ?? null,
    ltp: meta.lastPrice != null ? Number(meta.lastPrice) : null,
    previousClose: meta.previousClose != null ? Number(meta.previousClose) : null,
    changePct: meta.pChange != null ? Number(meta.pChange) : null,
  };
}

export async function fetchEquityQuotes(nseFetch) {
  const [main, sme] = await Promise.all([
    nseFetch('/api/market-data-pre-open?key=ALL', {
      headers: { Referer: 'https://www.nseindia.com/market-data/live-equity-market' },
    }),
    nseFetch('/api/market-data-pre-open?key=SME', {
      headers: { Referer: 'https://www.nseindia.com/market-data/sme-market' },
    }),
  ]);

  const quotes = new Map();
  for (const row of [...(main?.data ?? []), ...(sme?.data ?? [])]) {
    const mapped = mapPreOpenRow(row);
    if (mapped) quotes.set(mapped.symbol, mapped);
  }
  return quotes;
}

/**
 * Live equity ticks: wss://streamer.nseindia.com/streams/indices/high/EQUITY-SME-MARKET
 * Bulk traded snapshot: /api/live-analysis-stocksTraded (stocks-traded page).
 */

export async function fetchEtfList(nseFetch) {
  const payload = await nseFetch('/api/etf', {
    headers: { Referer: 'https://www.nseindia.com/market-data/exchange-traded-funds-etf' },
  });

  return (payload?.data ?? []).map((row) => ({
    symbol: row.symbol,
    name: row.assets || row.symbol,
    ltp: row.ltP != null ? Number(row.ltP) : null,
    previousClose:
      row.ltP != null && row.chn != null ? Number(row.ltP) - Number(row.chn) : null,
    changePct: row.per != null ? Number(row.per) : null,
    nav: row.nav != null ? Number(row.nav) : null,
    tradedValue: row.trdVal != null ? Number(row.trdVal) : null,
  }));
}

/**
 * Snapshot indices via REST. Live ticks use NSE WebSocket:
 * wss://streamer.nseindia.com/streams/indices/high/{segment}
 * Segments: drdMkt, brdMkt, fixMkt, secMkt, strMkt, thmMkt (map from row.key).
 */
export async function fetchIndices(nseFetch) {
  const payload = await nseFetch('/api/allIndices', {
    headers: { Referer: SOURCES.nseLiveIndices },
  });

  return (payload?.data ?? []).map((row) => ({
    id: row.indexSymbol || row.index,
    symbol: row.indexSymbol || row.index,
    name: row.index || row.indexSymbol,
    group: row.key ?? null,
    value: row.last != null ? Number(row.last) : null,
    change: row.variation != null ? Number(row.variation) : null,
    previousClose: row.previousClose != null ? Number(row.previousClose) : null,
    changePct: row.percentChange != null ? Number(row.percentChange) : null,
    open: row.open != null ? Number(row.open) : null,
    high: row.high != null ? Number(row.high) : null,
    low: row.low != null ? Number(row.low) : null,
    advances: row.advances != null ? Number(row.advances) : null,
    declines: row.declines != null ? Number(row.declines) : null,
    yearHigh: row.yearHigh != null ? Number(row.yearHigh) : null,
    yearLow: row.yearLow != null ? Number(row.yearLow) : null,
    change30dPct: row.perChange30d != null ? Number(row.perChange30d) : null,
    change365dPct: row.perChange365d != null ? Number(row.perChange365d) : null,
  }));
}
