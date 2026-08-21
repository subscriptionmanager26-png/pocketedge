/**
 * MCX commodity spot refresh (Vercel Node) — experimental.
 *
 * MCX WAF currently returns 403 to Vercel serverless as well as Supabase edge.
 * Production refresh uses GitHub Actions schedule
 * (.github/workflows/social-market-price-commodities.yml).
 *
 * Auth: x-commodity-refresh-token == social_market_job_config.auth_token
 *       for job_name = refresh-commodity-prices
 *
 * Body JSON: { force?: boolean, write_history?: boolean }
 */

import { createClient } from '@supabase/supabase-js';
import { supabaseServerConfig } from '../_lib/supabaseServer.js';
import {
  commodityDayChange,
  dateInIst,
  fetchMcxSpotPrices,
  isMcxSession,
  parseMcxDate,
  type ExistingQuote,
} from '../_lib/mcxSpots.js';

export const config = {
  maxDuration: 60,
};

const LOCK_NAME = 'refresh-commodity-prices';
const BATCH_SIZE = 500;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** Node serverless on this project expects named Web handlers, not default+Response. */
export async function POST(request: Request) {
  return handleRefresh(request);
}

export async function GET(request: Request) {
  return handleRefresh(request);
}

async function rpcBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

async function loadExistingCommodityQuotes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

async function handleRefresh(request: Request) {
  const { url, serviceRoleKey } = supabaseServerConfig();
  if (!url || !serviceRoleKey) {
    return json(500, { ok: false, error: 'Missing Supabase envs' });
  }

  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const requestToken = request.headers.get('x-commodity-refresh-token') ?? '';
  const { data: tokenRow, error: tokenErr } = await client
    .from('social_market_job_config')
    .select('auth_token')
    .eq('job_name', LOCK_NAME)
    .maybeSingle();
  if (tokenErr) return json(500, { ok: false, error: tokenErr.message });
  if (!tokenRow?.auth_token || requestToken !== tokenRow.auth_token) {
    return json(401, { ok: false, error: 'Unauthorized' });
  }

  let body: { force?: boolean; write_history?: boolean } = {};
  if (request.method === 'POST') {
    body = (await request.json().catch(() => ({}))) as typeof body;
  } else {
    const u = new URL(request.url);
    body = {
      force: u.searchParams.get('force') === '1',
      write_history: u.searchParams.get('write_history') === '1',
    };
  }
  const force = Boolean(body?.force);
  const writeHistory = Boolean(body?.write_history);

  if (!force && !isMcxSession()) {
    return json(200, { skipped: true, reason: 'outside-mcx-session' });
  }

  const lockOwner = crypto.randomUUID();
  const { data: lockAcquired, error: lockErr } = await client.rpc('acquire_social_market_job_lock', {
    p_job_name: LOCK_NAME,
    p_ttl_seconds: 90,
    p_owner: lockOwner,
  });
  if (lockErr) return json(500, { ok: false, error: lockErr.message });
  if (!lockAcquired) {
    return json(202, { skipped: true, reason: 'lock-not-acquired' });
  }

  try {
    const syncedAt = new Date().toISOString();
    const fallbackDate = dateInIst();
    const [items, existingByKey] = await Promise.all([
      fetchMcxSpotPrices(),
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

    return json(200, {
      ok: true,
      via: 'vercel',
      commodity_count: assetRows.length,
      assets_upserted: assetsUpserted,
      history_upserted: historyUpserted,
      write_history: writeHistory,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json(500, { ok: false, error: message });
  } finally {
    await client.rpc('release_social_market_job_lock', {
      p_job_name: LOCK_NAME,
      p_owner: lockOwner,
    });
  }
}
