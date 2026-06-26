import { supabase } from '../supabase';
import { isValidStockSymbol, stockUniverse } from './basketCatalog';

/** Shorter prefixes to try when a long ticker query has no hits (min length 3). */
export function tickerPrefixLengths(length) {
  if (length <= 3) return [length];
  const minLen = Math.max(3, length - 2);
  const lengths = [];
  for (let len = length; len >= minLen; len -= 1) {
    lengths.push(len);
  }
  return lengths;
}

function mapInstrumentRow(row) {
  return {
    conid: row.conid,
    symbol: row.symbol,
    name: row.name,
    exchange: row.exchange_id,
    currency: row.currency,
    country: row.country,
    isin: row.isin ?? null,
    localSymbol: row.local_symbol ?? row.symbol,
    instrumentType: row.instrument_type ?? 'STK',
    ucits: Boolean(row.ucits),
    isPrime: Boolean(row.is_prime),
    isIbkr: true,
  };
}

export function formatInstrumentType(type) {
  if (type === 'ETF') return 'ETF';
  if (type === 'STK') return 'Stock';
  return type ?? 'Instrument';
}

function searchLocalUniverse(query, limit = 20) {
  const term = query.trim();
  if (!term) return { results: [], matchedQuery: term };

  const prefixes = isValidStockSymbol(term)
    ? tickerPrefixLengths(term.length).map((len) => term.slice(0, len))
    : [term];

  for (const prefix of prefixes) {
    const q = prefix.toLowerCase();
    const results = stockUniverse
      .filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, limit)
      .map((s) => ({
        symbol: s.symbol,
        name: s.name,
        exchange: 'SMART',
        isIbkr: true,
        isPrime: true,
      }));

    if (results.length) {
      return { results, matchedQuery: prefix };
    }
  }

  return { results: [], matchedQuery: term };
}

async function searchIbkrUniverse(term, limit) {
  const prefixes = isValidStockSymbol(term)
    ? tickerPrefixLengths(term.length).map((len) => term.slice(0, len).toUpperCase())
    : [term];

  for (const prefix of prefixes) {
    const { data, error } = await supabase.rpc('search_ibkr_instruments', {
      p_query: prefix,
      p_limit: limit,
    });

    if (error) throw error;
    if (data?.length) {
      return { results: data.map(mapInstrumentRow), matchedQuery: prefix };
    }
  }

  return { results: [], matchedQuery: term };
}

export async function searchInstruments(query, { limit = 20 } = {}) {
  const term = query.trim();
  if (!term) return { results: [], source: 'empty', matchedQuery: '' };

  if (!supabase) {
    const { results, matchedQuery } = searchLocalUniverse(term, limit);
    return { results, source: 'local', matchedQuery };
  }

  try {
    const { results, matchedQuery } = await searchIbkrUniverse(term, limit);
    return { results, source: 'ibkr', matchedQuery };
  } catch (error) {
    console.warn('IBKR instrument search failed, using local fallback', error.message);
    const { results, matchedQuery } = searchLocalUniverse(term, limit);
    return { results, source: 'local-fallback', matchedQuery };
  }
}

export async function listExchanges({ limit = 200 } = {}) {
  if (!supabase) return { results: [], source: 'local' };

  const { data, error } = await supabase
    .from('ibkr_exchanges')
    .select('id, instrument_count, countries, currencies')
    .order('instrument_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('IBKR exchange list failed', error.message);
    return { results: [], source: 'error' };
  }

  return {
    results: (data ?? []).map((row) => ({
      id: row.id,
      instrumentCount: row.instrument_count,
      countries: row.countries ?? [],
      currencies: row.currencies ?? [],
    })),
    source: 'ibkr',
  };
}

export function constituentKey(constituent) {
  if (constituent?.conid) return String(constituent.conid);
  if (constituent?.exchange) return `${constituent.symbol}:${constituent.exchange}`;
  return constituent?.symbol ?? '';
}
