#!/usr/bin/env node
/**
 * Refresh PocketEdge social market quotes from NSE (stocks/ETFs) and AMFI (funds).
 * Also upserts daily close / NAV rows into social_market_price_history.
 *
 * Usage:
 *   node --env-file=.env scripts/refresh-social-market-prices.mjs --mode=all
 *   node --env-file=.env scripts/refresh-social-market-prices.mjs --mode=equity
 *   node --env-file=.env scripts/refresh-social-market-prices.mjs --mode=funds
 *
 * Env:
 *   VITE_SUPABASE_URL / SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (preferred) or VITE_SUPABASE_ANON_KEY with service RPC grants
 */

import { createClient } from '@supabase/supabase-js';
import { parseNavAll } from './lib/indian-markets/amfi.js';
import { SOURCES, UA } from './lib/indian-markets/constants.js';
import {
  createNseSession,
  fetchEtfList,
  fetchStocksTraded,
} from './lib/indian-markets/nse.js';

const BATCH_SIZE = 500;

function requireEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`Missing ${names.join(' or ')}`);
}

function optionalEnv(...names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return null;
}

function parseArgs(argv) {
  const args = { mode: 'all', writeHistory: true };
  for (const arg of argv) {
    if (arg.startsWith('--mode=')) args.mode = arg.slice('--mode='.length);
    if (arg === '--no-history') args.writeHistory = false;
  }
  if (!['all', 'equity', 'funds'].includes(args.mode)) {
    throw new Error(`Invalid --mode=${args.mode}. Use all|equity|funds`);
  }
  return args;
}

/** Calendar date in Asia/Kolkata as YYYY-MM-DD */
function istDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

async function rpcBatch(url, apiKey, fnName, rows) {
  if (!rows.length) return 0;
  const rpcUrl = `${url.replace(/\/$/, '')}/rest/v1/rpc/${fnName}`;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_rows: batch }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${fnName} HTTP ${res.status}: ${text}`);
    }
    const n = await res.json();
    total += typeof n === 'number' ? n : batch.length;
    process.stdout.write(`\r  ${fnName}: ${Math.min(i + batch.length, rows.length)}/${rows.length}`);
  }
  process.stdout.write('\n');
  return total;
}

async function upsertAssets(url, apiKey, rows) {
  return rpcBatch(url, apiKey, 'bulk_upsert_social_market_assets', rows);
}

async function upsertHistory(url, apiKey, rows) {
  return rpcBatch(url, apiKey, 'bulk_upsert_social_market_price_history', rows);
}

function equityAssetRows(quotes, assetType, asOfDate, syncedAt) {
  return quotes
    .filter((q) => q.symbol && q.ltp != null)
    .map((q) => ({
      asset_type: assetType,
      asset_key: q.symbol,
      name: q.name ?? q.symbol,
      price: q.ltp,
      change_pct: q.changePct ?? null,
      previous_close: q.previousClose ?? null,
      as_of_date: asOfDate,
      price_source: 'nse',
      synced_at: syncedAt,
    }));
}

function equityHistoryRows(quotes, assetType, asOfDate, syncedAt) {
  return quotes
    .filter((q) => q.symbol && q.ltp != null)
    .map((q) => ({
      asset_type: assetType,
      asset_key: q.symbol,
      as_of_date: asOfDate,
      close_price: q.ltp,
      previous_close: q.previousClose ?? null,
      change_pct: q.changePct ?? null,
      source: 'nse',
      synced_at: syncedAt,
    }));
}

async function refreshEquity({ url, apiKey, writeHistory, asOfDate, syncedAt }) {
  console.log('Fetching NSE stocks traded + ETF list...');
  const nseFetch = await createNseSession('https://www.nseindia.com/market-data/stocks-traded');
  const [stocks, etfs] = await Promise.all([
    fetchStocksTraded(nseFetch),
    fetchEtfList(nseFetch),
  ]);

  const etfQuotes = etfs.map((row) => ({
    symbol: String(row.symbol ?? '').trim().toUpperCase(),
    name: row.name,
    ltp: row.ltp,
    previousClose: row.previousClose,
    changePct: row.changePct,
  }));

  const stockAssetTypeByKey = new Map();
  for (const q of etfQuotes) {
    if (q.symbol) stockAssetTypeByKey.set(q.symbol, 'etf');
  }

  // Prefer ETF typing when a symbol appears in the ETF list; otherwise stock.
  // Dedupe by symbol within each type (NSE payloads can repeat keys).
  const stockByKey = new Map();
  for (const q of stocks) {
    if (!q.symbol || stockAssetTypeByKey.has(q.symbol)) continue;
    stockByKey.set(q.symbol, { ...q, assetType: 'stock' });
  }
  const etfByKey = new Map();
  for (const q of etfQuotes) {
    if (!q.symbol) continue;
    etfByKey.set(q.symbol, { ...q, assetType: 'etf' });
  }
  const stockQuotes = [...stockByKey.values()];
  const typedEtfs = [...etfByKey.values()];

  const assetRows = [
    ...equityAssetRows(stockQuotes, 'stock', asOfDate, syncedAt),
    ...equityAssetRows(typedEtfs, 'etf', asOfDate, syncedAt),
  ];

  console.log(`Upserting ${assetRows.length} equity quotes (as_of ${asOfDate})...`);
  const equityUpdated = await upsertAssets(url, apiKey, assetRows);

  let historyUpserted = 0;
  if (writeHistory) {
    const historyRows = [
      ...equityHistoryRows(stockQuotes, 'stock', asOfDate, syncedAt),
      ...equityHistoryRows(typedEtfs, 'etf', asOfDate, syncedAt),
    ];
    console.log(`Upserting ${historyRows.length} equity history points...`);
    historyUpserted = await upsertHistory(url, apiKey, historyRows);
  }

  return {
    equityUpdated,
    historyUpserted,
    stockCount: stockQuotes.length,
    etfCount: typedEtfs.length,
  };
}

async function refreshFunds({ url, apiKey, writeHistory, syncedAt }) {
  console.log('Fetching AMFI NAVAll.txt...');
  const res = await fetch(SOURCES.amfiNavAll, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`AMFI fetch failed: ${res.status}`);
  const text = await res.text();
  const schemes = parseNavAll(text);

  const assetByKey = new Map();
  const historyByKey = new Map();
  for (const scheme of schemes) {
    const key = String(scheme.schemeCode ?? '').trim();
    if (!key || scheme.nav == null) continue;
    const asOfDate = scheme.navDate || istDateString();
    assetByKey.set(key, {
      asset_type: 'fund',
      asset_key: key,
      name: scheme.name || key,
      price: scheme.nav,
      change_pct: null,
      previous_close: null,
      as_of_date: asOfDate,
      price_source: 'amfi',
      synced_at: syncedAt,
    });
    if (writeHistory && asOfDate) {
      historyByKey.set(`${key}|${asOfDate}`, {
        asset_type: 'fund',
        asset_key: key,
        as_of_date: asOfDate,
        close_price: scheme.nav,
        previous_close: null,
        change_pct: null,
        source: 'amfi',
        synced_at: syncedAt,
      });
    }
  }
  const assetRows = [...assetByKey.values()];
  const historyRows = [...historyByKey.values()];

  console.log(`Upserting ${assetRows.length} fund NAVs...`);
  const fundUpdated = await upsertAssets(url, apiKey, assetRows);

  let historyUpserted = 0;
  if (writeHistory && historyRows.length) {
    console.log(`Upserting ${historyRows.length} fund history points...`);
    historyUpserted = await upsertHistory(url, apiKey, historyRows);
  }

  return { fundUpdated, historyUpserted, schemeCount: assetRows.length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = requireEnv('VITE_SUPABASE_URL', 'SUPABASE_URL');
  const serviceKey = optionalEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');
  const anonKey = optionalEnv('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
  const apiKey = serviceKey ?? anonKey;
  if (!apiKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY');

  const syncedAt = new Date().toISOString();
  const asOfDate = istDateString();
  console.log(`Mode=${args.mode} as_of=${asOfDate} history=${args.writeHistory}`);

  const supabase = createClient(url, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: run, error: runErr } = await supabase
    .from('social_market_price_fetch_runs')
    .insert({ mode: args.mode, status: 'running', meta: { as_of_date: asOfDate } })
    .select('id')
    .single();
  if (runErr) {
    console.warn('Could not create fetch run row:', runErr.message);
  }
  const runId = run?.id ?? null;

  let equityUpdated = 0;
  let fundUpdated = 0;
  let historyUpserted = 0;
  const meta = { as_of_date: asOfDate };

  try {
    if (args.mode === 'all' || args.mode === 'equity') {
      const eq = await refreshEquity({
        url,
        apiKey,
        writeHistory: args.writeHistory,
        asOfDate,
        syncedAt,
      });
      equityUpdated = eq.equityUpdated;
      historyUpserted += eq.historyUpserted;
      meta.stocks = eq.stockCount;
      meta.etfs = eq.etfCount;
    }

    if (args.mode === 'all' || args.mode === 'funds') {
      const fd = await refreshFunds({
        url,
        apiKey,
        writeHistory: args.writeHistory,
        syncedAt,
      });
      fundUpdated = fd.fundUpdated;
      historyUpserted += fd.historyUpserted;
      meta.funds = fd.schemeCount;
    }

    if (runId) {
      await supabase
        .from('social_market_price_fetch_runs')
        .update({
          status: 'completed',
          finished_at: new Date().toISOString(),
          equity_updated: equityUpdated,
          fund_updated: fundUpdated,
          history_upserted: historyUpserted,
          meta,
        })
        .eq('id', runId);
    }

    console.log(
      `Done. equity=${equityUpdated} funds=${fundUpdated} history=${historyUpserted}`
    );
  } catch (err) {
    if (runId) {
      await supabase
        .from('social_market_price_fetch_runs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          equity_updated: equityUpdated,
          fund_updated: fundUpdated,
          history_upserted: historyUpserted,
          error_message: err?.message ?? String(err),
          meta,
        })
        .eq('id', runId);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
