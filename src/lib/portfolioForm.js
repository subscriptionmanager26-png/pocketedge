import { createClient } from '@supabase/supabase-js';

/**
 * Map momentum-screener regimes → portfolio form labels.
 * Bullish → In Form, Bearish → Off Track, Mixed/Insufficient → Unsure.
 *
 * Signals live in a dedicated Supabase project (momentum-screener),
 * covering equity, ETF, and mutual-fund schemes - not the main
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

/** @deprecated Prefer mapDmaRegimeToForm - kept for any leftover callers. */
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
    description: 'Price is above both the 50-day and 200-day averages - trend looks constructive.',
  },
  out_of_form: {
    id: 'out_of_form',
    label: 'Out of Form',
    shortLabel: 'Out of Form',
    description: 'Price is below both the 50-day and 200-day averages - trend looks weak.',
  },
  unsure: {
    id: 'unsure',
    label: 'Neutral',
    shortLabel: 'Neutral',
    description: 'Mixed or thin signal vs the 50/200-day averages - no clear trend yet.',
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

/** Map holding assetType → nse_dma_signals.asset_class. */
export function toDmaAssetClass(assetType) {
  const value = String(assetType ?? '')
    .trim()
    .toLowerCase();
  if (value === 'etf') return 'etf';
  if (value === 'fund' || value === 'mutual_fund' || value === 'mf') return 'mutual_fund';
  if (value === 'stock' || value === 'equity' || value === 'share') return 'equity';
  return null;
}

function normalizeFormRequest(item) {
  if (item == null) return null;
  if (typeof item === 'string' || typeof item === 'number') {
    const original = String(item).trim();
    const ticker = normalizeTicker(original);
    return ticker ? { original, ticker, preferredClass: null } : null;
  }
  const original = String(item.ticker ?? item.symbol ?? '').trim();
  const ticker = normalizeTicker(original);
  if (!ticker) return null;
  return {
    original,
    ticker,
    preferredClass: toDmaAssetClass(item.assetType ?? item.assetClass),
  };
}

function cacheKey(ticker, preferredClass) {
  return preferredClass ? `${ticker}::${preferredClass}` : ticker;
}

function pickSignalForTicker(rows, preferredClass) {
  if (!rows?.length) return null;
  if (preferredClass) {
    const match = rows.find((row) => row.asset_class === preferredClass);
    if (match) return rowToSignal(match);
  }
  const ranked = [...rows].sort((a, b) => {
    const pa = ASSET_CLASS_PRIORITY[a.asset_class] ?? 9;
    const pb = ASSET_CLASS_PRIORITY[b.asset_class] ?? 9;
    return pa - pb;
  });
  return rowToSignal(ranked[0]);
}

/**
 * Fetch daily DMA classification rows from momentum-screener
 * (`public.nse_dma_signals`) for equity tickers, ETF tickers, or
 * AMFI mutual-fund scheme codes.
 *
 * @param {Array<string|{ticker:string, assetType?:string}>} items
 */
export async function fetchDmaSignalsByTicker(items) {
  const requests = (items ?? []).map(normalizeFormRequest).filter(Boolean);
  if (!requests.length) return {};

  const now = Date.now();
  const byTicker = {};
  const missing = [];

  for (const request of requests) {
    const key = cacheKey(request.ticker, request.preferredClass);
    const cached = cache.get(key);
    if (cached && now - cached.at < CACHE_TTL_MS) {
      byTicker[request.ticker] = cached.signal;
      byTicker[request.original] = cached.signal;
    } else {
      missing.push(request);
    }
  }

  if (!missing.length) return byTicker;

  if (!dmaClient) {
    for (const request of missing) {
      const signal = unsureSignal(request.ticker);
      cache.set(cacheKey(request.ticker, request.preferredClass), { signal, at: now });
      byTicker[request.ticker] = signal;
      byTicker[request.original] = signal;
    }
    return byTicker;
  }

  try {
    const symbols = [...new Set(missing.map((r) => r.ticker))];
    for (let i = 0; i < symbols.length; i += IN_CHUNK) {
      const chunk = symbols.slice(i, i + IN_CHUNK);
      const { data, error } = await dmaClient
        .from('nse_dma_signals')
        .select(
          'asset_class, symbol, regime, close, dma_50, dma_200, dma_200_slope, as_of_date, pct_vs_50, pct_vs_200'
        )
        .in('symbol', chunk)
        .in('asset_class', ['equity', 'etf', 'mutual_fund']);

      if (error) throw error;

      const rowsBySymbol = new Map();
      for (const row of data ?? []) {
        const symbol = String(row.symbol ?? '').toUpperCase();
        if (!symbol) continue;
        if (!rowsBySymbol.has(symbol)) rowsBySymbol.set(symbol, []);
        rowsBySymbol.get(symbol).push(row);
      }

      for (const request of missing.filter((r) => chunk.includes(r.ticker))) {
        const signal =
          pickSignalForTicker(rowsBySymbol.get(request.ticker), request.preferredClass) ??
          unsureSignal(request.ticker);
        cache.set(cacheKey(request.ticker, request.preferredClass), { signal, at: now });
        byTicker[request.ticker] = signal;
        byTicker[request.original] = signal;
      }
    }
  } catch {
    for (const request of missing) {
      if (byTicker[request.ticker]) continue;
      const signal = unsureSignal(request.ticker);
      cache.set(cacheKey(request.ticker, request.preferredClass), { signal, at: now });
      byTicker[request.ticker] = signal;
      byTicker[request.original] = signal;
    }
  }

  return byTicker;
}

/** Form status map used by Portfolio / Profile holdings UI. */
export async function fetchPortfolioFormByTicker(items) {
  const requests = (items ?? []).map(normalizeFormRequest).filter(Boolean);
  const signals = await fetchDmaSignalsByTicker(requests);
  const byTicker = {};

  for (const request of requests) {
    const form = signals[request.ticker]?.form ?? 'unsure';
    byTicker[request.ticker] = form;
    byTicker[request.original] = form;
  }

  return byTicker;
}
