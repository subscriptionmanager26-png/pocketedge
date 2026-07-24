import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

/**
 * Parallel NSE stocks + ETFs quote writer (15s path).
 * GitHub Actions equity job remains the backup until this proves stable.
 * Does not touch BSE fallback / SGB — those stay on the GH equity workflow.
 */

const NSE_BASE = 'https://www.nseindia.com';
const NSE_SEED_URL = `${NSE_BASE}/market-data/stocks-traded`;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const LOCK_NAME = 'refresh-equity-prices';
const BATCH_SIZE = 500;

type EquityQuote = {
  symbol: string;
  name: string;
  ltp: number;
  previousClose: number | null;
  changePct: number | null;
  nav?: number | null;
};

type AssetRow = {
  asset_type: 'stock' | 'etf';
  asset_key: string;
  name: string;
  price: number;
  change_pct: number | null;
  previous_close: number | null;
  as_of_date: string;
  price_source: 'nse';
  exchange: 'NSE';
  exchange_symbol: string;
  synced_at: string;
  nav?: number | null;
};

type HistoryRow = {
  asset_type: 'stock' | 'etf';
  asset_key: string;
  as_of_date: string;
  close_price: number;
  previous_close: number | null;
  change_pct: number | null;
  source: 'nse';
  synced_at: string;
};

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
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

/** NSE cash session Mon–Fri 09:15–15:30 IST. */
function isNseCashSession(now = new Date()): boolean {
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

async function createNseSessionCookie(): Promise<string> {
  const seed = await fetch(NSE_SEED_URL, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    redirect: 'follow',
  });
  if (!seed.ok) throw new Error(`NSE seed failed: ${seed.status}`);
  return seed.headers.get('set-cookie')?.split(';')[0] ?? '';
}

async function nseJson(path: string, cookie: string, referer: string): Promise<unknown> {
  const response = await fetch(`${NSE_BASE}${path}`, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: '*/*',
      Referer: referer,
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  if (!response.ok) throw new Error(`NSE ${path} failed: ${response.status}`);
  return response.json();
}

function mapStocksTraded(payload: unknown): EquityQuote[] {
  const root = payload as { total?: { data?: unknown[] }; data?: unknown[] };
  const rows = Array.isArray(root?.total?.data)
    ? root.total!.data!
    : Array.isArray(root?.data)
      ? root.data!
      : [];

  const out: EquityQuote[] = [];
  for (const raw of rows) {
    const row = raw as Record<string, unknown>;
    const meta = (row.meta ?? {}) as Record<string, unknown>;
    const symbol = String(row.symbol ?? '').trim().toUpperCase();
    const ltp = numberOrNull(row.lastPrice);
    if (!symbol || ltp == null) continue;
    out.push({
      symbol,
      name: String(meta.companyName ?? row.companyName ?? symbol).trim() || symbol,
      ltp,
      previousClose: numberOrNull(row.previousClose),
      changePct: numberOrNull(row.pchange),
    });
  }
  return out;
}

function mapEtfs(payload: unknown): EquityQuote[] {
  const root = payload as { data?: unknown[] };
  const rows = Array.isArray(root?.data) ? root.data! : [];
  const out: EquityQuote[] = [];
  for (const raw of rows) {
    const row = raw as Record<string, unknown>;
    const symbol = String(row.symbol ?? '').trim().toUpperCase();
    const ltp = numberOrNull(row.ltP);
    if (!symbol || ltp == null) continue;
    const chn = numberOrNull(row.chn);
    out.push({
      symbol,
      name: String(row.assets ?? symbol).trim() || symbol,
      ltp,
      previousClose: chn != null ? ltp - chn : null,
      changePct: numberOrNull(row.per),
      nav: numberOrNull(row.nav),
    });
  }
  return out;
}

function toAssetRows(
  quotes: EquityQuote[],
  assetType: 'stock' | 'etf',
  asOfDate: string,
  syncedAt: string,
): AssetRow[] {
  return quotes.map((q) => ({
    asset_type: assetType,
    asset_key: q.symbol,
    name: q.name,
    price: q.ltp,
    change_pct: q.changePct,
    previous_close: q.previousClose,
    as_of_date: asOfDate,
    price_source: 'nse',
    exchange: 'NSE',
    exchange_symbol: q.symbol,
    synced_at: syncedAt,
    ...(assetType === 'etf' && q.nav != null ? { nav: q.nav } : {}),
  }));
}

function toHistoryRows(
  quotes: EquityQuote[],
  assetType: 'stock' | 'etf',
  asOfDate: string,
  syncedAt: string,
): HistoryRow[] {
  return quotes.map((q) => ({
    asset_type: assetType,
    asset_key: q.symbol,
    as_of_date: asOfDate,
    close_price: q.ltp,
    previous_close: q.previousClose,
    change_pct: q.changePct,
    source: 'nse',
    synced_at: syncedAt,
  }));
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

  const requestToken = req.headers.get('x-equity-refresh-token') ?? '';
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
  const writeHistory = Boolean(body?.write_history);
  const force = Boolean(body?.force);

  if (!writeHistory && !force && !isNseCashSession()) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'outside-nse-cash-session' }),
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
    return new Response(JSON.stringify({ skipped: true, reason: 'lock-not-acquired' }), { status: 202 });
  }

  try {
    const syncedAt = new Date().toISOString();
    const asOfDate = dateInIst();
    const cookie = await createNseSessionCookie();

    const [stocksPayload, etfPayload] = await Promise.all([
      nseJson('/api/live-analysis-stocksTraded', cookie, NSE_SEED_URL),
      nseJson('/api/etf', cookie, `${NSE_BASE}/market-data/exchange-traded-funds-etf`),
    ]);

    const etfQuotes = mapEtfs(etfPayload);
    const etfSymbols = new Set(etfQuotes.map((q) => q.symbol));
    const stockQuotes = mapStocksTraded(stocksPayload).filter((q) => !etfSymbols.has(q.symbol));

    const assets = [
      ...toAssetRows(stockQuotes, 'stock', asOfDate, syncedAt),
      ...toAssetRows(etfQuotes, 'etf', asOfDate, syncedAt),
    ];

    const assetsUpserted = await rpcBatch(client, 'bulk_upsert_social_market_assets', assets);

    let historyUpserted = 0;
    if (writeHistory) {
      const history = [
        ...toHistoryRows(stockQuotes, 'stock', asOfDate, syncedAt),
        ...toHistoryRows(etfQuotes, 'etf', asOfDate, syncedAt),
      ];
      historyUpserted = await rpcBatch(client, 'bulk_upsert_social_market_price_history', history);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        as_of_date: asOfDate,
        stock_count: stockQuotes.length,
        etf_count: etfQuotes.length,
        assets_upserted: assetsUpserted,
        history_upserted: historyUpserted,
        write_history: writeHistory,
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
