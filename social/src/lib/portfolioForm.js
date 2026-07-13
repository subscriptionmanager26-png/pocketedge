import { createClient } from '@supabase/supabase-js';

/**
 * Map momentum-screener regimes → portfolio form labels.
 * Bullish → In Form, Bearish → Off Track, Mixed/Insufficient → Unsure.
 *
 * Signals live in a dedicated Supabase project (momentum-screener),
 * covering equity, ETF, and mutual-fund Growth schemes — not the main
 * social PocketEdge project.
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
    description: 'Price is above both the 50-day and 200-day averages — trend looks constructive.',
  },
  out_of_form: {
    id: 'out_of_form',
    label: 'Off Track',
    shortLabel: 'Off Track',
    description: 'Price is below both the 50-day and 200-day averages — trend looks weak.',
  },
  unsure: {
    id: 'unsure',
    label: 'Unsure',
    shortLabel: 'Unsure',
    description: 'Mixed or thin signal vs the 50/200-day averages — no clear trend yet.',
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
    assetClass: row.asset_class ?? null,
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
    assetClass: null,
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

const ASSET_CLASS_PRIORITY = {
  equity: 0,
  etf: 1,
  mutual_fund: 2,
};

/**
 * Fetch daily DMA classification rows from momentum-screener
 * (`public.nse_dma_signals`) for equity tickers, ETF tickers, or
 * AMFI mutual-fund scheme codes.
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
          'asset_class, symbol, regime, close, dma_50, dma_200, dma_200_slope, as_of_date, pct_vs_50, pct_vs_200'
        )
        .in('symbol', chunk)
        .in('asset_class', ['equity', 'etf', 'mutual_fund']);

      if (error) throw error;

      const found = new Map();
      const ranked = [...(data ?? [])].sort((a, b) => {
        const pa = ASSET_CLASS_PRIORITY[a.asset_class] ?? 9;
        const pb = ASSET_CLASS_PRIORITY[b.asset_class] ?? 9;
        return pa - pb;
      });
      for (const row of ranked) {
        const signal = rowToSignal(row);
        if (!signal?.symbol) continue;
        // First hit wins (equity > etf > mutual_fund) if a symbol collides.
        if (!found.has(signal.symbol)) found.set(signal.symbol, signal);
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
