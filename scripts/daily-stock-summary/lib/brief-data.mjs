import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STOCKS_SEARCH_PATH = path.join(__dirname, '..', '..', '..', 'public', 'data', 'markets', 'stocks-search.json');

const EXPLANATIONS_TABLE = 'mn_daily_stock_explanations';
const WHY_HEADING = /##\s*Why did it happen\??/i;
const WHAT_HEADING = /##\s*What happened\??/i;
const DEFAULT_ROWS_PER_PAGE = 5;

export function expandHome(p) {
  const s = String(p ?? '').trim();
  if (!s) return s;
  if (s.startsWith('~/')) return path.join(os.homedir(), s.slice(2));
  return s;
}

function requireEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`Missing ${names.join(' or ')}`);
}

function optionalEnv(...names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return null;
}

function parseCsvRecords(text) {
  const records = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(field);
      field = '';
      if (row.some(cell => cell.length > 0)) records.push(row);
      row = [];
      if (ch === '\r') i++;
    } else if (ch === '\r') {
      row.push(field);
      field = '';
      if (row.some(cell => cell.length > 0)) records.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some(cell => cell.length > 0)) records.push(row);
  }

  return records;
}

function parseCsv(text) {
  const records = parseCsvRecords(text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'));
  if (!records.length) return [];
  const headers = records[0];
  return records.slice(1).map(values => {
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    return row;
  });
}

function parsePriceContext(raw, asOfDate) {
  if (raw == null) return null;

  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (Array.isArray(arr)) {
    if (!arr.length) return null;
    if (asOfDate) {
      const match = arr.find(p => p?.date === asOfDate || p?.as_of_date === asOfDate);
      if (match) return match;
    }
    return arr[0];
  }

  if (typeof arr === 'object') return arr;
  return null;
}

function stripMarkdown(text) {
  return String(text ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseWhyParagraph(explanation) {
  const text = String(explanation ?? '');
  const whyIdx = text.search(WHY_HEADING);
  if (whyIdx < 0) {
    return stripMarkdown(text);
  }

  const start = whyIdx + text.slice(whyIdx).match(WHY_HEADING)[0].length;
  const rest = text.slice(start);
  const nextHeading = rest.search(/\n##\s+/);
  const section = nextHeading >= 0 ? rest.slice(0, nextHeading) : rest;
  const parts = section
    .split(/\n---+\n|\n\n+/)
    .map(stripMarkdown)
    .filter(Boolean);

  return parts.join(' ') || stripMarkdown(section);
}

export function extractHighlights(text) {
  const highlights = new Set();
  const src = String(text ?? '');

  for (const m of src.matchAll(/\*\*(.+?)\*\*/g)) {
    const term = m[1].trim();
    if (term.length >= 3 && term.length <= 60) highlights.add(term);
  }

  for (const m of src.matchAll(/\$[\d,.]+(?:\s*(?:billion|million|B|M))?/gi)) {
    highlights.add(m[0]);
  }

  for (const m of src.matchAll(/\b(?:profit-taking|earnings|guidance|acquisition|deal|margin|results)\b/gi)) {
    highlights.add(m[0]);
  }

  return [...highlights].slice(0, 6);
}

function formatDisplayDate(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso ?? '').toUpperCase();
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

/** Today's date in IST (Asia/Kolkata) as YYYY-MM-DD */
export function todayIst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function createStockNewsClient() {
  const url = optionalEnv('VITE_STOCK_NEWS_SUPABASE_URL', 'STOCK_NEWS_SUPABASE_URL');
  const key = optionalEnv('VITE_STOCK_NEWS_SUPABASE_ANON_KEY', 'STOCK_NEWS_SUPABASE_ANON_KEY');
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function extractChangePct(price) {
  if (!price || typeof price !== 'object') return null;
  const raw = price.changePct ?? price.change_pct;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function mapExplanationRow(row) {
  const price = parsePriceContext(row.price_context, row.as_of_date);
  const explanation = row.explanation || '';
  const why = parseWhyParagraph(explanation);
  return {
    ticker: String(row.ticker || '').toUpperCase(),
    asOfDate: row.as_of_date,
    changePct: extractChangePct(price),
    close: price?.close ?? null,
    previousClose: price?.previousClose ?? price?.previous_close ?? null,
    why,
    highlights: extractHighlights(explanation),
    explanation,
  };
}

/** Keep stocks with a real move of at least ±1%. Drop missing / flat / noise. */
export function filterMeaningfulMoves(rows, { minAbsPct = 1 } = {}) {
  return rows.filter(row => {
    const pct = row.changePct;
    if (pct == null || !Number.isFinite(Number(pct))) return false;
    return Math.abs(Number(pct)) >= minAbsPct;
  });
}

export async function loadExplanationsFromSupabase({ date, tickers, limit } = {}) {
  const client = createStockNewsClient();
  if (!client) {
    throw new Error(
      'Missing VITE_STOCK_NEWS_SUPABASE_URL and VITE_STOCK_NEWS_SUPABASE_ANON_KEY in .env'
    );
  }

  let asOfDate = date || todayIst();

  let query = client
    .from(EXPLANATIONS_TABLE)
    .select('ticker, as_of_date, status, explanation, price_context')
    .eq('as_of_date', asOfDate)
    .eq('status', 'generated');

  if (tickers?.length) {
    query = query.in('ticker', tickers.map(t => t.toUpperCase()));
  }

  const { data, error } = await query;
  if (error) throw new Error(`Supabase explanations fetch failed: ${error.message}`);

  let rows = data ?? [];

  if (!rows.length) {
    const { data: latest, error: latestErr } = await client
      .from(EXPLANATIONS_TABLE)
      .select('as_of_date')
      .eq('status', 'generated')
      .order('as_of_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestErr) throw new Error(`Supabase latest date lookup failed: ${latestErr.message}`);
    if (latest?.as_of_date && latest.as_of_date !== asOfDate) {
      asOfDate = latest.as_of_date;
      console.warn(`No rows for ${date || todayIst()}; using latest date ${asOfDate}`);
      let retry = client
        .from(EXPLANATIONS_TABLE)
        .select('ticker, as_of_date, status, explanation, price_context')
        .eq('as_of_date', asOfDate)
        .eq('status', 'generated');
      if (tickers?.length) retry = retry.in('ticker', tickers.map(t => t.toUpperCase()));
      const { data: retryData, error: retryErr } = await retry;
      if (retryErr) throw new Error(`Supabase explanations fetch failed: ${retryErr.message}`);
      rows = retryData ?? [];
    }
  }

  if (!rows.length) {
    throw new Error(`No explanation rows found for date=${asOfDate}`);
  }

  rows.sort((a, b) => String(a.ticker).localeCompare(String(b.ticker)));

  // Limit is applied after move filtering in buildDigestData.
  void limit;

  return { asOfDate, rows: rows.map(mapExplanationRow) };
}

export function loadExplanationsCsv(csvPath, { date, tickers, limit } = {}) {
  const text = fs.readFileSync(expandHome(csvPath), 'utf8');
  let rows = parseCsv(text).filter(r => String(r.status || '').toLowerCase() === 'generated');

  if (date) {
    rows = rows.filter(r => r.as_of_date === date);
  }

  if (tickers?.length) {
    const set = new Set(tickers.map(t => t.toUpperCase()));
    rows = rows.filter(r => set.has(String(r.ticker || '').toUpperCase()));
  }

  rows.sort((a, b) => {
    const ta = String(a.ticker || '').toUpperCase();
    const tb = String(b.ticker || '').toUpperCase();
    return ta.localeCompare(tb);
  });

  // Limit is applied after move filtering in buildDigestData.
  void limit;

  return rows.map(mapExplanationRow);
}

function loadLocalStockNames() {
  if (!fs.existsSync(STOCKS_SEARCH_PATH)) return new Map();
  const payload = JSON.parse(fs.readFileSync(STOCKS_SEARCH_PATH, 'utf8'));
  const map = new Map();
  for (const item of payload.items ?? []) {
    const key = String(item.symbol || item.id || '').toUpperCase();
    if (key && item.name) map.set(key, item.name);
  }
  return map;
}

function logoStorageKeyCandidates(ticker) {
  const t = String(ticker ?? '').trim().toUpperCase();
  if (!t) return [];
  const sanitized = t.replace(/&/g, '_').replace(/\s+/g, '_');
  const hyphenated = sanitized.replace(/_/g, '-');
  return [...new Set([hyphenated, sanitized, t])];
}

function logoUrlForStorageKey(supabaseUrl, storageKey) {
  const base = String(supabaseUrl || '').replace(/\/$/, '');
  if (!base || !storageKey) return null;
  return `${base}/storage/v1/object/public/asset-logos/stock/${encodeURIComponent(storageKey)}/icon-256.png`;
}

async function resolveLogoUrl(supabaseUrl, ticker) {
  for (const key of logoStorageKeyCandidates(ticker)) {
    const url = logoUrlForStorageKey(supabaseUrl, key);
    if (!url) continue;
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) return url;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

export async function fetchAssetMeta(tickers) {
  const unique = [...new Set(tickers.map(t => String(t || '').toUpperCase()).filter(Boolean))];
  if (!unique.length) return new Map();

  const meta = new Map();
  const localNames = loadLocalStockNames();
  const supabaseUrl = optionalEnv('VITE_SUPABASE_URL', 'SUPABASE_URL');

  const batchSize = 20;
  for (let i = 0; i < unique.length; i += batchSize) {
    const chunk = unique.slice(i, i + batchSize);
    const results = await Promise.all(
      chunk.map(async ticker => {
        const logoUrl = await resolveLogoUrl(supabaseUrl, ticker);
        return [ticker, {
          name: localNames.get(ticker) || ticker,
          logoUrl,
        }];
      }),
    );
    for (const [ticker, info] of results) {
      meta.set(ticker, info);
    }
  }

  return meta;
}

export function buildDigestPages(stocks, { rowsPerPage = DEFAULT_ROWS_PER_PAGE, limit } = {}) {
  // Order by |return| descending so -5% ranks with +5%.
  let sorted = [...stocks].sort((a, b) => {
    const ca = Math.abs(Number(a.changePct) || 0);
    const cb = Math.abs(Number(b.changePct) || 0);
    if (cb !== ca) return cb - ca;
    const sa = Number(a.changePct) || 0;
    const sb = Number(b.changePct) || 0;
    if (sb !== sa) return sb - sa;
    return String(a.ticker).localeCompare(String(b.ticker));
  });

  if (limit != null && limit > 0) {
    sorted = sorted.slice(0, limit);
  }

  const gaining = sorted.filter(s => Number(s.changePct) >= 0).length;
  const falling = sorted.length - gaining;
  const pageCount = Math.max(1, Math.ceil(sorted.length / rowsPerPage));

  const pages = [];
  for (let p = 0; p < pageCount; p++) {
    pages.push({
      page: p + 1,
      pageCount,
      stocks: sorted.slice(p * rowsPerPage, (p + 1) * rowsPerPage),
    });
  }

  return {
    pages,
    stocks: sorted,
    summary: {
      gaining,
      falling,
      total: sorted.length,
      exchange: 'NSE',
    },
  };
}

export async function buildDigestData({
  csvPath,
  date,
  tickers,
  limit,
  rowsPerPage = DEFAULT_ROWS_PER_PAGE,
  fetchMeta = true,
}) {
  let asOfDate;
  let rows;

  if (csvPath) {
    rows = loadExplanationsCsv(csvPath, { date: date || todayIst(), tickers, limit });
    asOfDate = date || rows[0]?.asOfDate;
  } else {
    const loaded = await loadExplanationsFromSupabase({ date, tickers, limit });
    asOfDate = loaded.asOfDate;
    rows = loaded.rows;
  }

  if (!rows.length) {
    throw new Error(`No explanation rows found for date=${asOfDate ?? date ?? todayIst()}`);
  }

  const beforeFilter = rows.length;
  rows = filterMeaningfulMoves(rows, { minAbsPct: 1 });
  const dropped = beforeFilter - rows.length;
  if (dropped > 0) {
    console.warn(
      `Filtered ${dropped} stock(s) with missing or |move| < 1% (${rows.length} remaining of ${beforeFilter})`
    );
  }

  if (!rows.length) {
    throw new Error(
      `No stocks with |price move| ≥ 1% for date=${asOfDate ?? date ?? todayIst()}`
    );
  }

  let meta = new Map();

  if (fetchMeta) {
    meta = await fetchAssetMeta(rows.map(r => r.ticker));
  }

  const stocks = rows.map(row => {
    const m = meta.get(row.ticker) || {};
    const name = m.name || row.ticker;
    const logoText = row.ticker.length > 5 ? row.ticker.slice(0, 5) : row.ticker;
    return {
      ticker: row.ticker,
      name,
      logoUrl: m.logoUrl || null,
      logoText,
      changePct: row.changePct,
      why: row.why,
      highlights: row.highlights,
    };
  });

  const { pages, summary, stocks: sortedStocks } = buildDigestPages(stocks, {
    rowsPerPage,
    limit,
  });

  return {
    asOfDate,
    displayDate: formatDisplayDate(asOfDate),
    summary,
    stocks: sortedStocks,
    pages,
    cta: {
      line1: 'Stay Updated On Your Portfolio with PocketEdge at',
      site: 'www.pocketedge.in',
    },
  };
}
