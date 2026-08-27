import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

const NSE_BASE = 'https://www.nseindia.com';
const NSE_SEED_URL = `${NSE_BASE}/market-data/live-market-indices`;
const NSE_FII_DII_URL = `${NSE_BASE}/reports/fii-dii`;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const LOCK_NAME = 'refresh-fii-dii';

type FiiDiiRow = {
  category?: string;
  date?: string;
  buyValue?: string | number;
  sellValue?: string | number;
  netValue?: string | number;
};

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function createNseSessionCookie(referer: string): Promise<string> {
  const seed = await fetch(referer, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    redirect: 'follow',
  });
  if (!seed.ok) throw new Error(`NSE seed failed: ${seed.status}`);
  return seed.headers.get('set-cookie')?.split(';')[0] ?? '';
}

async function fetchFiiDii(cookie: string): Promise<FiiDiiRow[]> {
  const response = await fetch(`${NSE_BASE}/api/fiidiiTradeReact`, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: '*/*',
      Referer: NSE_FII_DII_URL,
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  if (!response.ok) throw new Error(`NSE fiidiiTradeReact failed: ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
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

  const requestToken = req.headers.get('x-fii-dii-refresh-token') ?? '';
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
    const cookie = await createNseSessionCookie(NSE_FII_DII_URL);
    const rawRows = await fetchFiiDii(cookie);

    const rows = rawRows
      .map((row) => {
        const category = String(row.category ?? '').trim();
        const tradeDate = String(row.date ?? '').trim();
        const buy = numberOrNull(row.buyValue);
        const sell = numberOrNull(row.sellValue);
        const net = numberOrNull(row.netValue);
        if (!category || !tradeDate || buy == null || sell == null || net == null) return null;
        return {
          trade_date: tradeDate,
          category,
          buy_value_cr: buy,
          sell_value_cr: sell,
          net_value_cr: net,
          source: 'nse',
          synced_at: syncedAt,
        };
      })
      .filter(Boolean);

    if (!rows.length) {
      return new Response(JSON.stringify({ ok: false, error: 'No FII/DII rows from NSE' }), { status: 502 });
    }

    const { data: upserted, error: upsertErr } = await client.rpc('bulk_upsert_social_market_fii_dii', {
      p_rows: rows,
    });
    if (upsertErr) throw new Error(upsertErr.message);

    return new Response(
      JSON.stringify({
        ok: true,
        row_count: rows.length,
        upserted: Number(upserted ?? 0),
        trade_date: rows[0]?.trade_date ?? null,
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
