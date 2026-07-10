import { createClient } from '@supabase/supabase-js';
import { formatNewsDate } from './format';

const newsSupabaseUrl = import.meta.env.VITE_STOCK_NEWS_SUPABASE_URL;
const newsSupabaseAnonKey = import.meta.env.VITE_STOCK_NEWS_SUPABASE_ANON_KEY;

const stockNewsClient =
  newsSupabaseUrl && newsSupabaseAnonKey
    ? createClient(newsSupabaseUrl, newsSupabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export function isStockNewsConfigured() {
  return Boolean(stockNewsClient);
}

function normalizeTicker(ticker) {
  return String(ticker ?? '')
    .trim()
    .toUpperCase();
}

function mapNewsRow(row) {
  const publishedAt = row.published_at ?? row.first_seen_at;
  return {
    id: row.id,
    ticker: row.ticker,
    title: row.title,
    summary: row.summary ?? '',
    publishedAt,
    time: publishedAt ? formatNewsDate(publishedAt) : '',
  };
}

export async function fetchStockNews(ticker, { limit = 20 } = {}) {
  const symbol = normalizeTicker(ticker);
  if (!symbol || !stockNewsClient) return [];

  const { data, error } = await stockNewsClient
    .from('mn_latest_news')
    .select('id, ticker, title, summary, published_at, source, first_seen_at')
    .eq('ticker', symbol)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error('fetchStockNews failed', error);
    return [];
  }

  return (data ?? []).map(mapNewsRow);
}

export async function fetchStockNewsForTickers(tickers, { limit = 50 } = {}) {
  const symbols = [...new Set(tickers.map(normalizeTicker).filter(Boolean))];
  if (!symbols.length || !stockNewsClient) return [];

  const { data, error } = await stockNewsClient
    .from('mn_latest_news')
    .select('id, ticker, title, summary, published_at, source, first_seen_at')
    .in('ticker', symbols)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error('fetchStockNewsForTickers failed', error);
    return [];
  }

  return (data ?? []).map(mapNewsRow);
}
