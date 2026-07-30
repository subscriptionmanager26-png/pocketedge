import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

/**
 * AMFI NAVAll mutual-fund NAV writer (evening poll window).
 */

const AMFI_NAV_ALL = 'https://portal.amfiindia.com/spages/NAVAll.txt';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const LOCK_NAME = 'refresh-fund-navs';
const BATCH_SIZE = 500;
const SCHEME_ROW = /^\s*(\d+)\s*;/;
const ISIN_PATTERN = /^[A-Z0-9]{12}$/;

type ExistingQuote = {
  price: number | null;
  asOfDate: string | null;
  previousClose: number | null;
};

type Scheme = {
  schemeCode: string;
  name: string;
  nav: number | null;
  navDate: string | null;
  isinPayout: string | null;
  isinReinvest: string | null;
};

function dateInIst(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Evening NAV window: 21:30–00:30 IST (wraps midnight). */
function isFundNavWindow(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '99');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '99');
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  const mins = hour * 60 + minute;
  return mins >= 21 * 60 + 30 || mins <= 30;
}

function parseNavDate(value: string | undefined): string | null {
  if (!value) return null;
  const parts = value.trim().split('-');
  if (parts.length !== 3) return value;
  const months: Record<string, string> = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12',
  };
  const month = months[parts[1]];
  if (!month) return value;
  const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
  return `${year}-${month}-${parts[0].padStart(2, '0')}`;
}

function parseCategoryLine(line: string) {
  const match = line.match(
    /^(Open Ended Schemes|Close Ended Schemes|Interval Schemes)\((.+)\)\s*$/i,
  );
  if (!match) return null;
  const schemeType = match[1].trim();
  const inner = match[2].trim();
  const dashIdx = inner.indexOf(' - ');
  if (dashIdx === -1) return { schemeType, category: inner, subCategory: '' };
  return {
    schemeType,
    category: inner.slice(0, dashIdx).trim(),
    subCategory: inner.slice(dashIdx + 3).trim(),
  };
}

function parseNavAll(text: string): Scheme[] {
  const lines = text.split(/\r?\n/);
  let amc = '';
  const schemes: Scheme[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('Scheme Code')) continue;
    if (parseCategoryLine(line)) continue;
    if (SCHEME_ROW.test(line)) {
      const cols = line.split(';').map((c) => c.trim());
      const nav = Number(cols[4]);
      schemes.push({
        schemeCode: cols[0],
        isinPayout: cols[1] && cols[1] !== '-' ? cols[1] : null,
        isinReinvest: cols[2] && cols[2] !== '-' ? cols[2] : null,
        name: cols[3] ?? '',
        nav: Number.isFinite(nav) ? nav : null,
        navDate: parseNavDate(cols[5]),
      });
      continue;
    }
    if (!line.includes(';')) amc = line;
  }
  void amc;
  return schemes;
}

function fundDayChange({
  nav,
  asOfDate,
  existing,
}: {
  nav: number;
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
    changePct: ((nav - previousClose) / previousClose) * 100,
  };
}

async function loadExistingFundQuotes(
  // deno-lint-ignore no-explicit-any
  client: any,
): Promise<Map<string, ExistingQuote>> {
  const map = new Map<string, ExistingQuote>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('social_market_assets')
      .select('asset_key,price,as_of_date,previous_close')
      .eq('asset_type', 'fund')
      .order('asset_key')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`existing funds: ${error.message}`);
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

  const requestToken = req.headers.get('x-fund-refresh-token') ?? '';
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
  const writeHistory = body?.write_history !== false;
  if (!force && !isFundNavWindow()) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'outside-fund-nav-window' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const lockOwner = crypto.randomUUID();
  const { data: lockAcquired, error: lockErr } = await client.rpc('acquire_social_market_job_lock', {
    p_job_name: LOCK_NAME,
    p_ttl_seconds: 140,
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
    const istToday = dateInIst();
    const res = await fetch(AMFI_NAV_ALL, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`AMFI fetch failed: ${res.status}`);
    const text = await res.text();
    const schemes = parseNavAll(text);
    const existingByKey = await loadExistingFundQuotes(client);

    const assetByKey = new Map<string, Record<string, unknown>>();
    const historyByKey = new Map<string, Record<string, unknown>>();
    const fundIsinByValue = new Map<string, Record<string, unknown>>();
    let todayNavCount = 0;

    for (const scheme of schemes) {
      const key = String(scheme.schemeCode ?? '').trim();
      if (!key || scheme.nav == null) continue;
      const asOfDate = scheme.navDate || istToday;
      if (asOfDate === istToday) todayNavCount += 1;
      const { previousClose, changePct } = fundDayChange({
        nav: scheme.nav,
        asOfDate,
        existing: existingByKey.get(key),
      });
      assetByKey.set(key, {
        asset_type: 'fund',
        asset_key: key,
        name: scheme.name || key,
        price: scheme.nav,
        change_pct: changePct,
        previous_close: previousClose,
        as_of_date: asOfDate,
        price_source: 'amfi',
        synced_at: syncedAt,
      });
      for (const isin of [scheme.isinPayout, scheme.isinReinvest]) {
        const value = String(isin ?? '').trim().toUpperCase();
        if (ISIN_PATTERN.test(value)) {
          fundIsinByValue.set(value, {
            asset_type: 'fund',
            asset_key: key,
            isin: value,
            synced_at: syncedAt,
          });
        }
      }
      if (writeHistory && asOfDate) {
        historyByKey.set(`${key}|${asOfDate}`, {
          asset_type: 'fund',
          asset_key: key,
          as_of_date: asOfDate,
          close_price: scheme.nav,
          previous_close: previousClose,
          change_pct: changePct,
          source: 'amfi',
          synced_at: syncedAt,
        });
      }
    }

    const assetRows = [...assetByKey.values()];
    const fundIsinRows = [...fundIsinByValue.values()];
    const historyRows = [...historyByKey.values()];

    try {
      await client.from('social_market_nav_ingest_runs').insert({
        run_at: syncedAt,
        ist_date: istToday,
        total_schemes: assetRows.length,
        today_nav_count: todayNavCount,
        new_date_advances: null,
        date_counts: null,
        source: 'amfi_navall_edge',
        meta: {},
      });
    } catch {
      // Non-fatal telemetry.
    }

    const assetsUpserted = await rpcBatch(client, 'bulk_upsert_social_market_assets', assetRows);
    const isinsUpserted = await rpcBatch(
      client,
      'bulk_upsert_social_market_asset_isins',
      fundIsinRows,
    );
    let historyUpserted = 0;
    if (writeHistory && historyRows.length) {
      historyUpserted = await rpcBatch(
        client,
        'bulk_upsert_social_market_price_history',
        historyRows,
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        scheme_count: assetRows.length,
        today_nav_count: todayNavCount,
        assets_upserted: assetsUpserted,
        isins_upserted: isinsUpserted,
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
