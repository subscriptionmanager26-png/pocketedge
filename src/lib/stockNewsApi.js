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

/** Map AI digest rows — UI shows bullets, never the raw article body. */
function mapAiNewsSummaryRow(row) {
  const publishedAt = row.generated_at ?? row.as_of_date ?? null;
  return {
    id: row.id,
    ticker: normalizeTicker(row.ticker),
    title: row.title || row.subject || 'Update',
    summary: String(row.ai_bullets ?? '').trim(),
    publishedAt,
    time: publishedAt ? formatNewsDate(publishedAt) : '',
    source: row.external_id ?? null,
  };
}

function isZerodhaNewsRow(row) {
  const external = String(row?.external_id ?? row?.source ?? '').toLowerCase();
  if (external.includes('zerodha')) return true;
  const sources = row?.source_external_ids;
  if (Array.isArray(sources) && sources.some((id) => String(id).toLowerCase().includes('zerodha'))) {
    return true;
  }
  return false;
}

function finalizeNewsItems(rows, limit) {
  return (rows ?? [])
    .filter((row) => !isZerodhaNewsRow(row))
    .map(mapAiNewsSummaryRow)
    .filter((item) => item.summary)
    .slice(0, limit);
}

export async function fetchStockNews(ticker, { limit = 20 } = {}) {
  const symbol = normalizeTicker(ticker);
  if (!symbol || !stockNewsClient) return [];

  const { data, error } = await stockNewsClient
    .from('mn_news_ai_summaries')
    .select(
      'id, ticker, title, subject, ai_bullets, as_of_date, generated_at, external_id, source_external_ids, type'
    )
    .eq('ticker', symbol)
    .eq('type', 'Stock')
    .not('external_id', 'ilike', '%zerodha%')
    .order('generated_at', { ascending: false, nullsFirst: false })
    .limit(Math.min(limit * 2, 80));

  if (error) {
    console.error('fetchStockNews failed', error);
    return [];
  }

  return finalizeNewsItems(data, limit);
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

function parseFiniteNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Explanation rows store recent closes in price_context:
 * [{ date, close, changePct, previousClose }, ...]
 * Only the point matching as_of_date is used — never fall back to another day.
 */
export function quoteFromPriceContext(priceContext, asOfDate = null) {
  if (!Array.isArray(priceContext) || !priceContext.length || asOfDate == null) {
    return { changePct: null, price: null, previousClose: null };
  }

  const point = priceContext.find((row) => String(row?.date ?? '') === String(asOfDate));
  if (!point) {
    return { changePct: null, price: null, previousClose: null };
  }

  return {
    changePct: parseFiniteNumber(point?.changePct ?? point?.change_pct),
    price: parseFiniteNumber(point?.close ?? point?.price),
    previousClose: parseFiniteNumber(point?.previousClose ?? point?.previous_close),
  };
}

/**
 * Map a daily explanation row into an accordion item.
 * Legacy: title = "What happened?", summary = "Why did it happen?".
 * New bullet format: title = date, summary = full explanation.
 * Move % is only derived for stocks from price_context.
 */
function mapExplanationRow(row) {
  const asOfDate = row.as_of_date;
  const assetType = row.asset_type || 'stock';
  const raw = String(row.explanation ?? '').replace(/\r\n/g, '\n').trim();
  const what = sectionBody(raw, 'What happened');
  const why = sectionBody(raw, 'Why did it happen');
  const isLegacy = Boolean(what || why);
  const quote =
    assetType === 'stock' ? quoteFromPriceContext(row.price_context, asOfDate) : null;

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
    assetType,
    changePct: quote?.changePct ?? null,
    price: quote?.price ?? null,
  };
}

function keepExplanationItem(item) {
  if (item.status === 'failed' || !item.summary.trim()) return false;
  // Stock insights without an as-of price are stale / incomplete — never surface them.
  if (item.assetType === 'stock' && !Number.isFinite(item.changePct)) return false;
  return true;
}

/** Daily AI insights for a ticker, newest first, for the Insights tab. */
export async function fetchStockExplanations(ticker, { limit = 90 } = {}) {
  const symbol = normalizeTicker(ticker);
  if (!symbol || !stockNewsClient) return [];

  const { data, error } = await stockNewsClient
    .from('mn_daily_stock_explanations')
    .select('as_of_date, status, explanation, confidence, generated_at, asset_type, price_context')
    .eq('ticker', symbol)
    .order('as_of_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('fetchStockExplanations failed', error);
    return [];
  }

  return (data ?? []).map(mapExplanationRow).filter(keepExplanationItem);
}

function mapExplanationFeedRow(row) {
  const mapped = mapExplanationRow(row);
  return {
    ...mapped,
    id: `${row.ticker}-${row.as_of_date}`,
    ticker: normalizeTicker(row.ticker),
  };
}

/** Newest as_of_date available for an asset class (stock / index / commodity / economics). */
export async function fetchLatestExplanationDate(assetType = 'stock') {
  if (!stockNewsClient) return null;

  let query = stockNewsClient
    .from('mn_daily_stock_explanations')
    .select('as_of_date')
    .neq('status', 'failed')
    .order('as_of_date', { ascending: false })
    .limit(1);

  if (assetType) {
    query = query.eq('asset_type', assetType);
  }

  const { data, error } = await query;
  if (error) {
    console.error('fetchLatestExplanationDate failed', error);
    return null;
  }

  return data?.[0]?.as_of_date ?? null;
}

/**
 * Browse daily explanation summaries across tickers.
 * assetType: stock | index | commodity | economics
 * Price context is only selected for stocks — indices/commodities/economics have no move %.
 */
export async function fetchExplanationFeed({
  assetType = 'stock',
  asOfDate = null,
  tickers = null,
  limit = 80,
} = {}) {
  if (!stockNewsClient) return [];

  const wantsPrices = assetType === 'stock';
  const columns = wantsPrices
    ? 'ticker, as_of_date, status, explanation, confidence, generated_at, asset_type, price_context'
    : 'ticker, as_of_date, status, explanation, confidence, generated_at, asset_type';

  let query = stockNewsClient
    .from('mn_daily_stock_explanations')
    .select(columns)
    .neq('status', 'failed')
    .order('as_of_date', { ascending: false })
    .limit(limit);

  if (assetType) query = query.eq('asset_type', assetType);
  if (asOfDate) query = query.eq('as_of_date', asOfDate);

  const symbols = Array.isArray(tickers)
    ? [...new Set(tickers.map(normalizeTicker).filter(Boolean))]
    : [];
  if (symbols.length === 1) query = query.eq('ticker', symbols[0]);
  else if (symbols.length > 1) query = query.in('ticker', symbols);

  const { data, error } = await query;
  if (error) {
    console.error('fetchExplanationFeed failed', error);
    return [];
  }

  return (data ?? []).map(mapExplanationFeedRow).filter(keepExplanationItem);
}

function mapIndustryExplanationFeedRow(row) {
  const industry = String(row.industry ?? '').trim();
  const slug = String(row.industry_slug ?? '').trim();
  const asOfDate = row.as_of_date;
  const raw = String(row.explanation ?? '').replace(/\r\n/g, '\n').trim();

  return {
    id: `${slug || industry}-${asOfDate}`,
    // Reuse Insights card fields: non-stock scopes render `ticker` as the title.
    ticker: industry,
    name: '',
    industry: '',
    industrySlug: slug || null,
    asOfDate,
    publishedAt: asOfDate,
    title: formatNewsDate(asOfDate) || asOfDate,
    summary: raw,
    confidence: row.confidence ?? null,
    status: row.status,
    assetType: 'industry',
    changePct: null,
    price: null,
  };
}

/**
 * Browse daily industry explainers from mn_daily_industry_explanations.
 * No price_context / move % — same UX as indices / commodities / economy.
 */
export async function fetchIndustryExplanationFeed({ asOfDate = null, limit = 200 } = {}) {
  if (!stockNewsClient) return [];

  let query = stockNewsClient
    .from('mn_daily_industry_explanations')
    .select('industry, industry_slug, as_of_date, status, explanation, confidence, generated_at')
    .neq('status', 'failed')
    .order('industry', { ascending: true })
    .limit(limit);

  if (asOfDate) query = query.eq('as_of_date', asOfDate);

  const { data, error } = await query;
  if (error) {
    console.error('fetchIndustryExplanationFeed failed', error);
    return [];
  }

  return (data ?? [])
    .map(mapIndustryExplanationFeedRow)
    .filter((item) => item.status !== 'failed' && item.summary.trim() && item.ticker);
}

export async function fetchStockNewsForTickers(tickers, { limit = 50 } = {}) {
  const symbols = [...new Set(tickers.map(normalizeTicker).filter(Boolean))];
  if (!symbols.length || !stockNewsClient) return [];

  const { data, error } = await stockNewsClient
    .from('mn_news_ai_summaries')
    .select(
      'id, ticker, title, subject, ai_bullets, as_of_date, generated_at, external_id, source_external_ids, type'
    )
    .in('ticker', symbols)
    .eq('type', 'Stock')
    .not('external_id', 'ilike', '%zerodha%')
    .order('generated_at', { ascending: false, nullsFirst: false })
    .limit(Math.min(limit * 2, 200));

  if (error) {
    console.error('fetchStockNewsForTickers failed', error);
    return [];
  }

  return finalizeNewsItems(data, limit);
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
