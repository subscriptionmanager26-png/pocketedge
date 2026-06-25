import { fetchJustEtfAum } from './justetf-aum.mjs';
import { fetchYahooQuoteSummary } from './yahoo-quote-summary.mjs';
import {
  loadUcitsIsinIndex,
  lookupIsinForUcitsRow,
  yahooCandidatesForIsin,
} from './ucits-isin-index.mjs';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function parseYahooAum(summary) {
  const totalAssets =
    summary?.summaryDetail?.totalAssets || summary?.defaultKeyStatistics?.totalAssets;
  if (!totalAssets) return null;

  const raw = totalAssets.raw ?? null;
  const fmt = totalAssets.fmt || totalAssets.longFmt || null;
  if (raw == null && !fmt) return null;

  const aumCurrency = summary?.summaryDetail?.currency || null;

  return {
    aum: raw,
    aumFmt: fmt,
    aumCurrency,
    navPrice: summary?.summaryDetail?.navPrice?.fmt || null,
    navPriceRaw: summary?.summaryDetail?.navPrice?.raw ?? null,
  };
}

export function formatAumLabel(fund) {
  if (!fund?.aumFmt && fund?.aum == null) return '—';
  const amount = fund.aumFmt || String(fund.aum);
  if (!fund.aumCurrency) return amount;
  return `${amount} ${fund.aumCurrency}`;
}

export async function fetchYahooAum(yahooSymbol) {
  const summary = await fetchYahooQuoteSummary(yahooSymbol, 'summaryDetail,defaultKeyStatistics');
  const parsed = parseYahooAum(summary);
  if (!parsed) return null;
  return { ...parsed, aumSource: 'yahoo', aumSymbol: yahooSymbol };
}

export async function fetchJustEtfAumForRow(row, index, { delayMs = 150, isin = null } = {}) {
  const resolvedIsin = isin || lookupIsinForUcitsRow(row, index);
  if (!resolvedIsin) return null;
  return fetchJustEtfAum(resolvedIsin, { delayMs });
}

export async function fetchAumWithIsinFallback(row, primaryYahooSymbol, index, { delayMs = 100 } = {}) {
  const primary = await fetchYahooAum(primaryYahooSymbol);
  if (primary?.aum != null || primary?.aumFmt) {
    return primary;
  }
  const isinFallback = await fetchIsinAlternateAum(row, index, {
    exclude: [primaryYahooSymbol],
    delayMs,
    isin: lookupIsinForUcitsRow(row, index),
  });
  if (isinFallback?.aum != null || isinFallback?.aumFmt) {
    return isinFallback;
  }

  return fetchJustEtfAumForRow(row, index, {
    delayMs,
    isin: isinFallback?.isin || lookupIsinForUcitsRow(row, index),
  });
}

export async function fetchIsinAlternateAum(row, index, { exclude = [], delayMs = 100, isin = null } = {}) {
  const resolvedIsin = isin || lookupIsinForUcitsRow(row, index);
  if (!resolvedIsin) return null;

  const alternates = yahooCandidatesForIsin(resolvedIsin, index, { exclude });
  for (const candidate of alternates.slice(0, 8)) {
    if (delayMs > 0) await sleep(delayMs);
    const alt = await fetchYahooAum(candidate);
    if (alt?.aum != null || alt?.aumFmt) {
      return { ...alt, aumSource: 'yahoo_isin', aumSymbol: candidate, isin: resolvedIsin };
    }
  }

  return { isin: resolvedIsin, aum: null, aumFmt: null };
}

export function applyIsinPeerAumFallback(funds) {
  const byIsin = new Map();

  for (const fund of funds) {
    if (!fund.isin || fund.aum == null) continue;
    const existing = byIsin.get(fund.isin);
    if (!existing || fund.aum > existing.aum) {
      byIsin.set(fund.isin, fund);
    }
  }

  let filled = 0;
  for (const fund of funds) {
    if (fund.aum != null || !fund.isin) continue;
    const donor = byIsin.get(fund.isin);
    if (!donor) continue;
    fund.aum = donor.aum;
    fund.aumFmt = donor.aumFmt;
    fund.aumCurrency = donor.aumCurrency || null;
    fund.aumMillions = donor.aumMillions ?? null;
    fund.aumSource = 'isin_peer';
    fund.aumSymbol = donor.aumSymbol || donor.yahooSymbol;
    filled += 1;
  }

  return filled;
}

let cachedIndex = null;

export function getUcitsIsinIndex() {
  if (!cachedIndex) cachedIndex = loadUcitsIsinIndex();
  return cachedIndex;
}
