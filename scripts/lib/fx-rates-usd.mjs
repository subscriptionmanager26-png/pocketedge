import { fetchYahooQuoteSummary } from './yahoo-quote-summary.mjs';

/** Yahoo FX pairs: value = units of USD per 1 unit of currency (or inverted for JPY-style). */
const FX_SYMBOLS = {
  EUR: { symbol: 'EURUSD=X', invert: false },
  GBP: { symbol: 'GBPUSD=X', invert: false },
  CHF: { symbol: 'CHFUSD=X', invert: false },
  CAD: { symbol: 'CADUSD=X', invert: false },
  AUD: { symbol: 'AUDUSD=X', invert: false },
  HKD: { symbol: 'HKDUSD=X', invert: false },
  SGD: { symbol: 'SGDUSD=X', invert: false },
  SEK: { symbol: 'SEKUSD=X', invert: false },
  NOK: { symbol: 'NOKUSD=X', invert: false },
  DKK: { symbol: 'DKKUSD=X', invert: false },
  INR: { symbol: 'INRUSD=X', invert: false },
  CNH: { symbol: 'CNHUSD=X', invert: false },
  CNY: { symbol: 'CNYUSD=X', invert: false },
  JPY: { symbol: 'USDJPY=X', invert: true },
  MXN: { symbol: 'USDMXN=X', invert: true },
};

let cachedRates = null;
let cachedRatesAt = 0;
const RATES_TTL_MS = 60 * 60 * 1000;

export function normalizeCurrencyCode(currency) {
  const raw = String(currency || 'USD').trim();
  const upper = raw.toUpperCase();
  if (upper === 'GBX' || raw === 'GBp') return 'GBP';
  return upper;
}

/**
 * Convert a price in local currency to USD.
 * @param {number} amount
 * @param {string} currency
 * @param {Record<string, number>} rates — USD per 1 unit of currency
 */
export function convertToUsd(amount, currency, rates = {}) {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;

  const raw = String(currency || 'USD').trim();
  const upper = normalizeCurrencyCode(raw);
  if (upper === 'USD') return amount;

  let amountInMajor = amount;
  if (raw === 'GBp' || upper === 'GBX') {
    amountInMajor = amount / 100;
  }

  const rate = rates[upper];
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null;
  return amountInMajor * rate;
}

export async function fetchFxRatesToUsd({ force = false } = {}) {
  if (!force && cachedRates && Date.now() - cachedRatesAt < RATES_TTL_MS) {
    return cachedRates;
  }

  const rates = { USD: 1 };

  for (const [currency, config] of Object.entries(FX_SYMBOLS)) {
    try {
      const summary = await fetchYahooQuoteSummary(config.symbol, 'price');
      const price = summary?.price?.regularMarketPrice?.raw;
      if (!price || !Number.isFinite(price) || price <= 0) continue;
      rates[currency] = config.invert ? 1 / price : price;
    } catch {
      // optional pair
    }
  }

  cachedRates = rates;
  cachedRatesAt = Date.now();
  return rates;
}

export function resolveUsdPrice(row, rates = {}) {
  if (row?.price_usd != null) {
    const stored = Number(row.price_usd);
    if (Number.isFinite(stored) && stored > 0) return stored;
  }

  const price = Number(row?.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  return convertToUsd(price, row?.currency, rates);
}

export function attachUsdFields(row, rates = {}) {
  const priceUsd = resolveUsdPrice(row, rates);
  const currency = normalizeCurrencyCode(row?.currency || 'USD');
  const fxRate =
    currency === 'USD'
      ? 1
      : rates[currency] ?? (row?.price > 0 && priceUsd != null ? priceUsd / Number(row.price) : null);

  return {
    ...row,
    price_usd: priceUsd,
    fx_rate_to_usd: fxRate,
  };
}

export function attachUsdToPriceRows(rows, rates = {}) {
  return (rows || []).map((row) => attachUsdFields(row, rates));
}

export function fxRatesRowsForDb(rates, fetchedAt = new Date().toISOString()) {
  return Object.entries(rates)
    .filter(([currency, rate]) => currency && Number.isFinite(rate) && rate > 0)
    .map(([currency, rate_to_usd]) => ({
      currency,
      rate_to_usd,
      source: 'yahoo',
      fetched_at: fetchedAt,
    }));
}

export function ratesMapFromDbRows(rows) {
  const rates = { USD: 1 };
  for (const row of rows || []) {
    if (row.currency && row.rate_to_usd != null) {
      rates[row.currency] = Number(row.rate_to_usd);
    }
  }
  return rates;
}
