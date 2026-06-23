/**
 * Resolve Yahoo symbol for full-universe IBKR ↔ Yahoo comparison.
 */

import {
  GERMAN_IBKR_EXCHANGES,
  isVenueSensitiveExchange,
  isVenueMismatch,
  isUsYahooExchange,
  resolveCurrencyMismatchSymbol,
  resolveYahooSymbol,
  alignPricesForCompare,
  toSuffixYahooSymbol,
  toUsPlainSymbol,
  US_IBKR_EXCHANGES,
  US_YAHOO_EXCHANGES,
} from './yahoo-venue.mjs';
import { getXetraRowByIsin, xetraYahooSymbolFromRow } from './xetra-isin.mjs';

export async function resolveYahooForCompare(instrument, mappingRow = null) {
  const inst = {
    conid: instrument.conid,
    symbol: instrument.symbol,
    exchange_id: instrument.exchange_id ?? instrument.exchangeId,
    currency: instrument.currency,
    isin: instrument.isin,
    instrument_type: instrument.instrument_type ?? instrument.instrumentType,
  };

  const map = mappingRow
    ? {
        ...mappingRow,
        exchange_id: mappingRow.exchange_id ?? inst.exchange_id,
        symbol: mappingRow.symbol ?? inst.symbol,
        isin: mappingRow.isin ?? inst.isin,
        currency: mappingRow.currency ?? inst.currency,
      }
    : {
        conid: inst.conid,
        symbol: inst.symbol,
        exchange_id: inst.exchange_id,
        isin: inst.isin,
        currency: inst.currency,
        yahoo_symbol: null,
        yahoo_exchange: null,
      };

  if (GERMAN_IBKR_EXCHANGES.has(inst.exchange_id) && inst.isin) {
    const xetraRow = await getXetraRowByIsin(inst.isin, inst.currency);
    if (xetraRow) {
      return {
        yahoo_symbol: xetraYahooSymbolFromRow(xetraRow),
        symbol_source: 'xetra',
        xetra_mnemonic: xetraRow.mnemonic,
        mapping_yahoo_symbol: map.yahoo_symbol ?? null,
        mapping_yahoo_exchange: map.yahoo_exchange ?? null,
      };
    }
  }

  if (map.yahoo_symbol) {
    const currencyFix = resolveCurrencyMismatchSymbol(inst, map);
    if (currencyFix?.yahoo_symbol) {
      return {
        yahoo_symbol: currencyFix.yahoo_symbol,
        symbol_source: currencyFix.fix_method,
        xetra_mnemonic: null,
        mapping_yahoo_symbol: map.yahoo_symbol,
        mapping_yahoo_exchange: map.yahoo_exchange ?? null,
      };
    }

    const resolved = await resolveYahooSymbol(inst, map);
    if (resolved) {
      const venueOverride =
        isVenueSensitiveExchange(inst.exchange_id) &&
        isVenueMismatch(inst.exchange_id, map.yahoo_exchange) &&
        resolved !== map.yahoo_symbol;
      return {
        yahoo_symbol: resolved,
        symbol_source: venueOverride ? 'venue_suffix' : 'isin_mapping',
        xetra_mnemonic: null,
        mapping_yahoo_symbol: map.yahoo_symbol,
        mapping_yahoo_exchange: map.yahoo_exchange ?? null,
      };
    }
  }

  const suffix = toSuffixYahooSymbol(inst.symbol, inst.exchange_id);
  if (suffix) {
    return {
      yahoo_symbol: suffix,
      symbol_source: 'exchange_suffix',
      xetra_mnemonic: null,
      mapping_yahoo_symbol: map.yahoo_symbol ?? null,
      mapping_yahoo_exchange: map.yahoo_exchange ?? null,
    };
  }

  if (US_IBKR_EXCHANGES.has(inst.exchange_id) && inst.symbol) {
    const plain = toUsPlainSymbol(inst.symbol);
    return {
      yahoo_symbol: plain,
      symbol_source: 'us_plain',
      xetra_mnemonic: null,
      mapping_yahoo_symbol: map.yahoo_symbol ?? null,
      mapping_yahoo_exchange: map.yahoo_exchange ?? null,
    };
  }

  return {
    yahoo_symbol: null,
    symbol_source: 'none',
    xetra_mnemonic: null,
    mapping_yahoo_symbol: map.yahoo_symbol ?? null,
    mapping_yahoo_exchange: map.yahoo_exchange ?? null,
  };
}

export function pctDiff(ibkr, yahoo, ibkrCurrency = null, yahooCurrency = null) {
  if (ibkr == null || yahoo == null || ibkr === 0) return null;
  const aligned =
    ibkrCurrency != null && yahooCurrency != null
      ? alignPricesForCompare(ibkr, ibkrCurrency, yahoo, yahooCurrency)
      : { ibkr, yahoo };
  if (aligned.yahoo == null || aligned.ibkr == null || aligned.ibkr === 0) return null;
  return ((aligned.yahoo - aligned.ibkr) / aligned.ibkr) * 100;
}

export function matchBucket(absPct) {
  if (absPct == null) return 'no_yahoo_price';
  if (absPct <= 0.1) return 'match_0_1pct';
  if (absPct <= 0.5) return 'match_0_5pct';
  if (absPct <= 1) return 'match_1pct';
  if (absPct <= 2) return 'match_2pct';
  if (absPct <= 5) return 'match_5pct';
  return 'mismatch_gt_5pct';
}

/**
 * Mismatch root-cause bucket (Types A–F from analysis).
 */
export function classifyMismatchType(row) {
  const abs = row.pct_diff == null ? null : Math.abs(row.pct_diff);
  if (abs == null) return 'NO_YAHOO';
  if (abs <= 1) return 'OK';

  const ex = row.exchange_id;
  const src = row.symbol_source;

  if (GERMAN_IBKR_EXCHANGES.has(ex)) {
    if (src === 'xetra' || src === 'venue_suffix' || src === 'exchange_suffix') {
      return abs <= 2 ? 'A' : 'B';
    }
    if (src === 'isin_mapping' && row.mapping_yahoo_exchange && isUsYahooExchange(row.mapping_yahoo_exchange)) {
      return 'B';
    }
    return 'B';
  }
  if (ex === 'MEXI') return src === 'venue_suffix' || src === 'exchange_suffix' ? 'A' : 'C';
  if (ex === 'TASE') return src === 'venue_suffix' || src === 'exchange_suffix' ? 'A' : 'D';
  if (row.currency === 'GBP' || row.yahoo_currency === 'GBp' || row.yahoo_currency === 'GBX') return 'E';
  if (['LSE', 'LSEETF', 'CHIXUK', 'TRQXUK'].includes(ex)) return 'F';
  if (abs <= 2) return 'A';
  if (src === 'isin_mapping' && row.mapping_yahoo_exchange && isUsYahooExchange(row.mapping_yahoo_exchange)) {
    return 'VENUE';
  }
  return 'OTHER';
}

export function summarizeRows(rows) {
  const both = rows.filter((r) => r.ibkr_price != null && r.yahoo_price != null);
  const diffs = both.map((r) => Math.abs(r.pct_diff)).sort((a, b) => a - b);
  const buckets = {};
  for (const r of rows) {
    buckets[r.match_bucket] = (buckets[r.match_bucket] ?? 0) + 1;
  }
  const types = {};
  for (const r of both) {
    const t = r.mismatch_type ?? classifyMismatchType(r);
    types[t] = (types[t] ?? 0) + 1;
  }
  return {
    total: rows.length,
    ibkr_priced: rows.filter((r) => r.ibkr_price != null).length,
    yahoo_symbol_resolved: rows.filter((r) => r.yahoo_symbol).length,
    yahoo_priced: rows.filter((r) => r.yahoo_price != null).length,
    both_priced: both.length,
    within_1pct: both.filter((r) => Math.abs(r.pct_diff) <= 1).length,
    within_2pct: both.filter((r) => Math.abs(r.pct_diff) <= 2).length,
    mismatch_gt_5pct: both.filter((r) => Math.abs(r.pct_diff) > 5).length,
    median_abs_pct_diff: diffs.length ? diffs[Math.floor(diffs.length / 2)] : null,
    match_buckets: buckets,
    mismatch_types: types,
    symbol_sources: rows.reduce((m, r) => {
      m[r.symbol_source] = (m[r.symbol_source] ?? 0) + 1;
      return m;
    }, {}),
  };
}
