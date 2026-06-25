/**
 * Yahoo quoteSummary fetch (topHoldings, fundProfile, quoteType) with crumb auth.
 */

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

let cachedAuth = null;
let cachedAuthAt = 0;
const AUTH_TTL_MS = 5 * 60 * 1000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getYahooAuth() {
  if (cachedAuth && Date.now() - cachedAuthAt < AUTH_TTL_MS) {
    return cachedAuth;
  }

  const cookieRes = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': UA },
    redirect: 'manual',
  });
  const setCookie = cookieRes.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map((c) => c.split(';')[0]).join('; ');

  const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookie },
  });
  const crumb = (await crumbRes.text()).replace(/"/g, '');

  cachedAuth = { cookie, crumb };
  cachedAuthAt = Date.now();
  return cachedAuth;
}

export async function fetchYahooQuoteSummary(
  symbol,
  modules = 'topHoldings,fundProfile,quoteType,summaryDetail,defaultKeyStatistics',
) {
  if (!symbol) return null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { cookie, crumb } = await getYahooAuth();
      const host = YAHOO_HOSTS[attempt % YAHOO_HOSTS.length];
      const url =
        `https://${host}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
        `?modules=${encodeURIComponent(modules)}&crumb=${encodeURIComponent(crumb)}`;

      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Cookie: cookie },
        signal: AbortSignal.timeout(20000),
      });

      if (res.status === 429) {
        await sleep(1500 * (attempt + 1));
        cachedAuth = null;
        continue;
      }
      if (!res.ok) return null;

      const data = await res.json();
      const row = data?.quoteSummary?.result?.[0];
      if (!row) return null;
      return row;
    } catch {
      await sleep(800 * (attempt + 1));
      cachedAuth = null;
    }
  }

  return null;
}

export function parseSectorWeightings(sectorWeightings = []) {
  const labelMap = {
    realestate: 'Real Estate',
    consumer_cyclical: 'Consumer Cyclical',
    basic_materials: 'Basic Materials',
    consumer_defensive: 'Consumer Defensive',
    technology: 'Technology',
    communication_services: 'Communication',
    financial_services: 'Financial Services',
    utilities: 'Utilities',
    industrials: 'Industrials',
    energy: 'Energy',
    healthcare: 'Healthcare',
  };

  return sectorWeightings
    .map((entry) => {
      const key = Object.keys(entry)[0];
      const raw = entry[key]?.raw;
      if (raw == null || raw <= 0) return null;
      return {
        key,
        label: labelMap[key] || key.replace(/_/g, ' '),
        weight: raw,
        weightPct: Math.round(raw * 1000) / 10,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.weight - a.weight);
}

export function parseTopHoldings(holdings = []) {
  return holdings.slice(0, 10).map((h) => ({
    symbol: h.symbol || null,
    name: h.holdingName || h.symbol || '—',
    weight: h.holdingPercent?.raw ?? null,
    weightPct: h.holdingPercent?.raw != null ? Math.round(h.holdingPercent.raw * 10000) / 100 : null,
    weightFmt: h.holdingPercent?.fmt || null,
  }));
}

export { inferTrackedIndex } from './ucits-tracked-index.mjs';
