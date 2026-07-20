import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

const NSE_BASE = 'https://www.nseindia.com';
const NSE_SEED_URL = `${NSE_BASE}/market-data/live-market-indices`;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const LOCK_NAME = 'refresh-index-prices';

type NseIndexRow = {
  indexSymbol?: string;
  index?: string;
  key?: string | null;
  last?: number | string | null;
  variation?: number | string | null;
  previousClose?: number | string | null;
  percentChange?: number | string | null;
};

type IndexAssetRow = {
  asset_type: 'index';
  asset_key: string;
  name: string;
  price: number;
  change_pct: number | null;
  previous_close: number | null;
  as_of_date: string;
  price_source: 'nse';
  exchange: string | null;
  exchange_symbol: string;
  synced_at: string;
};

type IndexHistoryRow = {
  asset_type: 'index';
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

async function createNseSessionCookie(): Promise<string> {
  const seed = await fetch(NSE_SEED_URL, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    redirect: 'follow',
  });
  if (!seed.ok) throw new Error(`NSE seed failed: ${seed.status}`);
  return seed.headers.get('set-cookie')?.split(';')[0] ?? '';
}

async function fetchNseIndices(cookie: string): Promise<NseIndexRow[]> {
  const response = await fetch(`${NSE_BASE}/api/allIndices`, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: '*/*',
      Referer: NSE_SEED_URL,
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  if (!response.ok) throw new Error(`NSE allIndices failed: ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload?.data) ? payload.data : [];
}

function normalizeRows(indices: NseIndexRow[], asOfDate: string, syncedAt: string): {
  assets: IndexAssetRow[];
  history: IndexHistoryRow[];
} {
  const assets: IndexAssetRow[] = [];
  const history: IndexHistoryRow[] = [];

  for (const row of indices) {
    const symbol = String(row.indexSymbol ?? row.index ?? '').trim().toUpperCase();
    const price = numberOrNull(row.last);
    if (!symbol || price == null) continue;
    const changePct = numberOrNull(row.percentChange);
    const previousClose = numberOrNull(row.previousClose);
    const name = String(row.index ?? row.indexSymbol ?? symbol).trim() || symbol;

    assets.push({
      asset_type: 'index',
      asset_key: symbol,
      name,
      price,
      change_pct: changePct,
      previous_close: previousClose,
      as_of_date: asOfDate,
      price_source: 'nse',
      exchange: row.key ?? null,
      exchange_symbol: symbol,
      synced_at: syncedAt,
    });

    history.push({
      asset_type: 'index',
      asset_key: symbol,
      as_of_date: asOfDate,
      close_price: price,
      previous_close: previousClose,
      change_pct: changePct,
      source: 'nse',
      synced_at: syncedAt,
    });
  }

  return { assets, history };
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

  const requestToken = req.headers.get('x-index-refresh-token') ?? '';
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
  const lockOwner = crypto.randomUUID();

  const { data: lockAcquired, error: lockErr } = await client.rpc('acquire_social_market_job_lock', {
    p_job_name: LOCK_NAME,
    p_ttl_seconds: 110,
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
    const rawRows = await fetchNseIndices(cookie);
    const { assets, history } = normalizeRows(rawRows, asOfDate, syncedAt);

    const { data: updatedAssets, error: assetErr } = await client.rpc('bulk_upsert_social_market_assets', {
      p_rows: assets,
    });
    if (assetErr) throw new Error(assetErr.message);

    let updatedHistory = 0;
    if (writeHistory) {
      const { data: historyCount, error: historyErr } = await client.rpc(
        'bulk_upsert_social_market_price_history',
        { p_rows: history },
      );
      if (historyErr) throw new Error(historyErr.message);
      updatedHistory = Number(historyCount ?? 0);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        as_of_date: asOfDate,
        row_count: assets.length,
        assets_upserted: Number(updatedAssets ?? 0),
        history_upserted: updatedHistory,
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
