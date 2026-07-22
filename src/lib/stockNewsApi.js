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

/**
 * Legacy explanations used "## What happened?" / "## Why did it happen?".
 * New prompt outputs short bullet points only — use the full body as summary.
 */
function sectionBody(text, label) {
  const re = new RegExp(
    `#{1,6}\\s*${label}\\??[^\\n]*\\n+([\\s\\S]*?)(?=\\n\\s*-{3,}\\s*(?:\\n|$)|\\n\\s*#{1,6}\\s|$)`,
    'i'
  );
  const match = text.match(re);
  return match ? match[1].trim() : '';
}

/**
 * Map a daily explanation row into an accordion item.
 * Legacy: title = "What happened?", summary = "Why did it happen?".
 * New bullet format: title = date, summary = full explanation.
 */
function mapExplanationRow(row) {
  const asOfDate = row.as_of_date;
  const raw = String(row.explanation ?? '').replace(/\r\n/g, '\n').trim();
  const what = sectionBody(raw, 'What happened');
  const why = sectionBody(raw, 'Why did it happen');
  const isLegacy = Boolean(what || why);

  return {
    id: asOfDate,
    asOfDate,
    publishedAt: asOfDate,
    title: isLegacy
      ? what || formatNewsDate(asOfDate) || asOfDate
      : formatNewsDate(asOfDate) || asOfDate,
    summary: isLegacy ? why || raw : raw,
    confidence: row.confidence ?? null,
    status: row.status,
  };
}

/** Daily AI insights for a ticker, newest first, for the Insights tab. */
export async function fetchStockExplanations(ticker, { limit = 90 } = {}) {
  const symbol = normalizeTicker(ticker);
  if (!symbol || !stockNewsClient) return [];

  const { data, error } = await stockNewsClient
    .from('mn_daily_stock_explanations')
    .select('as_of_date, status, explanation, confidence, generated_at')
    .eq('ticker', symbol)
    .order('as_of_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('fetchStockExplanations failed', error);
    return [];
  }

  return (data ?? [])
    .map(mapExplanationRow)
    .filter((item) => item.status !== 'failed' && item.summary.trim());
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

function parseEventDateMs(raw) {
  if (!raw) return 0;
  const ms = Date.parse(String(raw));
  return Number.isNaN(ms) ? 0 : ms;
}

function mapCorporateActionRow(row) {
  const eventDateRaw = row.event_date_raw ?? '';
  const eventDateMs = parseEventDateMs(eventDateRaw);
  return {
    id: row.id,
    ticker: row.ticker,
    eventType: row.event_type ?? 'Other',
    eventDateRaw,
    eventDateMs,
    dateLabel: row.date_label || '',
    details: row.details ?? '',
    documentUrl: row.document_url ?? '',
    displayDate:
      (eventDateMs ? formatNewsDate(new Date(eventDateMs).toISOString()) : '') ||
      eventDateRaw ||
      '',
  };
}

function sortCorporateActions(rows) {
  return [...rows].sort((a, b) => {
    if (b.eventDateMs !== a.eventDateMs) return b.eventDateMs - a.eventDateMs;
    return String(a.ticker).localeCompare(String(b.ticker));
  });
}

export async function fetchCorporateActions(ticker, { limit = 40 } = {}) {
  const symbol = normalizeTicker(ticker);
  if (!symbol || !stockNewsClient) return [];

  const { data, error } = await stockNewsClient
    .from('mn_corporate_actions')
    .select('id, ticker, event_type, event_date_raw, date_label, details, document_url, last_seen_at')
    .eq('ticker', symbol)
    .limit(Math.min(limit * 3, 200));

  if (error) {
    console.error('fetchCorporateActions failed', error);
    return [];
  }

  return sortCorporateActions((data ?? []).map(mapCorporateActionRow)).slice(0, limit);
}

export async function fetchCorporateActionsForTickers(tickers, { limit = 80 } = {}) {
  const symbols = [...new Set(tickers.map(normalizeTicker).filter(Boolean))];
  if (!symbols.length || !stockNewsClient) return [];

  const { data, error } = await stockNewsClient
    .from('mn_corporate_actions')
    .select('id, ticker, event_type, event_date_raw, date_label, details, document_url, last_seen_at')
    .in('ticker', symbols)
    .limit(Math.min(limit * 4, 400));

  if (error) {
    console.error('fetchCorporateActionsForTickers failed', error);
    return [];
  }

  return sortCorporateActions((data ?? []).map(mapCorporateActionRow)).slice(0, limit);
}
