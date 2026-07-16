#!/usr/bin/env node
/**
 * Refresh PocketEdge social market quotes from NSE (stocks/ETFs), AMFI (funds),
 * and MCX (commodities). Also upserts daily close / NAV / spot rows into
 * social_market_price_history.
 *
 * Usage:
 *   node --env-file=.env scripts/refresh-social-market-prices.mjs --mode=all
 *   node --env-file=.env scripts/refresh-social-market-prices.mjs --mode=equity
 *   node --env-file=.env scripts/refresh-social-market-prices.mjs --mode=funds
 *   node --env-file=.env scripts/refresh-social-market-prices.mjs --mode=commodities
 *
 * Env:
 *   VITE_SUPABASE_URL / SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (preferred)
 */

import { parseNavAll } from './lib/indian-markets/amfi.js';
import { fetchBseEquityQuotes, loadBseFallbackUniverse } from './lib/indian-markets/bse.js';
import { SOURCES, UA } from './lib/indian-markets/constants.js';
import { fetchMcxSpotPrices } from './lib/indian-markets/mcx.js';
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
  const args = { mode: 'all', writeHistory: true, dryRun: false };
  for (const arg of argv) {
    if (arg.startsWith('--mode=')) args.mode = arg.slice('--mode='.length);
    if (arg === '--no-history') args.writeHistory = false;
    if (arg === '--dry-run') args.dryRun = true;
  }
  if (!['all', 'equity', 'funds', 'commodities'].includes(args.mode)) {
    throw new Error(`Invalid --mode=${args.mode}. Use all|equity|funds|commodities`);
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

/** Parse MCX FormattedDate like "13 Jul 2026" → YYYY-MM-DD, else fallback. */
function parseMcxDate(formatted, fallback = istDateString()) {
  if (!formatted) return fallback;
  const parsed = Date.parse(`${formatted} UTC`);
  if (!Number.isFinite(parsed)) return fallback;
  return istDateString(new Date(parsed));
}

function restHeaders(apiKey) {
  return {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

async function insertFetchRun(url, apiKey, row) {
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/social_market_price_fetch_runs`, {
    method: 'POST',
    headers: restHeaders(apiKey),
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`insert fetch run HTTP ${res.status}: ${text}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function updateFetchRun(url, apiKey, id, patch) {
  const res = await fetch(
    `${url.replace(/\/$/, '')}/rest/v1/social_market_price_fetch_runs?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: restHeaders(apiKey),
      body: JSON.stringify(patch),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`update fetch run HTTP ${res.status}: ${text}`);
  }
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

/** Existing fund rows keyed by scheme code — used to derive day change vs prior NAV. */
async function fetchExistingFundQuotes(url, apiKey) {
  const base = url.replace(/\/$/, '');
  const map = new Map();
  const pageSize = 1000;
  let from = 0;

  for (;;) {
    const to = from + pageSize - 1;
    const res = await fetch(
      `${base}/rest/v1/social_market_assets?asset_type=eq.fund&select=asset_key,price,as_of_date,previous_close&order=asset_key.asc`,
      {
        headers: {
          ...restHeaders(apiKey),
          Range: `${from}-${to}`,
          Prefer: 'count=exact',
        },
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`fetch existing funds HTTP ${res.status}: ${text}`);
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
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
    from += pageSize;
  }

  return map;
}

function fundDayChange({ nav, asOfDate, existing }) {
  if (nav == null || !Number.isFinite(nav)) {
    return { previousClose: null, changePct: null };
  }

  let previousClose = null;
  if (existing?.asOfDate && existing.asOfDate !== asOfDate && Number.isFinite(existing.price)) {
    // New NAV date → prior stored NAV is yesterday's close.
    previousClose = existing.price;
  } else if (Number.isFinite(existing?.previousClose)) {
    // Same-day refresh → keep the prior baseline.
    previousClose = existing.previousClose;
  }

  if (previousClose == null || previousClose === 0) {
    return { previousClose: null, changePct: null };
  }

  return {
    previousClose,
    changePct: ((nav - previousClose) / previousClose) * 100,
  };
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

function bseRows({ bseQuotes, universe, nseSymbols, asOfDate, syncedAt }) {
  const universeBySymbol = new Map(universe.map((row) => [row.symbol, row]));
  const candidatesBySymbol = new Map();
  for (const quote of bseQuotes) {
    if (!universeBySymbol.has(quote.symbol)) continue;
    const candidates = candidatesBySymbol.get(quote.symbol) ?? [];
    candidates.push(quote);
    candidatesBySymbol.set(quote.symbol, candidates);
  }

  const matched = [];
  const missing = [];
  const ambiguous = [];
  const nseCovered = [];
  for (const [symbol, universeRow] of universeBySymbol) {
    if (nseSymbols.has(symbol)) {
      nseCovered.push({ symbol, isin: universeRow.isin });
      continue;
    }
    const candidates = candidatesBySymbol.get(symbol) ?? [];
    if (candidates.length === 1 && candidates[0].ltp != null) {
      matched.push({ ...candidates[0], isin: universeRow.isin });
    } else if (candidates.length > 1) {
      ambiguous.push({ symbol, isin: universeRow.isin, scripCodes: candidates.map((item) => item.scripCode) });
    } else {
      missing.push({ symbol, isin: universeRow.isin });
    }
  }

  const assetRows = matched.map((quote) => ({
    asset_type: 'stock',
    asset_key: `BSE:${quote.scripCode}`,
    name: quote.name ?? quote.symbol,
    price: quote.ltp,
    change_pct: quote.changePct ?? null,
    previous_close: quote.previousClose ?? null,
    as_of_date: asOfDate,
    price_source: 'bse',
    exchange: 'BSE',
    exchange_symbol: quote.symbol,
    isin: quote.isin,
    synced_at: syncedAt,
  }));
  const historyRows = matched.map((quote) => ({
    asset_type: 'stock',
    asset_key: `BSE:${quote.scripCode}`,
    as_of_date: asOfDate,
    close_price: quote.ltp,
    previous_close: quote.previousClose ?? null,
    change_pct: quote.changePct ?? null,
    source: 'bse',
    synced_at: syncedAt,
  }));

  return { assetRows, historyRows, matched, missing, ambiguous, nseCovered };
}

async function refreshEquity({ url, apiKey, writeHistory, asOfDate, syncedAt, dryRun = false }) {
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
  const nseSymbols = new Set(stockQuotes.map((quote) => quote.symbol));
  console.log('Fetching BSE equity fallback snapshot...');
  const [{ rows: bseUniverse, invalid: invalidUniverse }, bseQuotes] = await Promise.all([
    loadBseFallbackUniverse(),
    fetchBseEquityQuotes(),
  ]);
  const bse = bseRows({
    bseQuotes,
    universe: bseUniverse,
    nseSymbols,
    asOfDate,
    syncedAt,
  });
  const bseMeta = {
    universe: bseUniverse.length,
    invalid_universe: invalidUniverse,
    fetched: bseQuotes.length,
    matched: bse.matched,
    missing: bse.missing,
    ambiguous: bse.ambiguous,
    nseCovered: bse.nseCovered,
  };
  console.log(
    `BSE fallback: ${bse.matched.length} matched, ${bse.missing.length} missing, ` +
      `${bse.ambiguous.length} ambiguous, ${bse.nseCovered.length} NSE-covered.`
  );

  const assetRows = [
    ...equityAssetRows(stockQuotes, 'stock', asOfDate, syncedAt),
    ...equityAssetRows(typedEtfs, 'etf', asOfDate, syncedAt),
    ...bse.assetRows,
  ];

  if (dryRun) {
    return {
      equityUpdated: 0,
      historyUpserted: 0,
      stockCount: stockQuotes.length,
      etfCount: typedEtfs.length,
      bseUpdated: 0,
      bseMeta,
    };
  }

  console.log(`Upserting ${assetRows.length} equity quotes (as_of ${asOfDate})...`);
  const equityUpdated = await upsertAssets(url, apiKey, assetRows);

  let historyUpserted = 0;
  if (writeHistory) {
    const historyRows = [
      ...equityHistoryRows(stockQuotes, 'stock', asOfDate, syncedAt),
      ...equityHistoryRows(typedEtfs, 'etf', asOfDate, syncedAt),
      ...bse.historyRows,
    ];
    console.log(`Upserting ${historyRows.length} equity history points...`);
    historyUpserted = await upsertHistory(url, apiKey, historyRows);
  }

  return {
    equityUpdated,
    historyUpserted,
    stockCount: stockQuotes.length,
    etfCount: typedEtfs.length,
    bseUpdated: bse.assetRows.length,
    bseMeta,
  };
}

async function refreshFunds({ url, apiKey, writeHistory, syncedAt }) {
  console.log('Fetching AMFI NAVAll.txt...');
  const res = await fetch(SOURCES.amfiNavAll, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`AMFI fetch failed: ${res.status}`);
  const text = await res.text();
  const schemes = parseNavAll(text);

  console.log('Loading existing fund quotes for day-change baseline...');
  const existingByKey = await fetchExistingFundQuotes(url, apiKey);

  const assetByKey = new Map();
  const historyByKey = new Map();
  for (const scheme of schemes) {
    const key = String(scheme.schemeCode ?? '').trim();
    if (!key || scheme.nav == null) continue;
    const asOfDate = scheme.navDate || istDateString();
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

async function refreshCommodities({ url, apiKey, writeHistory, asOfDate, syncedAt }) {
  console.log('Fetching MCX spot market prices...');
  const { items } = await fetchMcxSpotPrices();

  const assetByKey = new Map();
  const historyByKey = new Map();

  for (const item of items) {
    const symbol = String(item.id ?? item.name ?? '').trim();
    const location = String(item.location ?? 'NA').trim();
    if (!symbol || item.spotPrice == null || !Number.isFinite(item.spotPrice)) continue;

    const assetKey = `${symbol}-${location}`.toUpperCase();
    const rowAsOf = parseMcxDate(item.date, asOfDate);
    const change = Number.isFinite(item.change) ? item.change : null;
    const previousClose =
      change != null && Number.isFinite(item.spotPrice) ? item.spotPrice - change : null;
    const changePct =
      previousClose != null && previousClose !== 0
        ? (change / previousClose) * 100
        : null;

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
  const historyRows = [...historyByKey.values()];

  console.log(`Upserting ${assetRows.length} commodity spots (as_of ${asOfDate})...`);
  const commodityUpdated = await upsertAssets(url, apiKey, assetRows);

  let historyUpserted = 0;
  if (writeHistory && historyRows.length) {
    console.log(`Upserting ${historyRows.length} commodity history points...`);
    historyUpserted = await upsertHistory(url, apiKey, historyRows);
  }

  return {
    commodityUpdated,
    historyUpserted,
    commodityCount: assetRows.length,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const syncedAt = new Date().toISOString();
  const asOfDate = istDateString();
  console.log(`Mode=${args.mode} as_of=${asOfDate} history=${args.writeHistory} dry_run=${args.dryRun}`);
  if (args.dryRun) {
    if (args.mode !== 'equity' && args.mode !== 'all') {
      throw new Error('--dry-run currently validates the BSE equity fallback; use --mode=equity');
    }
    const validation = await refreshEquity({
      url: null,
      apiKey: null,
      writeHistory: false,
      asOfDate,
      syncedAt,
      dryRun: true,
    });
    const bse = validation.bseMeta;
    console.log(
      JSON.stringify(
        {
          status: 'validated',
          bse: {
            universe: bse.universe,
            invalid_universe: bse.invalid_universe,
            fetched: bse.fetched,
            matched: bse.matched.map(({ symbol, isin, scripCode }) => ({ symbol, isin, scripCode })),
            missing: bse.missing,
            ambiguous: bse.ambiguous,
            nse_covered: bse.nseCovered,
          },
        },
        null,
        2
      )
    );
    return;
  }

  const url = requireEnv('VITE_SUPABASE_URL', 'SUPABASE_URL');
  const serviceKey = optionalEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');
  if (!serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY; quote refresh requires the service role');
  }
  const apiKey = serviceKey;

  let runId = null;
  try {
    const run = await insertFetchRun(url, apiKey, {
      mode: args.mode,
      status: 'running',
      meta: { as_of_date: asOfDate },
    });
    runId = run?.id ?? null;
  } catch (err) {
    console.warn('Could not create fetch run row:', err.message);
  }

  let equityUpdated = 0;
  let fundUpdated = 0;
  let commodityUpdated = 0;
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
      meta.bse = {
        universe: eq.bseMeta.universe,
        fetched: eq.bseMeta.fetched,
        matched: eq.bseMeta.matched.length,
        missing: eq.bseMeta.missing.length,
        ambiguous: eq.bseMeta.ambiguous.length,
        nse_covered: eq.bseMeta.nseCovered.length,
      };
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

    if (args.mode === 'all' || args.mode === 'commodities') {
      const cm = await refreshCommodities({
        url,
        apiKey,
        writeHistory: args.writeHistory,
        asOfDate,
        syncedAt,
      });
      commodityUpdated = cm.commodityUpdated;
      historyUpserted += cm.historyUpserted;
      meta.commodities = cm.commodityCount;
    }

    if (runId) {
      await updateFetchRun(url, apiKey, runId, {
        status: 'completed',
        finished_at: new Date().toISOString(),
        equity_updated: equityUpdated,
        fund_updated: fundUpdated,
        commodity_updated: commodityUpdated,
        history_upserted: historyUpserted,
        meta,
      });
    }

    console.log(
      `Done. equity=${equityUpdated} funds=${fundUpdated} commodities=${commodityUpdated} history=${historyUpserted}`
    );
  } catch (err) {
    if (runId) {
      await updateFetchRun(url, apiKey, runId, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        equity_updated: equityUpdated,
        fund_updated: fundUpdated,
        commodity_updated: commodityUpdated,
        history_upserted: historyUpserted,
        error_message: err?.message ?? String(err),
        meta,
      }).catch(() => {});
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
