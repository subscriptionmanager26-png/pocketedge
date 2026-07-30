import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

const UNIVERSE_CSV = `symbol,isin
SGBDE31III,IN0020230168
SGBFEB32IV,IN0020230184
SGBSEP31II,IN0020230093
SGBAUG28V,IN0020200161
SGBJUN31I,IN0020230069
SGBJAN29IX,IN0020200377
SGBJUL27,IN0020190081
SGBJUL28IV,IN0020200146
SGBSEP28VI,IN0020200195
SGBMR29XII,IN0020200427
SGBDE30III,IN0020220110
SGBN28VIII,IN0020200286
SGBAUG30,IN0020220078
SGBMAR31IV,IN0020220169
SGBAPR28I,IN0020200062
SGBNV29VII,IN0020210178
SGBMAR28X,IN0020190552
SGBSEP29VI,IN0020210145
SGBMAY29I,IN0020210053
SGBJUN29II,IN0020210061
SGBAUG29V,IN0020210129
SGBFEB29XI,IN0020200393
SGBJU29III,IN0020210087
SGBMAR30X,IN0020210319
SGBD29VIII,IN0020210228
SGBJAN27,IN0020180462
SGBJAN29X,IN0020200385
SGBJAN30IX,IN0020210236
SGBDC27VII,IN0020190461
SGBAUG27,IN0020190107
SGBJUN30,IN0020220045
SGBOC28VII,IN0020200203
SGBSEP27,IN0020190115
SGBJUL29IV,IN0020210111
SGBJUN28,IN0020200104
SGBDEC26,IN0020180389
SGBOCT27VI,IN0020190388
SGBOCT27,IN0020190370
SGBMAY28,IN0020200088
SGBFEB28IX,IN0020190545
SGBNOV26,IN0020180314
SGBFEB27,IN0020180561
SGBOCT26,IN0020180249
SGBJ28VIII,IN0020190537
SGBJUN27,IN0020190073
`;

/**
 * NSE Sovereign Gold Bond LTP writer (intraday).
 * Separate from refresh-equity-prices so SGB latency cannot stall stock/ETF ticks.
 */

const NSE_BASE = 'https://www.nseindia.com';
const NSE_SEED_URL = `${NSE_BASE}/market-data/sovereign-gold-bond`;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const LOCK_NAME = 'refresh-sgb-prices';
const BATCH_SIZE = 500;
const ISIN_PATTERN = /^[A-Z0-9]{12}$/;

type UniverseRow = { symbol: string; isin: string };

type SgbQuote = {
  symbol: string;
  name: string;
  ltp: number;
  previousClose: number | null;
  changePct: number | null;
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

function parseUniverseCsv(text: string): UniverseRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((c) => c.trim().toLowerCase());
  const symbolIndex = header.indexOf('symbol');
  const isinIndex = header.indexOf('isin');
  if (symbolIndex < 0 || isinIndex < 0) {
    throw new Error('SGB universe must contain symbol and isin columns');
  }
  const seenSymbols = new Set<string>();
  const seenIsins = new Set<string>();
  const rows: UniverseRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(',').map((c) => c.trim());
    const symbol = String(cols[symbolIndex] ?? '').toUpperCase();
    const isin = String(cols[isinIndex] ?? '').toUpperCase();
    if (!symbol || !ISIN_PATTERN.test(isin) || seenSymbols.has(symbol) || seenIsins.has(isin)) {
      continue;
    }
    seenSymbols.add(symbol);
    seenIsins.add(isin);
    rows.push({ symbol, isin });
  }
  return rows;
}

async function createNseSessionCookie(): Promise<string> {
  const seed = await fetch(NSE_SEED_URL, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    redirect: 'follow',
  });
  if (!seed.ok) throw new Error(`NSE seed failed: ${seed.status}`);
  return seed.headers.get('set-cookie')?.split(';')[0] ?? '';
}

async function fetchSgbQuotes(cookie: string): Promise<SgbQuote[]> {
  const response = await fetch(
    `${NSE_BASE}/api/NextApi/apiClient/marketWatchApi?functionName=getSGBData`,
    {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
        Referer: NSE_SEED_URL,
        ...(cookie ? { Cookie: cookie } : {}),
      },
    },
  );
  if (!response.ok) throw new Error(`NSE SGB failed: ${response.status}`);
  const payload = await response.json();
  const rows = payload?.data?.data ?? payload?.data ?? [];
  if (!Array.isArray(rows)) return [];

  const out: SgbQuote[] = [];
  for (const raw of rows) {
    const row = raw as Record<string, unknown>;
    const symbol = String(row?.symbol ?? '').trim().toUpperCase();
    const ltp = numberOrNull(row?.lastPrice);
    if (!symbol || ltp == null) continue;
    out.push({
      symbol,
      name: String(row?.companyName ?? symbol).trim(),
      ltp,
      previousClose: numberOrNull(row?.previousClose),
      changePct: numberOrNull(row?.pChange ?? row?.PChange),
    });
  }
  return out;
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

  const requestToken = req.headers.get('x-sgb-refresh-token') ?? '';
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
    p_ttl_seconds: 60,
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
    const universeText = UNIVERSE_CSV;
    const universe = parseUniverseCsv(universeText);
    const cookie = await createNseSessionCookie();
    const quotes = await fetchSgbQuotes(cookie);
    const quoteBySymbol = new Map(quotes.map((q) => [q.symbol, q]));

    const assetRows: Record<string, unknown>[] = [];
    const isinRows: Record<string, unknown>[] = [];
    let missing = 0;
    for (const item of universe) {
      const quote = quoteBySymbol.get(item.symbol);
      if (!quote) {
        missing += 1;
        continue;
      }
      assetRows.push({
        asset_type: 'bond',
        asset_key: item.symbol,
        name: quote.name,
        price: quote.ltp,
        change_pct: quote.changePct,
        previous_close: quote.previousClose,
        as_of_date: asOfDate,
        price_source: 'nse_sgb',
        exchange: 'NSE',
        exchange_symbol: item.symbol,
        synced_at: syncedAt,
      });
      isinRows.push({
        asset_type: 'bond',
        asset_key: item.symbol,
        isin: item.isin,
        synced_at: syncedAt,
      });
    }

    const assetsUpserted = await rpcBatch(client, 'bulk_upsert_social_market_assets', assetRows);
    const isinsUpserted = await rpcBatch(client, 'bulk_upsert_social_market_asset_isins', isinRows);

    return new Response(
      JSON.stringify({
        ok: true,
        as_of_date: asOfDate,
        universe: universe.length,
        fetched: quotes.length,
        matched: assetRows.length,
        missing,
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
