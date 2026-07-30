import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

/**
 * BSE fallback equity LTP writer (intraday).
 * Separate from NSE refresh-equity-prices so pagination cannot stall the 15s path.
 */

const BSE_EQUITY_URL = 'https://api.bseindia.com/BseIndiaAPI/api/GetStkCurrMain_new/w';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const LOCK_NAME = 'refresh-bse-prices';
const BATCH_SIZE = 500;
const PAGE_CONCURRENCY = 24;
const PAGE_TIMEOUT_MS = 8_000;
const FETCH_DEADLINE_MS = 50_000;
const ISIN_PATTERN = /^[A-Z0-9]{12}$/;

type UniverseRow = { symbol: string; isin: string };

type BseQuote = {
  scripCode: string;
  symbol: string;
  name: string;
  ltp: number | null;
  previousClose: number | null;
  changePct: number | null;
};

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(String(value).replaceAll(',', '').replaceAll('%', '').trim());
  return Number.isFinite(n) ? n : null;
}

function dateInIst(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Cash session Mon–Fri 09:15–15:30 IST (same window as NSE cash). */
function isCashSession(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '99');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '99');
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  const mins = hour * 60 + minute;
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function extractRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  const rows = obj.Table ?? obj.Table1 ?? obj.data ?? [];
  return Array.isArray(rows) ? rows : [];
}

async function loadBseUniverse(
  // deno-lint-ignore no-explicit-any
  client: any,
): Promise<UniverseRow[]> {
  const rows: UniverseRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('social_market_bse_universe')
      .select('symbol,isin')
      .order('symbol')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`bse universe load: ${error.message}`);
    const batch = Array.isArray(data) ? data : [];
    for (const row of batch) {
      const symbol = String(row?.symbol ?? '').trim().toUpperCase();
      const isin = String(row?.isin ?? '').trim().toUpperCase();
      if (symbol && ISIN_PATTERN.test(isin)) rows.push({ symbol, isin });
    }
    if (batch.length < pageSize) break;
  }
  if (!rows.length) throw new Error('BSE universe table is empty');
  return rows;
}

function mapBseRow(row: Record<string, unknown>): BseQuote | null {
  const scripCode = String(row?.Symbol ?? '').trim();
  const symbol = String(row?.ScripName ?? '').trim().toUpperCase();
  if (!/^\d+$/.test(scripCode) || !symbol) return null;
  const ltp = numberOrNull(row.Price);
  const previousClose = numberOrNull(row.PreCloseRate);
  const reportedChangePct = numberOrNull(
    row.PercentChange ?? row.PerChange ?? row.PChange ?? row.ChangePercent ?? row.PercentageChange,
  );
  const changePct =
    reportedChangePct ??
    (ltp != null && previousClose != null && previousClose !== 0
      ? ((ltp - previousClose) / previousClose) * 100
      : null);
  return {
    scripCode,
    symbol,
    name: String(row.LongName ?? row.CompanyName ?? row.ScripName ?? symbol).trim(),
    ltp,
    previousClose,
    changePct,
  };
}

function bseHeaders(): Record<string, string> {
  return {
    Accept: 'application/json, text/plain, */*',
    Origin: 'https://beta.bseindia.com',
    Referer: 'https://beta.bseindia.com/',
    'User-Agent': USER_AGENT,
  };
}

async function fetchBsePage(page: number, retries = 2): Promise<unknown> {
  const params = new URLSearchParams({
    flag: 'Equity',
    ddlVal1: 'All',
    ddlVal2: 'All',
    m: '0',
    pgN: String(page),
    srts: 'D',
    srtb: '6',
  });
  let failure: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(`${BSE_EQUITY_URL}?${params}`, {
        headers: bseHeaders(),
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`BSE page ${page} failed: ${response.status}`);
      return await response.json();
    } catch (error) {
      failure = error;
      if (attempt + 1 < retries) await delay(200 * (attempt + 1));
    }
  }
  throw failure instanceof Error ? failure : new Error(String(failure));
}

async function fetchBseEquityQuotes(): Promise<{ quotes: BseQuote[]; pagesOk: number; pagesFailed: number; pageCount: number }> {
  const started = Date.now();
  const firstPayload = await fetchBsePage(1);
  const firstRows = extractRows(firstPayload);
  if (firstRows.length === 0) {
    throw new Error('BSE equity response did not include listing rows');
  }
  const total = numberOrNull(
    (firstPayload as Record<string, unknown>)?.Rcount ??
      (firstPayload as Record<string, unknown>)?.TotalRecords ??
      (firstPayload as Record<string, unknown>)?.total ??
      (firstRows[0] as Record<string, unknown>)?.Rcount,
  );
  const pageCount = total ? Math.ceil(total / firstRows.length) : 1;
  const quotes = new Map<string, BseQuote>();
  for (const row of firstRows) {
    const quote = mapBseRow(row as Record<string, unknown>);
    if (quote) quotes.set(quote.scripCode, quote);
  }

  let pagesOk = 1;
  let pagesFailed = 0;
  const remaining = Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) => i + 2);

  for (let i = 0; i < remaining.length; i += PAGE_CONCURRENCY) {
    if (Date.now() - started > FETCH_DEADLINE_MS) break;
    const batch = remaining.slice(i, i + PAGE_CONCURRENCY);
    const results = await Promise.allSettled(batch.map((page) => fetchBsePage(page)));
    for (const result of results) {
      if (result.status !== 'fulfilled') {
        pagesFailed += 1;
        continue;
      }
      const rows = extractRows(result.value);
      if (!rows.length) {
        pagesFailed += 1;
        continue;
      }
      pagesOk += 1;
      for (const row of rows) {
        const quote = mapBseRow(row as Record<string, unknown>);
        if (quote) quotes.set(quote.scripCode, quote);
      }
    }
  }

  return { quotes: [...quotes.values()], pagesOk, pagesFailed, pageCount };
}

async function loadNseStockSymbols(
  // deno-lint-ignore no-explicit-any
  client: any,
): Promise<Set<string>> {
  const symbols = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('social_market_assets')
      .select('asset_key')
      .eq('asset_type', 'stock')
      .eq('price_source', 'nse')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`nse symbol load: ${error.message}`);
    const rows = Array.isArray(data) ? data : [];
    for (const row of rows) {
      const key = String(row?.asset_key ?? '').trim().toUpperCase();
      if (key) symbols.add(key);
    }
    if (rows.length < pageSize) break;
  }
  return symbols;
}

async function rpcBatch(
  // deno-lint-ignore no-explicit-any
  client: any,
  fnName: string,
  rows: unknown[],
): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await client.rpc(fnName, { p_rows: batch });
    if (error) throw new Error(`${fnName}: ${error.message}`);
    total += Number(data ?? batch.length);
  }
  return total;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase envs' }), { status: 500 });
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const requestToken = req.headers.get('x-bse-refresh-token') ?? '';
  const { data: tokenRow, error: tokenErr } = await client
    .from('social_market_job_config')
    .select('auth_token')
    .eq('job_name', LOCK_NAME)
    .maybeSingle();
  if (tokenErr) {
    return new Response(JSON.stringify({ error: tokenErr.message }), { status: 500 });
  }
  if (!tokenRow?.auth_token || requestToken !== tokenRow.auth_token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const force = Boolean(body?.force);
  if (!force && !isCashSession()) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'outside-cash-session' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const lockOwner = crypto.randomUUID();
  const { data: lockAcquired, error: lockErr } = await client.rpc('acquire_social_market_job_lock', {
    p_job_name: LOCK_NAME,
    p_ttl_seconds: 90,
    p_owner: lockOwner,
  });
  if (lockErr) {
    return new Response(JSON.stringify({ error: lockErr.message }), { status: 500 });
  }
  if (!lockAcquired) {
    return new Response(JSON.stringify({ skipped: true, reason: 'lock-not-acquired' }), {
      status: 202,
    });
  }

  try {
    const syncedAt = new Date().toISOString();
    const asOfDate = dateInIst();
    const universe = await loadBseUniverse(client);
    const [bseFetch, nseSymbols] = await Promise.all([
      fetchBseEquityQuotes(),
      loadNseStockSymbols(client),
    ]);
    const bseQuotes = bseFetch.quotes;

    const universeBySymbol = new Map(universe.map((row) => [row.symbol, row]));
    const candidatesBySymbol = new Map<string, BseQuote[]>();
    for (const quote of bseQuotes) {
      if (!universeBySymbol.has(quote.symbol)) continue;
      const candidates = candidatesBySymbol.get(quote.symbol) ?? [];
      candidates.push(quote);
      candidatesBySymbol.set(quote.symbol, candidates);
    }

    let matched = 0;
    let missing = 0;
    let ambiguous = 0;
    let nseCovered = 0;
    const assetRows: Record<string, unknown>[] = [];
    const isinRows: Record<string, unknown>[] = [];

    for (const [symbol, universeRow] of universeBySymbol) {
      if (nseSymbols.has(symbol)) {
        nseCovered += 1;
        continue;
      }
      const candidates = candidatesBySymbol.get(symbol) ?? [];
      if (candidates.length === 1 && candidates[0].ltp != null) {
        const quote = candidates[0];
        const assetKey = `BSE:${quote.scripCode}`;
        assetRows.push({
          asset_type: 'stock',
          asset_key: assetKey,
          name: quote.name ?? quote.symbol,
          price: quote.ltp,
          change_pct: quote.changePct,
          previous_close: quote.previousClose,
          as_of_date: asOfDate,
          price_source: 'bse',
          exchange: 'BSE',
          exchange_symbol: quote.symbol,
          synced_at: syncedAt,
        });
        if (ISIN_PATTERN.test(universeRow.isin)) {
          isinRows.push({
            asset_type: 'stock',
            asset_key: assetKey,
            isin: universeRow.isin,
            synced_at: syncedAt,
          });
        }
        matched += 1;
      } else if (candidates.length > 1) {
        ambiguous += 1;
      } else {
        missing += 1;
      }
    }

    const assetsUpserted = await rpcBatch(client, 'bulk_upsert_social_market_assets', assetRows);
    let isinsUpserted = 0;
    if (isinRows.length) {
      isinsUpserted = await rpcBatch(client, 'bulk_upsert_social_market_asset_isins', isinRows);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        as_of_date: asOfDate,
        universe: universe.length,
        fetched: bseQuotes.length,
        pages_ok: bseFetch.pagesOk,
        pages_failed: bseFetch.pagesFailed,
        page_count: bseFetch.pageCount,
        matched,
        missing,
        ambiguous,
        nse_covered: nseCovered,
        assets_upserted: assetsUpserted,
        isins_upserted: isinsUpserted,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: message }), { status: 500 });
  } finally {
    await client.rpc('release_social_market_job_lock', {
      p_job_name: LOCK_NAME,
      p_owner: lockOwner,
    });
  }
});
