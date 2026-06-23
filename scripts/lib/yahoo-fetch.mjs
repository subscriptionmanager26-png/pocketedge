/**
 * Yahoo / FINRA fetch with Canada multi-board and OTC symbol-first resolution.
 */

import {
  alignPricesForCompare,
  canadaSymbolCandidates,
  CANADA_IBKR_EXCHANGES,
  isPlausibleYahooBackup,
  normalizeOtcSymbol,
  OTC_IBKR_EXCHANGES,
  otcSymbolCandidates,
  rankCanadaCandidates,
  resolveYahooSymbol,
} from './yahoo-venue.mjs';

const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

let yahooHostIndex = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function absPctDiff(ibkr, ibkrCurrency, yahoo, yahooCurrency) {
  const { ibkr: alignedIbkr, yahoo: alignedYahoo } = alignPricesForCompare(
    ibkr,
    ibkrCurrency,
    yahoo,
    yahooCurrency,
  );
  if (alignedIbkr == null || alignedYahoo == null || alignedIbkr <= 0) return null;
  return Math.abs((alignedYahoo - alignedIbkr) / alignedIbkr) * 100;
}

function quoteConfidence(ibkrPrice, currency, yahooPrice, yahooCurrency) {
  if (ibkrPrice == null) return 'low';
  if (!isPlausibleYahooBackup(ibkrPrice, currency, yahooPrice, yahooCurrency)) return null;
  const abs = absPctDiff(ibkrPrice, currency, yahooPrice, yahooCurrency);
  if (abs == null) return null;
  if (abs <= 10) return 'high';
  if (abs <= 20) return 'low';
  return null;
}

export async function fetchYahooChart(symbol) {
  if (!symbol) return null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const host = YAHOO_HOSTS[yahooHostIndex % YAHOO_HOSTS.length];
    yahooHostIndex += 1;
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d&includePrePost=true`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!res.ok) return null;

      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result) return null;

      const closes = result.indicators?.quote?.[0]?.close?.filter((v) => v != null) ?? [];
      const price = closes.at(-1) ?? result.meta?.regularMarketPrice;
      if (price == null || price <= 0) return null;

      return {
        yahoo_symbol: symbol,
        price: Number(price),
        currency: result.meta?.currency ?? null,
        exchange: result.meta?.exchangeName ?? null,
        source: 'yahoo',
      };
    } catch {
      await sleep(1000 * (attempt + 1));
    }
  }

  return null;
}

export async function fetchFinraOtcPrice(symbol) {
  const ticker = normalizeOtcSymbol(symbol);
  if (!ticker) return null;

  try {
    const url =
      `https://api.finra.org/data/group/otcMarket/name/otcSecurities?limit=1` +
      `&fields=issueSymbolIdentifier,lastSalePrice,updatedDateTime` +
      `&issueSymbolIdentifier=${encodeURIComponent(ticker)}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const row = Array.isArray(data) ? data[0] : data?.results?.[0] ?? data?.[0];
    const price = row?.lastSalePrice != null ? Number(row.lastSalePrice) : null;
    if (price == null || price <= 0) return null;

    return {
      yahoo_symbol: ticker,
      price,
      currency: 'USD',
      exchange: 'OTC',
      source: 'finra',
    };
  } catch {
    return null;
  }
}

async function pickBestCandidate(candidates, currency, ibkrReferencePrice = null) {
  let best = null;

  for (const symbol of candidates) {
    const hit = await fetchYahooChart(symbol);
    if (!hit?.price) continue;

    const confidence = quoteConfidence(ibkrReferencePrice, currency, hit.price, hit.currency);
    const absPct =
      ibkrReferencePrice != null
        ? absPctDiff(ibkrReferencePrice, currency, hit.price, hit.currency)
        : null;

    if (ibkrReferencePrice != null && confidence == null) continue;

    const row = { ...hit, quote_confidence: confidence ?? 'low', abs_pct_diff: absPct };
    if (
      best == null ||
      (absPct != null &&
        best.abs_pct_diff != null &&
        absPct < best.abs_pct_diff) ||
      (absPct == null && best.abs_pct_diff == null && !best.price)
    ) {
      best = row;
    }

    await sleep(80);
  }

  return best;
}

/**
 * Resolve and fetch the best Yahoo/FINRA quote for an instrument.
 * When ibkrReferencePrice is set (benchmark/remediation), picks closest plausible match.
 */
export async function fetchBestYahooQuote(instrument, mappingRow = null, ibkrReferencePrice = null) {
  const inst = {
    exchange_id: instrument?.exchange_id ?? mappingRow?.exchange_id,
    symbol: instrument?.symbol ?? mappingRow?.symbol,
    currency: instrument?.currency ?? mappingRow?.currency,
    isin: instrument?.isin ?? mappingRow?.isin,
    instrument_type: instrument?.instrument_type ?? mappingRow?.instrument_type,
  };

  if (!inst.symbol) return null;

  if (OTC_IBKR_EXCHANGES.has(inst.exchange_id)) {
    const candidates = otcSymbolCandidates(inst.symbol, mappingRow?.yahoo_symbol);
    const best = await pickBestCandidate(candidates, inst.currency, ibkrReferencePrice);

    if (best?.price && (ibkrReferencePrice == null || best.quote_confidence)) {
      return best;
    }

    const finra = await fetchFinraOtcPrice(inst.symbol);
    if (!finra?.price) return best;

    const finraConfidence = quoteConfidence(
      ibkrReferencePrice,
      inst.currency,
      finra.price,
      finra.currency,
    );
    if (ibkrReferencePrice != null && !finraConfidence) return best;

    return {
      ...finra,
      quote_confidence: finraConfidence ?? 'low',
      abs_pct_diff:
        ibkrReferencePrice != null
          ? absPctDiff(ibkrReferencePrice, inst.currency, finra.price, finra.currency)
          : null,
    };
  }

  if (CANADA_IBKR_EXCHANGES.has(inst.exchange_id)) {
    const mapped = mappingRow?.yahoo_symbol ?? null;
    const candidates =
      ibkrReferencePrice != null
        ? canadaSymbolCandidates(inst.symbol, mapped)
        : rankCanadaCandidates(inst.symbol);
    return pickBestCandidate(candidates.slice(0, 6), inst.currency, ibkrReferencePrice);
  }

  const symbol = await resolveYahooSymbol(inst, mappingRow ?? { yahoo_symbol: null });
  if (!symbol) return null;

  const hit = await fetchYahooChart(symbol);
  if (!hit?.price) return null;

  const confidence = quoteConfidence(
    ibkrReferencePrice,
    inst.currency,
    hit.price,
    hit.currency,
  );
  if (ibkrReferencePrice != null && !confidence) return null;

  return {
    ...hit,
    quote_confidence: confidence ?? 'low',
    abs_pct_diff:
      ibkrReferencePrice != null
        ? absPctDiff(ibkrReferencePrice, inst.currency, hit.price, hit.currency)
        : null,
  };
}
