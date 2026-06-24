import { supabase } from '../supabase';
import { stockUniverse } from './basketCatalog';

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
    isPrime: row.is_prime,
    isIbkr: true,
  };
}

export function formatInstrumentType(type) {
  if (type === 'ETF') return 'ETF';
  if (type === 'STK') return 'Stock';
  return type ?? 'Instrument';
}

function searchLocalUniverse(query, limit = 20) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return stockUniverse
    .filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    .slice(0, limit)
    .map((s) => ({
      symbol: s.symbol,
      name: s.name,
      exchange: 'SMART',
      isIbkr: true,
      isPrime: true,
    }));
}

export async function searchInstruments(query, { limit = 20 } = {}) {
  const term = query.trim();
  if (!term) return { results: [], source: 'empty' };

  if (!supabase) {
    return { results: searchLocalUniverse(term, limit), source: 'local' };
  }

  const { data, error } = await supabase.rpc('search_ibkr_instruments', {
    p_query: term,
    p_limit: limit,
  });

  if (error) {
    console.warn('IBKR instrument search failed, using local fallback', error.message);
    return { results: searchLocalUniverse(term, limit), source: 'local-fallback' };
  }

  if (!data?.length) {
    return { results: [], source: 'ibkr' };
  }

  return { results: data.map(mapInstrumentRow), source: 'ibkr' };
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
