import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

/**
 * IBJA Fine Gold (999) ₹/g writer — SGB premium/discount benchmark.
 */

const IBJA_HOME = 'https://ibja.co/';
const IBJA_GOLD_999_KEY = 'IBJA-GOLD-999';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const LOCK_NAME = 'refresh-ibja-prices';

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/[₹,\s]/g, '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function dateInIst(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** IBJA publish window ~10:00–19:00 IST. */
function isIbjaWindow(now = new Date()): boolean {
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
  return mins >= 10 * 60 && mins <= 19 * 60;
}

function parseIbjaDate(raw: string): string | null {
  const m = String(raw || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function pickById(html: string, id: string): string {
  const re = new RegExp(
    `id=["']${id}["'][^>]*>([^<]*)<|id=["']${id}["'][^>]*value=["']([^"']*)["']`,
    'i',
  );
  const m = html.match(re);
  return (m?.[1] ?? m?.[2] ?? '').trim();
}

async function fetchIbjaGoldRates() {
  const res = await fetch(IBJA_HOME, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`IBJA fetch failed: ${res.status}`);
  const html = await res.text();
  const sessionLabel = pickById(html, 'lblHeaderTextForTimeUnit');
  const session = /\(PM\)/i.test(sessionLabel) ? 'PM' : 'AM';
  const asOfDate = parseIbjaDate(pickById(html, 'lblDate'));
  const fineGold999 = numberOrNull(pickById(html, 'lblFineGold999'));
  if (fineGold999 == null) throw new Error('IBJA Fine Gold (999) rate not found on page');
  return { asOfDate, session, fineGold999 };
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

  const requestToken = req.headers.get('x-ibja-refresh-token') ?? '';
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
  if (!force && !isIbjaWindow()) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'outside-ibja-window' }),
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
    const quote = await fetchIbjaGoldRates();
    const asOfDate = quote.asOfDate || dateInIst();
    const price = quote.fineGold999;

    let previousClose: number | null = null;
    let changePct: number | null = null;
    const { data: prevRows } = await client
      .from('social_market_assets')
      .select('price,as_of_date,previous_close')
      .eq('asset_type', 'commodity')
      .eq('asset_key', IBJA_GOLD_999_KEY)
      .limit(1);
    const prev = prevRows?.[0];
    const prevPrice = prev?.price != null ? Number(prev.price) : null;
    if (
      prevPrice != null &&
      Number.isFinite(prevPrice) &&
      prevPrice > 0 &&
      prev?.as_of_date &&
      prev.as_of_date !== asOfDate
    ) {
      previousClose = prevPrice;
      changePct = ((price - previousClose) / previousClose) * 100;
    } else if (prev?.previous_close != null && Number.isFinite(Number(prev.previous_close))) {
      previousClose = Number(prev.previous_close);
      if (previousClose > 0) changePct = ((price - previousClose) / previousClose) * 100;
    }

    const sessionTag = quote.session ? ` ${quote.session}` : '';
    const assetRow = {
      asset_type: 'commodity',
      asset_key: IBJA_GOLD_999_KEY,
      name: `IBJA Fine Gold (999)${sessionTag}`,
      price,
      change_pct: changePct,
      previous_close: previousClose,
      as_of_date: asOfDate,
      price_source: 'ibja',
      synced_at: syncedAt,
    };

    const { data: upserted, error: upsertErr } = await client.rpc('bulk_upsert_social_market_assets', {
      p_rows: [assetRow],
    });
    if (upsertErr) throw new Error(upsertErr.message);

    let historyUpserted = 0;
    if (writeHistory && asOfDate) {
      const { data: hist, error: histErr } = await client.rpc(
        'bulk_upsert_social_market_price_history',
        {
          p_rows: [
            {
              asset_type: 'commodity',
              asset_key: IBJA_GOLD_999_KEY,
              as_of_date: asOfDate,
              close_price: price,
              previous_close: previousClose,
              change_pct: changePct,
              source: 'ibja',
              synced_at: syncedAt,
            },
          ],
        },
      );
      if (histErr) throw new Error(histErr.message);
      historyUpserted = Number(hist ?? 1);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        price,
        as_of_date: asOfDate,
        session: quote.session,
        assets_upserted: Number(upserted ?? 1),
        history_upserted: historyUpserted,
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
