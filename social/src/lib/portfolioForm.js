import { createClient } from '@supabase/supabase-js';

/**
 * Map momentum-screener regimes → portfolio form labels.
 * Bullish → In Form, Bearish → Off Track, Mixed/Insufficient → Unsure.
 *
 * Signals live in a dedicated Supabase project (momentum-screener),
 * not the main social PocketEdge project.
 */
export function mapDmaRegimeToForm(regime) {
  switch (String(regime ?? '').trim()) {
    case 'Bullish':
      return 'in_form';
    case 'Bearish':
      return 'out_of_form';
    case 'Mixed':
    case 'Insufficient':
    default:
      return 'unsure';
  }
}

/** @deprecated Prefer mapDmaRegimeToForm — kept for any leftover callers. */
export function classifySecurityForm({ price, ma50, ma200 }) {
  const close = Number(price);
  const dma50 = Number(ma50);
  const dma200 = Number(ma200);

  if (
    !Number.isFinite(close) ||
    !Number.isFinite(dma50) ||
    !Number.isFinite(dma200)
  ) {
    return 'unsure';
  }

  if (close > dma50 && close > dma200) return 'in_form';
  if (close < dma50 && close < dma200) return 'out_of_form';
  return 'unsure';
}

export const FORM_META = {
  in_form: {
    id: 'in_form',
    label: 'In Form',
    shortLabel: 'In Form',
  },
  out_of_form: {
    id: 'out_of_form',
    label: 'Off Track',
    shortLabel: 'Off Track',
  },
  unsure: {
    id: 'unsure',
    label: 'Unsure',
    shortLabel: 'Unsure',
  },
};

const dmaSupabaseUrl = import.meta.env.VITE_DMA_SUPABASE_URL;
const dmaSupabaseAnonKey = import.meta.env.VITE_DMA_SUPABASE_ANON_KEY;

const dmaClient =
  dmaSupabaseUrl && dmaSupabaseAnonKey
    ? createClient(dmaSupabaseUrl, dmaSupabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export function isDmaSignalsConfigured() {
  return Boolean(dmaClient);
}

const cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;
const IN_CHUNK = 100;

function normalizeTicker(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\.NS$/i, '');
}

function rowToSignal(row) {
  if (!row) return null;
  const regime = row.regime ?? null;
  return {
    symbol: String(row.symbol ?? '').toUpperCase(),
    regime,
    form: mapDmaRegimeToForm(regime),
    price: row.close != null ? Number(row.close) : null,
    ma50: row.dma_50 != null ? Number(row.dma_50) : null,
    ma200: row.dma_200 != null ? Number(row.dma_200) : null,
    dma200Slope: row.dma_200_slope != null ? Number(row.dma_200_slope) : null,
    asOfDate: row.as_of_date ?? null,
    pctVs50: row.pct_vs_50 != null ? Number(row.pct_vs_50) : null,
    pctVs200: row.pct_vs_200 != null ? Number(row.pct_vs_200) : null,
  };
}

function unsureSignal(ticker) {
  return {
    symbol: ticker,
    regime: null,
    form: 'unsure',
    price: null,
    ma50: null,
    ma200: null,
    dma200Slope: null,
    asOfDate: null,
    pctVs50: null,
    pctVs200: null,
  };
}

/**
 * Fetch daily DMA classification rows from momentum-screener
 * (`public.nse_dma_signals`) for the given NSE tickers.
 */
export async function fetchDmaSignalsByTicker(tickers) {
  const unique = [...new Set((tickers ?? []).map(normalizeTicker).filter(Boolean))];
  if (!unique.length) return {};

  const now = Date.now();
  const byTicker = {};
  const missing = [];

  for (const ticker of unique) {
    const cached = cache.get(ticker);
    if (cached && now - cached.at < CACHE_TTL_MS) {
      byTicker[ticker] = cached.signal;
    } else {
      missing.push(ticker);
    }
  }

  if (!missing.length) return byTicker;

  if (!dmaClient) {
    for (const ticker of missing) {
      const signal = unsureSignal(ticker);
      cache.set(ticker, { signal, at: now });
      byTicker[ticker] = signal;
    }
    return byTicker;
  }

  try {
    for (let i = 0; i < missing.length; i += IN_CHUNK) {
      const chunk = missing.slice(i, i + IN_CHUNK);
      const { data, error } = await dmaClient
        .from('nse_dma_signals')
        .select(
          'symbol, regime, close, dma_50, dma_200, dma_200_slope, as_of_date, pct_vs_50, pct_vs_200'
        )
        .in('symbol', chunk);

      if (error) throw error;

      const found = new Map();
      for (const row of data ?? []) {
        const signal = rowToSignal(row);
        if (!signal?.symbol) continue;
        found.set(signal.symbol, signal);
      }

      for (const ticker of chunk) {
        const signal = found.get(ticker) ?? unsureSignal(ticker);
        cache.set(ticker, { signal, at: now });
        byTicker[ticker] = signal;
      }
    }
  } catch {
    for (const ticker of missing) {
      if (byTicker[ticker]) continue;
      const signal = unsureSignal(ticker);
      cache.set(ticker, { signal, at: now });
      byTicker[ticker] = signal;
    }
  }

  return byTicker;
}

/** Form status map used by Portfolio / Profile holdings UI. */
export async function fetchPortfolioFormByTicker(tickers) {
  const originals = (tickers ?? [])
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
  const signals = await fetchDmaSignalsByTicker(originals);
  const byTicker = {};

  for (const original of originals) {
    const key = normalizeTicker(original);
    const form = signals[key]?.form ?? 'unsure';
    byTicker[key] = form;
    byTicker[original] = form;
  }

  return byTicker;
}
