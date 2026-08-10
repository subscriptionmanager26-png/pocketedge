#!/usr/bin/env node
/**
 * Fetch TradingView analyst recommendations + 1Y price targets for every
 * equity in social_market_assets, and upsert into tradingview_analyst_consensus.
 *
 * Continues past failures (records sync_status = 'error' | 'missing').
 *
 * Usage:
 *   node --env-file=.env scripts/sync-tradingview-analysts.mjs
 *   node scripts/sync-tradingview-analysts.mjs --keys-file=tmp/tickers.json --out=tmp/tv.json --skip-high-low
 *   node --env-file=.env scripts/sync-tradingview-analysts.mjs --limit=50
 */

import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const TV_SCAN_URL = 'https://scanner.tradingview.com/india/scan';
const BATCH_SIZE = Number(process.env.TV_BATCH_SIZE || 80);
const UPSERT_CHUNK = 200;
const HIGH_LOW_CONCURRENCY = Number(process.env.TV_HIGH_LOW_CONCURRENCY || 8);
const REQUEST_GAP_MS = Number(process.env.TV_REQUEST_GAP_MS || 120);

const SCAN_COLUMNS = [
  'name',
  'close',
  'price_target_1y',
  'recommendation_buy',
  'recommendation_hold',
  'recommendation_sell',
  'Recommend.All',
  'description',
];

function optionalEnv(...names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const out = {
    limit: null,
    skipHighLow: false,
    onlyMissing: false,
    keysFile: null,
    out: null,
  };
  for (const arg of argv) {
    if (arg === '--skip-high-low') out.skipHighLow = true;
    if (arg === '--only-missing') out.onlyMissing = true;
    if (arg.startsWith('--limit=')) out.limit = Number(arg.slice('--limit='.length));
    if (arg.startsWith('--keys-file=')) out.keysFile = arg.slice('--keys-file='.length);
    if (arg.startsWith('--out=')) out.out = arg.slice('--out='.length);
  }
  return out;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function toNum(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toInt(value) {
  const n = toNum(value);
  return n == null ? null : Math.round(n);
}

function normalizeTickerRows(keys) {
  const seen = new Set();
  const rows = [];
  for (const row of keys) {
    const assetKey = String(row.asset_key || '')
      .trim()
      .toUpperCase();
    if (!assetKey || seen.has(assetKey)) continue;
    if (/\s/.test(assetKey)) continue;
    seen.add(assetKey);
    rows.push({
      asset_key: assetKey,
      name: row.name || assetKey,
      exchange: (row.exchange || 'NSE').toUpperCase() === 'BSE' ? 'BSE' : 'NSE',
    });
  }
  return rows;
}

async function loadTickersFromFile(keysFile) {
  const raw = JSON.parse(await readFile(keysFile, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.tickers || raw.rows || [];
  return normalizeTickerRows(list);
}

async function fetchTickers(supabase, { limit, onlyMissing }) {
  let keys = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from('social_market_assets')
      .select('asset_key, name, exchange')
      .eq('asset_type', 'stock')
      .not('screener_industry', 'is', null)
      .order('asset_key', { ascending: true })
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    keys.push(...data);
    if (data.length < page) break;
    from += page;
  }

  let rows = normalizeTickerRows(keys);

  if (onlyMissing) {
    const existing = new Set();
    let eFrom = 0;
    for (;;) {
      const { data, error } = await supabase
        .from('tradingview_analyst_consensus')
        .select('asset_key')
        .eq('sync_status', 'ok')
        .range(eFrom, eFrom + page - 1);
      if (error) throw error;
      if (!data?.length) break;
      for (const r of data) existing.add(r.asset_key);
      if (data.length < page) break;
      eFrom += page;
    }
    rows = rows.filter((r) => !existing.has(r.asset_key));
  }

  if (limit != null && Number.isFinite(limit)) rows = rows.slice(0, limit);
  return rows;
}

async function tvScan(tickers) {
  const body = {
    symbols: { tickers, query: { types: [] } },
    columns: SCAN_COLUMNS,
  };
  const res = await fetch(TV_SCAN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://www.tradingview.com',
      Referer: 'https://www.tradingview.com/',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`TV scanner HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function mapScanRow(ticker, d) {
  // ticker like NSE:RELIANCE
  const [exchange, symbol] = ticker.split(':');
  const buy = toInt(d?.[3]);
  const hold = toInt(d?.[4]);
  const sell = toInt(d?.[5]);
  const avg = toNum(d?.[2]);
  const last = toNum(d?.[1]);
  const hasAny =
    avg != null || buy != null || hold != null || sell != null || last != null;
  const analystCount =
    buy != null || hold != null || sell != null
      ? (buy || 0) + (hold || 0) + (sell || 0)
      : null;

  return {
    asset_key: symbol,
    tv_symbol: ticker,
    exchange,
    name: d?.[7] || d?.[0] || symbol,
    last_price: last,
    currency: 'INR',
    target_price_avg: avg,
    target_price_high: null,
    target_price_low: null,
    recommendation_buy: buy,
    recommendation_hold: hold,
    recommendation_sell: sell,
    analyst_count: analystCount && analystCount > 0 ? analystCount : null,
    recommend_technical: toNum(d?.[6]),
    sync_status: hasAny && (avg != null || analystCount) ? 'ok' : 'missing',
    error_message: null,
    raw: { scan: d },
    synced_at: new Date().toISOString(),
  };
}

async function fetchHighLow(symbol, exchange = 'NSE') {
  const url = `https://www.tradingview.com/symbols/${exchange}-${encodeURIComponent(symbol)}/forecast/`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`forecast HTTP ${res.status}`);
  const html = await res.text();
  // "max estimate of 1,870.00 INR and a min estimate of 1,360.00 INR"
  const m = html.match(
    /max estimate of\s+([0-9,.]+)\s*INR\s+and a min estimate of\s+([0-9,.]+)\s*INR/i
  );
  if (!m) return { high: null, low: null };
  const high = Number(String(m[1]).replace(/,/g, ''));
  const low = Number(String(m[2]).replace(/,/g, ''));
  return {
    high: Number.isFinite(high) ? high : null,
    low: Number.isFinite(low) ? low : null,
  };
}

async function upsertRows(supabase, rows) {
  for (const batch of chunk(rows, UPSERT_CHUNK)) {
    const { error } = await supabase
      .from('tradingview_analyst_consensus')
      .upsert(batch, { onConflict: 'asset_key' });
    if (error) throw error;
  }
}

async function mapPool(items, concurrency, worker) {
  let i = 0;
  const results = new Array(items.length);
  async function run() {
    for (;;) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

function missingRow(t, status, message) {
  return {
    asset_key: t.asset_key,
    tv_symbol: `${t.exchange}:${t.asset_key}`,
    exchange: t.exchange,
    name: t.name,
    last_price: null,
    currency: 'INR',
    target_price_avg: null,
    target_price_high: null,
    target_price_low: null,
    recommendation_buy: null,
    recommendation_hold: null,
    recommendation_sell: null,
    analyst_count: null,
    recommend_technical: null,
    sync_status: status,
    error_message: message,
    raw: null,
    synced_at: new Date().toISOString(),
  };
}

async function writeOut(outPath, rows) {
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(rows, null, 0));
  console.log(`Wrote ${rows.length} rows → ${outPath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = optionalEnv('VITE_SUPABASE_URL', 'SUPABASE_URL');
  const serviceKey = optionalEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');
  const anonKey = optionalEnv('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
  const writeKey = serviceKey || anonKey;
  const canWriteDb = Boolean(url && serviceKey);
  const canReadDb = Boolean(url && writeKey);

  if (!args.out && !canWriteDb) {
    throw new Error(
      'No SUPABASE_SERVICE_ROLE_KEY and no --out= path. Pass --out=tmp/tv-analysts.json for scan-only mode.'
    );
  }

  let supabase = null;
  if (canReadDb) {
    supabase = createClient(url, writeKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  let tickers;
  if (args.keysFile) {
    console.log(`Loading tickers from ${args.keysFile}…`);
    tickers = await loadTickersFromFile(args.keysFile);
  } else if (supabase) {
    console.log('Loading tickers from social_market_assets…');
    tickers = await fetchTickers(supabase, args);
  } else {
    throw new Error('Need --keys-file=… or Supabase URL + anon/service key to load tickers.');
  }

  if (args.limit != null && Number.isFinite(args.limit)) {
    tickers = tickers.slice(0, args.limit);
  }
  console.log(`Tickers to process: ${tickers.length}`);

  const byKey = new Map(tickers.map((t) => [t.asset_key, t]));
  const results = new Map();
  let scanned = 0;
  let scanErrors = 0;

  const batches = chunk(tickers, BATCH_SIZE);
  for (let bi = 0; bi < batches.length; bi += 1) {
    const batch = batches[bi];
    const tvTickers = batch.map((t) => `${t.exchange}:${t.asset_key}`);
    try {
      const payload = await tvScan(tvTickers);
      const found = new Set();
      for (const row of payload.data || []) {
        const mapped = mapScanRow(row.s, row.d);
        found.add(mapped.asset_key);
        const base = byKey.get(mapped.asset_key);
        if (base?.name && (!mapped.name || mapped.name === mapped.asset_key)) {
          mapped.name = base.name;
        }
        results.set(mapped.asset_key, mapped);
      }
      for (const t of batch) {
        if (!found.has(t.asset_key) && !results.has(t.asset_key)) {
          results.set(
            t.asset_key,
            missingRow(t, 'missing', 'Not returned by TradingView scanner')
          );
        }
      }
      scanned += batch.length;
      if (bi % 5 === 0 || bi === batches.length - 1) {
        const ok = [...results.values()].filter((r) => r.sync_status === 'ok').length;
        console.log(
          `Scan batch ${bi + 1}/${batches.length} · processed ${scanned}/${tickers.length} · ok so far ${ok}`
        );
      }
    } catch (err) {
      scanErrors += 1;
      console.warn(`Scan batch ${bi + 1} failed: ${err.message}`);
      for (const t of batch) {
        results.set(t.asset_key, missingRow(t, 'error', String(err.message || err).slice(0, 500)));
      }
    }
    await sleep(REQUEST_GAP_MS);
  }

  if (canWriteDb) {
    console.log(`Upserting ${results.size} scan rows…`);
    await upsertRows(supabase, [...results.values()]);
  } else {
    console.log(`Scan-only mode: skipping DB upsert (${results.size} rows in memory).`);
  }

  if (!args.skipHighLow) {
    const needHL = [...results.values()].filter(
      (r) => r.sync_status === 'ok' && r.target_price_avg != null
    );
    console.log(
      `Fetching high/low targets for ${needHL.length} symbols (concurrency ${HIGH_LOW_CONCURRENCY})…`
    );
    let hlDone = 0;
    let hlOk = 0;
    let hlFail = 0;
    const updates = [];

    await mapPool(needHL, HIGH_LOW_CONCURRENCY, async (row) => {
      try {
        const { high, low } = await fetchHighLow(row.asset_key, row.exchange || 'NSE');
        if (high != null || low != null) {
          hlOk += 1;
          const next = {
            ...row,
            target_price_high: high,
            target_price_low: low,
            raw: { ...(row.raw || {}), highLow: { high, low } },
            synced_at: new Date().toISOString(),
          };
          results.set(row.asset_key, next);
          updates.push(next);
        }
      } catch (err) {
        hlFail += 1;
        const next = {
          ...row,
          raw: { ...(row.raw || {}), highLowError: String(err.message || err).slice(0, 200) },
          synced_at: new Date().toISOString(),
        };
        results.set(row.asset_key, next);
        updates.push(next);
      }
      hlDone += 1;
      if (hlDone % 100 === 0 || hlDone === needHL.length) {
        console.log(`High/low progress ${hlDone}/${needHL.length} · found ${hlOk} · fail ${hlFail}`);
        if (canWriteDb && updates.length >= UPSERT_CHUNK) {
          const flush = updates.splice(0, updates.length);
          try {
            await upsertRows(supabase, flush);
          } catch (e) {
            console.warn('HL upsert flush failed:', e.message);
          }
        }
      }
      await sleep(40);
    });

    if (canWriteDb && updates.length) {
      console.log(`Final high/low upsert (${updates.length})…`);
      await upsertRows(supabase, updates);
    }
  }

  const allRows = [...results.values()];
  if (args.out) await writeOut(args.out, allRows);

  const summary = {
    scanned,
    scanErrors,
    ok: allRows.filter((r) => r.sync_status === 'ok').length,
    missing: allRows.filter((r) => r.sync_status === 'missing').length,
    error: allRows.filter((r) => r.sync_status === 'error').length,
    withHighLow: allRows.filter((r) => r.target_price_high != null).length,
    wroteDb: canWriteDb,
    out: args.out || null,
  };
  console.log('Done.');
  console.log(summary);
}


main().catch((err) => {
  console.error(err);
  process.exit(1);
});
