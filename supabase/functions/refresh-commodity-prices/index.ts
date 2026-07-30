import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

/**
 * MCX spot commodity prices into social_market_assets.
 */

const MCX_SEED = 'https://www.mcxindia.com/market-data/spot-market-price';
const MCX_API = 'https://www.mcxindia.com/GetSpotMarketPrice?culture=en';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const LOCK_NAME = 'refresh-commodity-prices';
const BATCH_SIZE = 500;

function dateInIst(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** MCX session Mon–Fri 09:00–23:30 IST. */
function isMcxSession(now = new Date()): boolean {
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
  return mins >= 9 * 60 && mins <= 23 * 60 + 30;
}

function parseMcxDate(formatted: string | null, fallback: string): string {
  if (!formatted) return fallback;
  const parsed = Date.parse(`${formatted} UTC`);
  if (!Number.isFinite(parsed)) return fallback;
  return dateInIst(new Date(parsed));
}

async function fetchMcxSpotPrices() {
  const home = await fetch(MCX_SEED, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    redirect: 'follow',
  });
  if (!home.ok) throw new Error(`MCX seed failed: ${home.status}`);
  const setCookie = home.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(',').map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');

  const res = await fetch(MCX_API, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      Referer: MCX_SEED,
    },
  });
  if (!res.ok) throw new Error(`MCX spot fetch failed: ${res.status}`);
  const payload = await res.json();
  const items = (payload?.Data?.Data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.enSymbol ?? row.symbol ?? ''),
    location: String(row.enlocation ?? row.location ?? 'NA'),
    spotPrice: row.todaysSpotPrice != null ? Number(row.todaysSpotPrice) : null,
    change: row.change != null ? Number(row.change) : null,
    date: row.FormattedDate != null ? String(row.FormattedDate) : null,
  }));
  return items;
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

  const requestToken = req.headers.get('x-commodity-refresh-token') ?? '';
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
  const writeHistory = Boolean(body?.write_history);
  if (!force && !isMcxSession()) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'outside-mcx-session' }),
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
    const fallbackDate = dateInIst();
    const items = await fetchMcxSpotPrices();
    const assetByKey = new Map<string, Record<string, unknown>>();
    const historyByKey = new Map<string, Record<string, unknown>>();

    for (const item of items) {
      const symbol = String(item.id ?? '').trim();
      const location = String(item.location ?? 'NA').trim();
      if (!symbol || item.spotPrice == null || !Number.isFinite(item.spotPrice)) continue;
      const assetKey = `${symbol}-${location}`.toUpperCase();
      const rowAsOf = parseMcxDate(item.date, fallbackDate);
      const change = Number.isFinite(item.change) ? item.change : null;
      const previousClose =
        change != null && Number.isFinite(item.spotPrice) ? item.spotPrice - change : null;
      const changePct =
        previousClose != null && previousClose !== 0 ? (change! / previousClose) * 100 : null;

      assetByKey.set(assetKey, {
        asset_type: 'commodity',
        asset_key: assetKey,
        name: symbol,
        price: item.spotPrice,
        change_pct: changePct,
        previous_close: previousClose,
        as_of_date: rowAsOf,
        price_source: 'mcx',
        synced_at: syncedAt,
      });

      if (writeHistory && rowAsOf) {
        historyByKey.set(`${assetKey}|${rowAsOf}`, {
          asset_type: 'commodity',
          asset_key: assetKey,
          as_of_date: rowAsOf,
          close_price: item.spotPrice,
          previous_close: previousClose,
          change_pct: changePct,
          source: 'mcx',
          synced_at: syncedAt,
        });
      }
    }

    const assetRows = [...assetByKey.values()];
    const assetsUpserted = await rpcBatch(client, 'bulk_upsert_social_market_assets', assetRows);
    let historyUpserted = 0;
    if (writeHistory && historyByKey.size) {
      historyUpserted = await rpcBatch(client, 'bulk_upsert_social_market_price_history', [
        ...historyByKey.values(),
      ]);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        commodity_count: assetRows.length,
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
