import { fetchYahooQuoteSummary } from './yahoo-quote-summary.mjs';

const FX_SYMBOLS = {
  EUR: 'EURUSD=X',
  GBP: 'GBPUSD=X',
  CHF: 'CHFUSD=X',
  JPY: 'JPYUSD=X',
};

let cachedRates = null;
let cachedRatesAt = 0;
const RATES_TTL_MS = 60 * 60 * 1000;

export function formatAumValue(value) {
  if (value == null || !Number.isFinite(value)) return null;
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return String(Math.round(value));
}

export function convertAumToUsd(amount, currency, rates) {
  if (amount == null || !Number.isFinite(amount)) return null;

  const raw = String(currency || 'USD').trim();
  const upper = raw.toUpperCase();
  if (upper === 'USD') return amount;

  let amountInMajor = amount;
  let key = upper;
  if (raw === 'GBp' || upper === 'GBX') {
    amountInMajor = amount / 100;
    key = 'GBP';
  }

  const rate = rates?.[key];
  if (!rate) return null;
  return amountInMajor * rate;
}

export async function fetchFxRatesToUsd() {
  if (cachedRates && Date.now() - cachedRatesAt < RATES_TTL_MS) {
    return cachedRates;
  }

  const rates = { USD: 1 };
  for (const [currency, symbol] of Object.entries(FX_SYMBOLS)) {
    const summary = await fetchYahooQuoteSummary(symbol, 'price');
    const price = summary?.price?.regularMarketPrice?.raw;
    if (price) rates[currency] = price;
  }

  cachedRates = rates;
  cachedRatesAt = Date.now();
  return rates;
}

export function applyUsdAumFields(fund, rates) {
  if (fund.aum == null && !fund.aumFmt) return fund;

  const sourceCurrency = fund.aumCurrency || fund.currency || 'USD';
  const usdAum = convertAumToUsd(fund.aum, sourceCurrency, rates);
  if (usdAum == null) return fund;

  if (sourceCurrency !== 'USD' && fund.aumReported == null) {
    fund.aumReported = fund.aum;
    fund.aumReportedCurrency = sourceCurrency;
  }

  fund.aum = usdAum;
  fund.aumFmt = formatAumValue(usdAum);
  fund.aumCurrency = 'USD';
  if (fund.aumMillions != null && sourceCurrency !== 'USD') {
    const usdMillions = convertAumToUsd(fund.aumMillions * 1_000_000, sourceCurrency, rates);
    fund.aumMillions = usdMillions != null ? usdMillions / 1_000_000 : fund.aumMillions;
  }

  return fund;
}

export function applyUsdAumToFunds(funds, rates) {
  let converted = 0;
  for (const fund of funds) {
    const before = fund.aumCurrency;
    applyUsdAumFields(fund, rates);
    if (fund.aum != null && before && before !== 'USD') converted += 1;
  }
  return converted;
}
