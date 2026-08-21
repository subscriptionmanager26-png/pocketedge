import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

/**
 * MCX spot commodity prices into social_market_assets.
 *
 * Direct mcxindia.com fetch is blocked from Supabase edge (and plain CF Workers).
 * Fetches via Cloudflare Browser Rendering proxy (workers/mcx-spot-proxy).
 *
 * Proxy auth token lives in social_market_job_config.job_name = 'mcx-cf-proxy'
 * (optional env overrides: MCX_PROXY_URL, MCX_PROXY_TOKEN).
 */

const LOCK_NAME = 'refresh-commodity-prices';
const PROXY_JOB_NAME = 'mcx-cf-proxy';
const DEFAULT_PROXY_URL = 'https://mcx-spot-proxy.subscriptionmanager26.workers.dev';
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

async function fetchMcxSpotPrices(
  // deno-lint-ignore no-explicit-any
  client: any,
) {
  const proxyUrl = (Deno.env.get('MCX_PROXY_URL') || DEFAULT_PROXY_URL).replace(/\/$/, '');
  let proxyToken = Deno.env.get('MCX_PROXY_TOKEN') ?? '';
  if (!proxyToken) {
    const { data: proxyRow, error: proxyErr } = await client
      .from('social_market_job_config')
      .select('auth_token')
      .eq('job_name', PROXY_JOB_NAME)
      .maybeSingle();
    if (proxyErr) throw new Error(`mcx proxy config: ${proxyErr.message}`);
    proxyToken = String(proxyRow?.auth_token ?? '');
  }
  if (!proxyToken) {
    throw new Error('Missing MCX proxy token (mcx-cf-proxy / MCX_PROXY_TOKEN)');
  }

  const res = await fetch(proxyUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${proxyToken}`,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  let payload: {
    ok?: boolean;
    error?: string;
    items?: Array<Record<string, unknown>>;
  };
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`MCX proxy non-JSON (${res.status}): ${text.slice(0, 160)}`);
  }
  if (!res.ok || !payload?.ok) {
    throw new Error(`MCX proxy failed: ${res.status} ${payload?.error ?? text.slice(0, 160)}`);
  }

  return (payload.items ?? []).map((row) => ({
    id: String(row.id ?? ''),
    location: String(row.location ?? 'NA'),
    spotPrice: row.spotPrice != null ? Number(row.spotPrice) : null,
    change: row.change != null ? Number(row.change) : null,
    date: row.date != null ? String(row.date) : null,
  }));
}

type ExistingQuote = {
  price: number | null;
  asOfDate: string | null;
  previousClose: number | null;
};

function commodityDayChange({
  price,
  asOfDate,
  existing,
}: {
  price: number;
  asOfDate: string;
  existing: ExistingQuote | undefined;
}) {
  let previousClose: number | null = null;
  if (existing?.asOfDate && existing.asOfDate !== asOfDate && Number.isFinite(existing.price)) {
    previousClose = existing.price;
  } else if (Number.isFinite(existing?.previousClose)) {
    previousClose = existing!.previousClose;
  }
  if (previousClose == null || previousClose === 0) {
    return { previousClose: null, changePct: null };
  }
  return {
    previousClose,
    changePct: ((price - previousClose) / previousClose) * 100,
  };
}

async function loadExistingCommodityQuotes(
  // deno-lint-ignore no-explicit-any
  client: any,
): Promise<Map<string, ExistingQuote>> {
  const map = new Map<string, ExistingQuote>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('social_market_assets')
      .select('asset_key,price,as_of_date,previous_close')
      .eq('asset_type', 'commodity')
      .order('asset_key')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`existing commodities: ${error.message}`);
    const rows = Array.isArray(data) ? data : [];
    for (const row of rows) {
      const key = String(row.asset_key ?? '').trim();
      if (!key) continue;
      map.set(key, {
        price: row.price != null ? Number(row.price) : null,
        asOfDate: row.as_of_date ?? null,
        previousClose: row.previous_close != null ? Number(row.previous_close) : null,
      });
    }
    if (rows.length < pageSize) break;
  }
  return map;
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
    p_ttl_seconds: 120,
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
    const [items, existingByKey] = await Promise.all([
      fetchMcxSpotPrices(client),
      loadExistingCommodityQuotes(client),
    ]);
    const assetByKey = new Map<string, Record<string, unknown>>();
    const historyByKey = new Map<string, Record<string, unknown>>();

    for (const item of items) {
      const symbol = String(item.id ?? '').trim();
      const location = String(item.location ?? 'NA').trim();
      if (!symbol || item.spotPrice == null || !Number.isFinite(item.spotPrice)) continue;
      const assetKey = `${symbol}-${location}`.toUpperCase();
      const rowAsOf = parseMcxDate(item.date, fallbackDate);
      let { previousClose, changePct } = commodityDayChange({
        price: item.spotPrice,
        asOfDate: rowAsOf,
        existing: existingByKey.get(assetKey),
      });
      if (previousClose == null) {
        const change = Number.isFinite(item.change) ? item.change : null;
        previousClose =
          change != null && Number.isFinite(item.spotPrice) ? item.spotPrice - change : null;
        changePct =
          previousClose != null && previousClose !== 0 && change != null
            ? (change / previousClose) * 100
            : null;
      }

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
        via: 'cf-browser-proxy',
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
