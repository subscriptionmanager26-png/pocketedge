/**
 * IBKR exchange → Yahoo venue alignment for ISIN mapping and fallback pricing.
 * Fixes Type B (German → US), Type C (MEXI → US), Type D (TASE → US).
 */

import { resolveXetraYahooSymbol } from './xetra-isin.mjs';

export const US_YAHOO_EXCHANGES = new Set([
  'NYQ',
  'NMS',
  'NCM',
  'NGM',
  'PCX',
  'BTS',
  'ASE',
  'PNK',
  'OQX',
  'NAS',
  'NYSE',
  'AMEX',
  'OPR',
]);

/** IBKR exchanges where Yahoo ISIN search often returns the wrong (US) listing. */
export const VENUE_SENSITIVE_EXCHANGES = new Set([
  'FWB',
  'SWB',
  'GETTEX',
  'TGATE',
  'BATEDE',
  'IBIS',
  'GETTEX2',
  'BER',
  'DUS',
  'HAM',
  'HAN',
  'MUN',
  'MEXI',
  'TASE',
]);

/** German IBKR venues — use Xetra ISIN→mnemonic table when available. */
export const GERMAN_IBKR_EXCHANGES = new Set([
  'FWB',
  'SWB',
  'GETTEX',
  'TGATE',
  'BATEDE',
  'IBIS',
  'GETTEX2',
  'BER',
  'DUS',
  'HAM',
  'HAN',
  'MUN',
]);

export const YAHOO_SUFFIX = {
  LSE: '.L',
  LSEETF: '.L',
  TRWBUK: '.L',
  TRWBUKETF: '.L',
  CHIXUK: '.L',
  BATEUK: '.L',
  AQXEUK: '.L',
  TRQXUK: '.L',
  TRWBCH: '.SW',
  TRWBIT: '.MI',
  CHIXCH: '.SW',
  BATECH: '.SW',
  IBIS: '.DE',
  FWB: '.DE',
  SWB: '.DE',
  GETTEX: '.DE',
  TGATE: '.DE',
  BATEDE: '.DE',
  AEB: '.AS',
  BVME: '.MI',
  'BVME.ETF': '.MI',
  SBF: '.PA',
  EBS: '.SW',
  SEHK: '.HK',
  SEHKSZSE: '.SZ',
  SEHKSTAR: '.SS',
  SEHKNTL: '.SS',
  CHINEXT: '.SZ',
  TSEJ: '.T',
  TSE: '.T',
  JPNNEXT: '.T',
  KRX: '.KS',
  NSE: '.NS',
  BSE: '.BO',
  TWSE: '.TW',
  TPEX: '.TWO',
  ASX: '.AX',
  ASXCEN: '.AX',
  CHIXAU: '.AX',
  SGX: '.SI',
  BURSAMY: '.KL',
  MEXI: '.MX',
  TASE: '.TA',
  B3: '.SA',
  CHIXDE: '.DE',
  DXEDE: '.DE',
  TRWBDE: '.DE',
  AQEUDE: '.DE',
  TRWBEN: '.AS',
  AQEUEN: '.AS',
  DXEEN: '.AS',
  TGATE: '.DE',
  NASDAQ: '',
  NYSE: '',
  ARCA: '',
  AMEX: '',
  ISLAND: '',
  BEX: '',
  EDGEA: '',
  DRCTEDGE: '',
  ARCAEDGE: '',
  IEX: '',
  OTCLNKECN: '',
  AEQLIT: '.TO',
  SFB: '.ST',
  CPH: '.CO',
  HEL: '.HE',
  OSL: '.OL',
  WSE: '.WA',
};

/** Yahoo `exchange` codes that match each IBKR venue. */
export const PREFERRED_YAHOO_EXCHANGES = {
  IBIS: ['GER', 'FRA'],
  FWB: ['GER', 'FRA', 'STU', 'MUN', 'BER', 'DUS', 'HAM', 'HAN'],
  SWB: ['GER', 'FRA', 'STU', 'MUN', 'BER', 'DUS', 'HAM', 'HAN'],
  GETTEX: ['GER', 'FRA', 'STU', 'MUN', 'BER', 'DUS', 'HAM', 'HAN'],
  TGATE: ['GER', 'FRA', 'STU', 'MUN', 'BER', 'DUS'],
  BATEDE: ['GER', 'FRA', 'STU', 'MUN'],
  GETTEX2: ['GER', 'FRA', 'STU', 'MUN'],
  BER: ['BER', 'GER', 'FRA'],
  DUS: ['DUS', 'GER', 'FRA'],
  HAM: ['HAM', 'GER', 'FRA'],
  HAN: ['HAN', 'GER', 'FRA'],
  MUN: ['MUN', 'STU', 'GER', 'FRA'],
  MEXI: ['MEX'],
  TASE: ['TLV'],
};

const CURRENCY_ALIASES = {
  CNH: 'CNY',
  CNY: 'CNY',
  ILA: 'ILS',
  GBX: 'GBP',
  GBp: 'GBP',
  ZAC: 'ZAR',
};

/** US IBKR venues where ISIN search often returns the wrong country listing. */
export const US_IBKR_EXCHANGES = new Set([
  'NASDAQ',
  'NYSE',
  'ARCA',
  'AMEX',
  'ISLAND',
  'BEX',
  'EDGEA',
  'DRCTEDGE',
  'ARCAEDGE',
  'IEX',
  'OTCLNKECN',
  'LTSE',
  'MEMX',
  'NYSENAT',
]);

const CANADIAN_YAHOO_SUFFIX = /\.(TO|V|CN|NE)$/i;

const EUROPEAN_YAHOO_SUFFIX =
  /\.(DE|F|SG|SW|PA|MI|AS|BR|MC|HA|DU|MU|LS)$/i;

const ISIN_DOT_VENUE = /^IE[A-Z0-9]{10}\.[A-Z]+$/i;

const UK_LSE_EXCHANGES = new Set([
  'LSE',
  'LSEETF',
  'TRWBUK',
  'TRWBUKETF',
  'CHIXUK',
  'BATEUK',
  'AQXEUK',
  'TRQXUK',
]);

const CH_SW_EXCHANGES = new Set(['EBS', 'TRWBCH', 'CHIXCH', 'BATECH', 'SIX']);

const JP_T_EXCHANGES = new Set(['TSEJ', 'TSE', 'JPNNEXT']);

/** EU venues where Leverage Shares ETFs list on LSE (.L) not local suffix. */
const EU_LEVERAGE_ETF_EXCHANGES = new Set(['AEB', 'BVME', 'BVME.ETF', 'TRWBIT', 'TRWBEN']);

export const CANADA_IBKR_EXCHANGES = new Set(['AEQLIT']);

export const OTC_IBKR_EXCHANGES = new Set(['OTCLNKECN']);

const CANADA_YAHOO_SUFFIXES = ['.TO', '.V', '.CN', '.NE'];

export function normalizeListingSymbol(symbol) {
  return String(symbol ?? '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/\./g, '-');
}

export function normalizeOtcSymbol(symbol) {
  return String(symbol ?? '')
    .trim()
    .split('.')[0]
    .replace(/\s+/g, '-')
    .replace(/\./g, '-')
    .toUpperCase();
}

/** Canadian multi-board Yahoo tickers (.TO / .V / .CN / .NE). */
export function canadaSymbolVariants(symbol) {
  const variants = new Set();
  const raw = String(symbol ?? '').trim();
  if (!raw) return [];

  const base = raw.split('.')[0];
  const normalized = normalizeListingSymbol(raw);

  variants.add(`${normalized}.TO`);
  variants.add(`${base}.TO`);
  variants.add(`${base}.V`);
  variants.add(`${normalized}.CN`);
  variants.add(`${base}.CN`);
  variants.add(`${base}.NE`);

  if (raw.includes('.')) {
    const parts = raw.split('.');
    variants.add(`${parts[0]}-${parts[1]}.TO`);
    variants.add(`${parts[0]}.${parts[1]}.TO`);
    if (parts.length >= 3 && parts[1] === 'PR') {
      variants.add(`${parts[0]}-PR-${parts[2]}.TO`);
      variants.add(`${parts[0]}-PR-${parts[2]}.V`);
    }
  }

  if (raw.endsWith('.H')) {
    variants.add(`${raw.replace(/\.H$/i, '')}.V`);
  }

  return [...variants].filter(Boolean);
}

export function canadaSymbolCandidates(ibkrSymbol, mappedSymbol = null) {
  const ordered = [];
  if (mappedSymbol) ordered.push(mappedSymbol);
  for (const variant of canadaSymbolVariants(ibkrSymbol)) ordered.push(variant);
  return [...new Set(ordered)];
}

export function defaultCanadaYahooSymbol(symbol) {
  const raw = String(symbol ?? '').trim();
  if (!raw) return null;
  const variants = canadaSymbolVariants(raw);

  if (raw.includes('.PR.')) {
    return variants.find((s) => s.includes('-PR-') && s.endsWith('.TO')) ?? variants[0] ?? null;
  }

  if (raw.includes('.') && !raw.endsWith('.H')) {
    const parts = raw.split('.');
    const hyphenTo = `${parts[0]}-${parts[1]}.TO`;
    if (variants.includes(hyphenTo)) return hyphenTo;
  }

  if (raw.endsWith('.H')) {
    return variants.find((s) => s.endsWith('.V')) ?? `${raw.replace(/\.H$/i, '')}.V`;
  }

  return variants.find((s) => s.endsWith('.TO')) ?? `${raw.split('.')[0]}.TO`;
}

export function shouldRemediateCanadaSymbol(ibkrSymbol, mappedSymbol) {
  if (!ibkrSymbol || !mappedSymbol) return false;
  if (isWrongMnemonicMapping(ibkrSymbol, mappedSymbol)) return true;

  const preferred = defaultCanadaYahooSymbol(ibkrSymbol);
  if (!preferred || preferred === mappedSymbol) return false;

  const hasClass = String(ibkrSymbol).includes('.') && !String(ibkrSymbol).endsWith('.H');
  if (hasClass) return mappedSymbol !== preferred;

  return false;
}

export function otcSymbolCandidates(ibkrSymbol, mappedSymbol = null) {
  const plain = normalizeOtcSymbol(ibkrSymbol);
  const ordered = [plain];
  if (mappedSymbol && mappedSymbol !== plain) ordered.push(mappedSymbol);
  return [...new Set(ordered.filter(Boolean))];
}

export function rankCanadaCandidates(ibkrSymbol) {
  const variants = canadaSymbolVariants(ibkrSymbol);
  const score = (symbol) => {
    if (symbol.endsWith('.TO')) return 0;
    if (symbol.endsWith('.V')) return String(ibkrSymbol).endsWith('.H') ? 0 : 2;
    if (symbol.endsWith('.CN')) return 3;
    if (symbol.endsWith('.NE')) return 4;
    return 5;
  };
  return [...variants].sort((a, b) => score(a) - score(b));
}

export function normalizeCurrency(code) {
  if (!code) return null;
  const upper = String(code).trim().toUpperCase();
  return CURRENCY_ALIASES[upper] ?? CURRENCY_ALIASES[code] ?? upper;
}

export function currenciesMatch(a, b) {
  const left = normalizeCurrency(a);
  const right = normalizeCurrency(b);
  if (!left || !right) return true;
  return left === right;
}

export function yahooSuffixForExchange(exchangeId) {
  if (!exchangeId) return null;
  return YAHOO_SUFFIX[exchangeId] ?? null;
}

export function isUsYahooExchange(exchange) {
  if (!exchange) return false;
  return US_YAHOO_EXCHANGES.has(String(exchange).toUpperCase());
}

export function preferredYahooExchanges(ibkrExchange) {
  return PREFERRED_YAHOO_EXCHANGES[ibkrExchange] ?? [];
}

export function isGermanIbkrExchange(exchangeId) {
  return GERMAN_IBKR_EXCHANGES.has(exchangeId);
}

export function isVenueSensitiveExchange(exchangeId) {
  return VENUE_SENSITIVE_EXCHANGES.has(exchangeId);
}

export function isVenueMismatch(ibkrExchange, yahooExchange) {
  if (!isVenueSensitiveExchange(ibkrExchange)) return false;
  const preferred = preferredYahooExchanges(ibkrExchange);
  if (!preferred.length) return false;
  if (!yahooExchange) return true;
  return !preferred.includes(String(yahooExchange).toUpperCase());
}

export function toUsPlainSymbol(symbol) {
  return String(symbol ?? '')
    .split('.')[0]
    .trim()
    .replace(/\s+/g, '-')
    .replace(/\./g, '-');
}

export function isCanadianYahooSymbol(symbol) {
  return CANADIAN_YAHOO_SUFFIX.test(String(symbol ?? ''));
}

export function isIsinDotVenueSymbol(symbol) {
  return ISIN_DOT_VENUE.test(String(symbol ?? ''));
}

export function yahooSymbolBase(symbol) {
  const text = String(symbol ?? '');
  const dot = text.lastIndexOf('.');
  return dot > 0 ? text.slice(0, dot) : text;
}

function normalizedTicker(symbol) {
  return String(symbol ?? '')
    .trim()
    .replace(/\.$/, '')
    .replace(/-/g, '.')
    .toUpperCase();
}

export function isUsPlainYahooSymbol(symbol) {
  const text = String(symbol ?? '').trim();
  return Boolean(text) && !text.includes('.');
}

/** ISIN search returned a different mnemonic (e.g. AMD2.L vs IBKR 2AMD). */
export function isWrongMnemonicMapping(ibkrSymbol, mappedSymbol) {
  const base = yahooSymbolBase(mappedSymbol);
  if (!base || !ibkrSymbol) return false;
  return normalizedTicker(base) !== normalizedTicker(ibkrSymbol);
}

function shouldTryWrongMnemonicFix(instrument, mappedSymbol) {
  const exchangeId = instrument?.exchange_id;
  const currency = instrument?.currency;
  if (US_IBKR_EXCHANGES.has(exchangeId)) return false;
  if (!isWrongMnemonicMapping(instrument?.symbol, mappedSymbol)) return false;
  if (UK_LSE_EXCHANGES.has(exchangeId)) return true;
  if (currency === 'GBP') return true;
  if (currency === 'EUR' && (String(mappedSymbol).endsWith('.L') || isUsPlainYahooSymbol(mappedSymbol))) {
    return true;
  }
  return false;
}

/**
 * Leverage Shares / multi-listing ETFs: Yahoo mnemonic often differs from IBKR ticker.
 */
export function resolveWrongMnemonicSymbol(instrument, mappedSymbol) {
  if (!shouldTryWrongMnemonicFix(instrument, mappedSymbol)) return null;

  const exchangeId = instrument?.exchange_id;
  const symbol = instrument?.symbol;
  const currency = instrument?.currency;

  if (UK_LSE_EXCHANGES.has(exchangeId)) {
    const lSymbol = toSuffixYahooSymbol(symbol, 'LSE');
    if (lSymbol && lSymbol !== mappedSymbol) {
      return { yahoo_symbol: lSymbol, fix_method: 'ibkr_mnemonic_l_fix' };
    }
  }

  if (currency === 'EUR' && String(mappedSymbol).endsWith('.L')) {
    const lSymbol = `${symbol}.L`;
    if (lSymbol !== mappedSymbol) {
      return { yahoo_symbol: lSymbol, fix_method: 'ibkr_mnemonic_l_fix' };
    }
  }

  const suffixSymbol = toSuffixYahooSymbol(symbol, exchangeId);
  if (suffixSymbol && suffixSymbol !== mappedSymbol) {
    return { yahoo_symbol: suffixSymbol, fix_method: 'ibkr_mnemonic_suffix_fix' };
  }

  if (currency === 'GBP' || UK_LSE_EXCHANGES.has(exchangeId)) {
    const lSymbol = `${symbol}.L`;
    if (lSymbol !== mappedSymbol) {
      return { yahoo_symbol: lSymbol, fix_method: 'ibkr_mnemonic_l_fix' };
    }
  }

  if (currency === 'EUR') {
    const deSymbol = `${symbol}.DE`;
    if (deSymbol !== mappedSymbol) {
      return { yahoo_symbol: deSymbol, fix_method: 'ibkr_mnemonic_de_fix' };
    }
  }

  return null;
}

export function mappedSymbolMatchesExchangeSuffix(mappedSymbol, exchangeId) {
  const expected = yahooSuffixForExchange(exchangeId);
  if (expected == null || expected === '') return true;
  return String(mappedSymbol ?? '').toUpperCase().endsWith(expected.toUpperCase());
}

/**
 * Prefer exchange suffix when ISIN search landed on the wrong venue/currency.
 */
export function preferExchangeSuffixSymbol(instrument, mappedSymbol) {
  const exchangeId = instrument?.exchange_id;
  const symbol = instrument?.symbol;
  const suffixSymbol = toSuffixYahooSymbol(symbol, exchangeId);
  if (!suffixSymbol || suffixSymbol === mappedSymbol) return null;

  if (isIsinDotVenueSymbol(mappedSymbol)) {
    return { yahoo_symbol: suffixSymbol, fix_method: 'isin_dot_suffix_fix' };
  }

  if (UK_LSE_EXCHANGES.has(exchangeId) && !String(mappedSymbol).endsWith('.L')) {
    return { yahoo_symbol: toSuffixYahooSymbol(symbol, 'LSE'), fix_method: 'uk_l_suffix_fix' };
  }

  if (CH_SW_EXCHANGES.has(exchangeId) && !String(mappedSymbol).endsWith('.SW')) {
    return { yahoo_symbol: suffixSymbol, fix_method: 'ch_sw_suffix_fix' };
  }

  if ((exchangeId === 'BVME' || exchangeId === 'BVME.ETF' || exchangeId === 'TRWBIT') && !String(mappedSymbol).endsWith('.MI')) {
    return { yahoo_symbol: suffixSymbol, fix_method: 'it_mi_suffix_fix' };
  }

  if (
    exchangeId === 'SBF' &&
    !String(mappedSymbol).endsWith('.PA') &&
    !String(mappedSymbol).endsWith('.AS')
  ) {
    return { yahoo_symbol: suffixSymbol, fix_method: 'fr_pa_suffix_fix' };
  }

  if (
    exchangeId &&
    !UK_LSE_EXCHANGES.has(exchangeId) &&
    String(mappedSymbol).endsWith('.L') &&
    suffixSymbol &&
    suffixSymbol !== mappedSymbol &&
    isWrongMnemonicMapping(instrument?.symbol, mappedSymbol)
  ) {
    const lListing = toSuffixYahooSymbol(instrument?.symbol, 'LSE');
    if (lListing && lListing !== mappedSymbol) {
      return { yahoo_symbol: lListing, fix_method: 'ibkr_mnemonic_l_fix' };
    }
    return { yahoo_symbol: suffixSymbol, fix_method: 'non_uk_l_suffix_fix' };
  }

  if (JP_T_EXCHANGES.has(exchangeId) && !String(mappedSymbol).endsWith('.T')) {
    return { yahoo_symbol: suffixSymbol, fix_method: 'jp_t_suffix_fix' };
  }

  if (exchangeId === 'SEHK' && !String(mappedSymbol).endsWith('.HK')) {
    return { yahoo_symbol: suffixSymbol, fix_method: 'hk_suffix_fix' };
  }

  if (!mappedSymbolMatchesExchangeSuffix(mappedSymbol, exchangeId)) {
    return { yahoo_symbol: suffixSymbol, fix_method: 'exchange_suffix_fix' };
  }

  return null;
}

/**
 * Align Yahoo price units with IBKR for comparison (e.g. GBp vs GBP, ILA vs ILS).
 */
export function alignPricesForCompare(ibkrPrice, ibkrCurrency, yahooPrice, yahooCurrency) {
  if (ibkrPrice == null || yahooPrice == null || ibkrPrice <= 0 || yahooPrice <= 0) {
    return { ibkr: ibkrPrice, yahoo: yahooPrice };
  }

  const iCur = ibkrCurrency;
  const yCur = yahooCurrency;

  if (
    (yCur === 'ILA' || yCur === 'ILs' || yCur === 'ILS') &&
    (iCur === 'ILS' || iCur === 'ILA')
  ) {
    return alignMinorUnitPair(ibkrPrice, yahooPrice, 100);
  }

  if (
    (yCur === 'GBp' || yCur === 'GBX' || yCur === 'GBP') &&
    (iCur === 'GBP' || iCur === 'GBp' || iCur === 'GBX')
  ) {
    return alignMinorUnitPair(ibkrPrice, yahooPrice, 100);
  }

  return { ibkr: ibkrPrice, yahoo: yahooPrice };
}

function alignMinorUnitPair(ibkr, yahoo, factor) {
  const ratio = yahoo / ibkr;
  if (ratio >= 0.5 && ratio <= 2) {
    return { ibkr, yahoo };
  }
  if (ratio > factor * 0.5) {
    return { ibkr, yahoo: yahoo / factor };
  }
  if (ratio < 2 / factor) {
    return { ibkr, yahoo: yahoo * factor };
  }
  if (ibkr < 500 && yahoo > ibkr * 20) {
    return { ibkr, yahoo: yahoo / factor };
  }
  if (ibkr >= 500 && yahoo < ibkr / 20) {
    return { ibkr, yahoo: yahoo * factor };
  }
  return { ibkr, yahoo };
}

export function normalizeYahooPriceForCompare(ibkrPrice, ibkrCurrency, yahooPrice, yahooCurrency) {
  if (yahooPrice == null) return null;
  return alignPricesForCompare(ibkrPrice, ibkrCurrency, yahooPrice, yahooCurrency).yahoo;
}

/** Reject Yahoo backup quotes that are clearly the wrong security or unit. */
export function isPlausibleYahooBackup(ibkrPrice, ibkrCurrency, yahooPrice, yahooCurrency) {
  if (ibkrPrice == null || yahooPrice == null || ibkrPrice <= 0 || yahooPrice <= 0) {
    return false;
  }
  const { ibkr, yahoo } = alignPricesForCompare(ibkrPrice, ibkrCurrency, yahooPrice, yahooCurrency);
  if (ibkr == null || yahoo == null || ibkr <= 0) return false;
  const absPct = Math.abs((yahoo - ibkr) / ibkr) * 100;
  return absPct <= 20;
}

export function isWrongEuropeanYahooSymbol(symbol, ibkrExchange) {
  const text = String(symbol ?? '');
  if (!text) return false;
  if (['LSE', 'LSEETF'].includes(ibkrExchange) && /\.L$/i.test(text)) return false;
  return EUROPEAN_YAHOO_SUFFIX.test(text) || ISIN_DOT_VENUE.test(text);
}

/**
 * Correct ISIN hits that quote in the wrong currency/venue (top mismatch pairs).
 */
export function resolveCurrencyMismatchSymbol(instrument, mappingRow) {
  if (!mappingRow?.yahoo_symbol) return null;

  const exchangeId = instrument?.exchange_id ?? mappingRow.exchange_id;
  const symbol = instrument?.symbol ?? mappingRow.symbol;
  const currency = instrument?.currency ?? mappingRow.currency;
  const mapped = mappingRow.yahoo_symbol;

  if (US_IBKR_EXCHANGES.has(exchangeId) && currency === 'USD' && isCanadianYahooSymbol(mapped)) {
    return { yahoo_symbol: toUsPlainSymbol(symbol), fix_method: 'usd_cad_venue_fix' };
  }

  if (US_IBKR_EXCHANGES.has(exchangeId) && currency === 'USD' && isWrongEuropeanYahooSymbol(mapped, exchangeId)) {
    return { yahoo_symbol: toUsPlainSymbol(symbol), fix_method: 'usd_eur_venue_fix' };
  }

  if (['LSE', 'LSEETF'].includes(exchangeId) && currency === 'USD' && isWrongEuropeanYahooSymbol(mapped, exchangeId)) {
    const lseSymbol = toSuffixYahooSymbol(symbol, exchangeId);
    if (lseSymbol) return { yahoo_symbol: lseSymbol, fix_method: 'lse_usd_suffix_fix' };
  }

  const suffixSymbol = toSuffixYahooSymbol(symbol, exchangeId);
  if (
    suffixSymbol &&
    suffixSymbol !== mapped &&
    currency === 'USD' &&
    (isWrongEuropeanYahooSymbol(mapped, exchangeId) || isIsinDotVenueSymbol(mapped))
  ) {
    return { yahoo_symbol: suffixSymbol, fix_method: 'exchange_suffix_currency_fix' };
  }

  const mnemonicFix = resolveWrongMnemonicSymbol(
    { exchange_id: exchangeId, symbol, currency },
    mapped,
  );
  if (mnemonicFix) return mnemonicFix;

  if (
    currency === 'EUR' &&
    isUsPlainYahooSymbol(mapped) &&
    suffixSymbol &&
    suffixSymbol !== mapped
  ) {
    return { yahoo_symbol: suffixSymbol, fix_method: 'eur_us_plain_suffix_fix' };
  }

  const prevSymbol = mappingRow?.yahoo_currency_fix_prev_symbol;
  const lListing = toSuffixYahooSymbol(symbol, 'LSE');
  const isEtf = (instrument?.instrument_type ?? mappingRow?.instrument_type) === 'ETF';
  if (
    isEtf &&
    currency === 'EUR' &&
    EU_LEVERAGE_ETF_EXCHANGES.has(exchangeId) &&
    lListing &&
    lListing !== mapped &&
    suffixSymbol &&
    mapped === suffixSymbol &&
    prevSymbol &&
    isWrongMnemonicMapping(symbol, prevSymbol)
  ) {
    return { yahoo_symbol: lListing, fix_method: 'eur_leverage_l_fix' };
  }

  const suffixFix = preferExchangeSuffixSymbol(
    { exchange_id: exchangeId, symbol, currency },
    mapped,
  );
  if (suffixFix) return suffixFix;

  return null;
}

export function toSuffixYahooSymbol(ibkrSymbol, exchangeId) {
  const suffix = yahooSuffixForExchange(exchangeId);
  if (suffix == null) return null;
  const base = String(ibkrSymbol ?? '')
    .trim()
    .replace(/\.$/, '');
  if (!base || base.includes('.')) return null;
  return suffix === '' ? base : `${base}${suffix}`;
}

function formatYahooHit(hit) {
  if (!hit?.symbol) return null;
  return {
    yahoo_symbol: hit.symbol,
    yahoo_exchange: hit.exchange ?? null,
    yahoo_exchange_display: hit.exchDisp ?? null,
    yahoo_quote_type: hit.quoteType ?? null,
    yahoo_shortname: hit.shortname ?? null,
    yahoo_longname: hit.longname ?? null,
  };
}

function filterQuotePool(quotes, instrument) {
  if (!quotes?.length) return [];

  const wantEtf = instrument.instrument_type === 'ETF';
  const allowed = quotes.filter((q) => {
    const t = (q.quoteType ?? '').toUpperCase();
    return t === 'EQUITY' || t === 'ETF' || t === 'MUTUALFUND';
  });
  const pool = allowed.length ? allowed : quotes;

  const typed = pool.filter((q) => {
    const t = (q.quoteType ?? '').toUpperCase();
    return wantEtf ? t === 'ETF' || t === 'MUTUALFUND' : t === 'EQUITY' || t === 'ETF';
  });
  return typed.length ? typed : pool;
}

function sortByScore(quotes) {
  return [...quotes].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/**
 * Pick the Yahoo quote that matches IBKR listing venue when possible.
 */
export function pickYahooQuote(quotes, instrument) {
  const candidates = filterQuotePool(quotes, instrument);
  if (!candidates.length) return null;

  const ibkrExchange = instrument.exchange_id;
  const preferred = preferredYahooExchanges(ibkrExchange);

  if (preferred.length) {
    const local = sortByScore(
      candidates.filter((q) => preferred.includes(String(q.exchange ?? '').toUpperCase())),
    );
    if (local.length) return formatYahooHit(local[0]);

    const suffixSymbol = toSuffixYahooSymbol(instrument.symbol, ibkrExchange);
    if (suffixSymbol) {
      const suffixHit = candidates.find((q) => q.symbol === suffixSymbol);
      if (suffixHit) return formatYahooHit(suffixHit);
    }

    const nonUs = sortByScore(candidates.filter((q) => !isUsYahooExchange(q.exchange)));
    if (nonUs.length) return formatYahooHit(nonUs[0]);
  }

  return formatYahooHit(sortByScore(candidates)[0]);
}

/**
 * Resolve Yahoo symbol for fetch-time fallback.
 * German: Xetra ISIN→mnemonic (.DE), then suffix.
 * MEXI/TASE: suffix override when mapping points at US listing.
 */
export async function resolveYahooSymbol(instrument, mappingRow) {
  if (!mappingRow?.yahoo_symbol && !instrument?.isin) return null;

  const ibkrExchange = instrument?.exchange_id ?? mappingRow?.exchange_id;
  const ibkrSymbol = instrument?.symbol ?? mappingRow?.symbol;
  const isin = instrument?.isin ?? mappingRow?.isin;

  if (OTC_IBKR_EXCHANGES.has(ibkrExchange)) {
    const plain = normalizeOtcSymbol(ibkrSymbol);
    if (
      !mappingRow?.yahoo_symbol ||
      isWrongMnemonicMapping(ibkrSymbol, mappingRow.yahoo_symbol)
    ) {
      return plain;
    }
    return mappingRow.yahoo_symbol;
  }

  if (CANADA_IBKR_EXCHANGES.has(ibkrExchange)) {
    const currencyFix = resolveCurrencyMismatchSymbol(
      {
        exchange_id: ibkrExchange,
        symbol: ibkrSymbol,
        currency: instrument?.currency ?? mappingRow?.currency,
        instrument_type: instrument?.instrument_type ?? mappingRow?.instrument_type,
      },
      mappingRow ?? { yahoo_symbol: null },
    );
    if (currencyFix?.yahoo_symbol) return currencyFix.yahoo_symbol;

    if (
      !mappingRow?.yahoo_symbol ||
      isWrongMnemonicMapping(ibkrSymbol, mappingRow.yahoo_symbol)
    ) {
      return defaultCanadaYahooSymbol(ibkrSymbol);
    }
    return mappingRow.yahoo_symbol;
  }

  if (isGermanIbkrExchange(ibkrExchange) && isin) {
    const xetraSymbol = await resolveXetraYahooSymbol({ isin, exchange_id: ibkrExchange, symbol: ibkrSymbol });
    if (xetraSymbol) return xetraSymbol;
  }

  const currencyFix = resolveCurrencyMismatchSymbol(
    { exchange_id: ibkrExchange, symbol: ibkrSymbol, currency: instrument?.currency ?? mappingRow?.currency },
    mappingRow,
  );
  if (currencyFix?.yahoo_symbol) return currencyFix.yahoo_symbol;

  if (!mappingRow?.yahoo_symbol) {
    return toSuffixYahooSymbol(ibkrSymbol, ibkrExchange);
  }

  if (!isVenueSensitiveExchange(ibkrExchange)) {
    return mappingRow.yahoo_symbol;
  }

  if (
    mappingRow.yahoo_venue_fixed ||
    !isVenueMismatch(ibkrExchange, mappingRow.yahoo_exchange)
  ) {
    return mappingRow.yahoo_symbol;
  }

  const suffixSymbol = toSuffixYahooSymbol(ibkrSymbol, ibkrExchange);
  if (suffixSymbol) return suffixSymbol;

  return mappingRow.yahoo_symbol;
}
