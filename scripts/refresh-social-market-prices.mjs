#!/usr/bin/env node
/**
 * Refresh PocketEdge social market quotes from NSE (stocks/ETFs/SGBs/indices),
 * AMFI (funds), and MCX (commodities). Also upserts daily close / NAV / spot
 * rows into social_market_price_history.
 *
 * Usage:
 *   node --env-file=.env scripts/refresh-social-market-prices.mjs --mode=all
 *   node --env-file=.env scripts/refresh-social-market-prices.mjs --mode=equity
 *   node --env-file=.env scripts/refresh-social-market-prices.mjs --mode=indices
 *   node --env-file=.env scripts/refresh-social-market-prices.mjs --mode=funds
 *   node --env-file=.env scripts/refresh-social-market-prices.mjs --mode=commodities
 *   node --env-file=.env scripts/refresh-social-market-prices.mjs --mode=ibja
 *
 * Env:
 *   VITE_SUPABASE_URL / SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (preferred)
 */

import { parseNavAll, parseNavHistory } from './lib/indian-markets/amfi.js';
import { fetchBseEquityQuotes, loadBseFallbackUniverse } from './lib/indian-markets/bse.js';
import { SOURCES, UA } from './lib/indian-markets/constants.js';
import { fetchIbjaGoldRates, IBJA_GOLD_999_KEY } from './lib/indian-markets/ibja.js';
import { fetchMcxSpotPrices } from './lib/indian-markets/mcx.js';
import {
  createNseSession,
  fetchEtfList,
  fetchIndices,
  fetchSgbQuotes,
  fetchStocksTraded,
} from './lib/indian-markets/nse.js';
import { loadSgbUniverse } from './lib/indian-markets/sgb.js';

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
  const args = { mode: 'all', writeHistory: true, dryRun: false, fundHistoryDate: null };
  for (const arg of argv) {
    if (arg.startsWith('--mode=')) args.mode = arg.slice('--mode='.length);
    if (arg.startsWith('--fund-history-date=')) {
      args.fundHistoryDate = arg.slice('--fund-history-date='.length);
    }
    if (arg === '--no-history') args.writeHistory = false;
    if (arg === '--dry-run') args.dryRun = true;
  }
  if (
    !['all', 'equity', 'indices', 'funds', 'fund-history', 'commodities', 'ibja'].includes(args.mode)
  ) {
    throw new Error(
      `Invalid --mode=${args.mode}. Use all|equity|indices|funds|fund-history|commodities|ibja`
    );
  }
  if (
    args.mode === 'fund-history' &&
    !/^\d{4}-\d{2}-\d{2}$/.test(String(args.fundHistoryDate ?? ''))
  ) {
    throw new Error('fund-history mode requires --fund-history-date=YYYY-MM-DD');
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

async function insertNavIngestRun(url, apiKey, row) {
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/social_market_nav_ingest_runs`, {
    method: 'POST',
    headers: restHeaders(apiKey),
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`insert nav ingest run HTTP ${res.status}: ${text}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

/** Summarize AMFI NAV dates + how many schemes advanced vs our stored quote. */
function summarizeFundNavArrival(assetRows, existingByKey, istToday) {
  const dateCounts = {};
  let todayNavCount = 0;
  let newDateAdvances = 0;
  let firstSeenToday = 0;

  for (const row of assetRows) {
    const asOfDate = row.as_of_date;
    if (!asOfDate) continue;
    dateCounts[asOfDate] = (dateCounts[asOfDate] || 0) + 1;
    if (asOfDate === istToday) todayNavCount += 1;

    const existing = existingByKey.get(row.asset_key);
    if (existing?.asOfDate && existing.asOfDate !== asOfDate) {
      newDateAdvances += 1;
      if (asOfDate === istToday) firstSeenToday += 1;
    } else if (!existing?.asOfDate && asOfDate === istToday) {
      // Brand-new scheme appearing already on today's NAV date.
      newDateAdvances += 1;
      firstSeenToday += 1;
    }
  }

  return { dateCounts, todayNavCount, newDateAdvances, firstSeenToday };
}

function logFundNavArrival({ syncedAt, istToday, totalSchemes, arrival }) {
  const { dateCounts, todayNavCount, newDateAdvances, firstSeenToday } = arrival;
  const sortedDates = Object.entries(dateCounts).sort((a, b) => b[0].localeCompare(a[0]));
  const pctToday = totalSchemes ? ((100 * todayNavCount) / totalSchemes).toFixed(1) : '0.0';
  console.log(
    `NAV arrival @ ${syncedAt} IST today=${istToday}: ` +
      `today_nav=${todayNavCount}/${totalSchemes} (${pctToday}%) ` +
      `new_date_advances=${newDateAdvances} (of which today=${firstSeenToday})`
  );
  for (const [date, count] of sortedDates.slice(0, 8)) {
    const pct = totalSchemes ? ((100 * count) / totalSchemes).toFixed(1) : '0.0';
    console.log(`  as_of_date ${date}: ${count} (${pct}%)`);
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

async function upsertSecurityIsins(url, apiKey, rows) {
  return rpcBatch(url, apiKey, 'bulk_upsert_social_market_asset_isins', rows);
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
    // New NAV date → prior stored NAV is the Day's PnL baseline.
    // Schemes that publish daily advance as_of_date every evening; schemes that
    // skip a day keep the prior baseline until their next NAV appears.
    previousClose = existing.price;
  } else if (Number.isFinite(existing?.previousClose)) {
    // Same-day refresh (e.g. 21:30 / 21:50 / 22:10 IST polls) → keep baseline.
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
    .map((q) => {
      const row = {
        asset_type: assetType,
        asset_key: q.symbol,
        name: q.name ?? q.symbol,
        price: q.ltp,
        change_pct: q.changePct ?? null,
        previous_close: q.previousClose ?? null,
        as_of_date: asOfDate,
        price_source: 'nse',
        exchange: 'NSE',
        exchange_symbol: q.symbol,
        synced_at: syncedAt,
        ...(assetType === 'etf' && q.nav != null ? { nav: q.nav } : {}),
      };
      if (q.marketCapCr != null && Number.isFinite(q.marketCapCr) && q.marketCapCr > 0) {
        row.market_cap_cr = q.marketCapCr;
        row.market_cap_rs = q.marketCapCr * 1e7;
        row.market_cap_as_of = asOfDate;
        row.market_cap_source = 'nse_stocks_traded';
        row.market_cap_synced_at = syncedAt;
        if (q.series) row.market_cap_series = String(q.series).trim().toUpperCase();
      }
      return row;
    });
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

function indexAssetRows(indices, asOfDate, syncedAt) {
  return indices
    .filter((row) => row.symbol && row.value != null && Number.isFinite(Number(row.value)))
    .map((row) => {
      const symbol = String(row.symbol).trim().toUpperCase();
      return {
        asset_type: 'index',
        asset_key: symbol,
        name: row.name ?? symbol,
        price: Number(row.value),
        change_pct: row.changePct ?? null,
        previous_close: row.previousClose ?? null,
        as_of_date: asOfDate,
        price_source: 'nse',
        // Reuse exchange for NSE index group (no dedicated group column).
        exchange: row.group ?? null,
        exchange_symbol: symbol,
        synced_at: syncedAt,
      };
    });
}

function indexHistoryRows(indices, asOfDate, syncedAt) {
  return indices
    .filter((row) => row.symbol && row.value != null && Number.isFinite(Number(row.value)))
    .map((row) => {
      const symbol = String(row.symbol).trim().toUpperCase();
      return {
        asset_type: 'index',
        asset_key: symbol,
        as_of_date: asOfDate,
        close_price: Number(row.value),
        previous_close: row.previousClose ?? null,
        change_pct: row.changePct ?? null,
        source: 'nse',
        synced_at: syncedAt,
      };
    });
}

async function refreshIndices({ url, apiKey, writeHistory, asOfDate, syncedAt, dryRun = false }) {
  console.log('Fetching NSE indices...');
  const nseFetch = await createNseSession(SOURCES.nseLiveIndices);
  const indices = await fetchIndices(nseFetch);
  const assetRows = indexAssetRows(indices, asOfDate, syncedAt);
  console.log(`NSE indices: ${assetRows.length} quotes (from ${indices.length} rows).`);

  if (dryRun) {
    return { indexUpdated: 0, historyUpserted: 0, indexCount: assetRows.length };
  }

  console.log(`Upserting ${assetRows.length} index quotes (as_of ${asOfDate})...`);
  const indexUpdated = await upsertAssets(url, apiKey, assetRows);

  let historyUpserted = 0;
  if (writeHistory) {
    const historyRows = indexHistoryRows(indices, asOfDate, syncedAt);
    console.log(`Upserting ${historyRows.length} index history points...`);
    historyUpserted = await upsertHistory(url, apiKey, historyRows);
  }

  return { indexUpdated, historyUpserted, indexCount: assetRows.length };
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

function sgbRows({ quotes, universe, asOfDate, syncedAt }) {
  const quoteBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
  const assetRows = [];
  const historyRows = [];
  const missing = [];

  for (const item of universe) {
    const quote = quoteBySymbol.get(item.symbol);
    if (!quote) {
      missing.push(item);
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
      isin: item.isin,
      synced_at: syncedAt,
    });
    historyRows.push({
      asset_type: 'bond',
      asset_key: item.symbol,
      as_of_date: asOfDate,
      close_price: quote.ltp,
      previous_close: quote.previousClose,
      change_pct: quote.changePct,
      source: 'nse_sgb',
      synced_at: syncedAt,
    });
  }

  return { assetRows, historyRows, missing };
}

async function refreshEquity({ url, apiKey, writeHistory, asOfDate, syncedAt, dryRun = false }) {
  console.log('Fetching NSE stocks, ETFs, and SGBs...');
  const nseFetch = await createNseSession('https://www.nseindia.com/market-data/stocks-traded');
  const [stocks, etfs, sgbQuotes, sgbUniverse] = await Promise.all([
    fetchStocksTraded(nseFetch),
    fetchEtfList(nseFetch),
    fetchSgbQuotes(nseFetch),
    loadSgbUniverse(),
  ]);

  const etfQuotes = etfs.map((row) => ({
    symbol: String(row.symbol ?? '').trim().toUpperCase(),
    name: row.name,
    ltp: row.ltp,
    previousClose: row.previousClose,
    changePct: row.changePct,
    nav: row.nav ?? null,
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
  const sgb = sgbRows({
    quotes: sgbQuotes,
    universe: sgbUniverse.rows,
    asOfDate,
    syncedAt,
  });
  console.log(
    `SGBs: ${sgb.assetRows.length} matched, ${sgb.missing.length} missing, ` +
      `${sgbUniverse.invalid.length} invalid mappings.`
  );
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
    ...sgb.assetRows,
  ];

  if (dryRun) {
    return {
      equityUpdated: 0,
      historyUpserted: 0,
      stockCount: stockQuotes.length,
      etfCount: typedEtfs.length,
      sgbCount: sgb.assetRows.length,
      sgbMeta: {
        universe: sgbUniverse.rows.length,
        invalid_universe: sgbUniverse.invalid,
        fetched: sgbQuotes.length,
        missing: sgb.missing,
      },
      bseUpdated: 0,
      bseMeta,
    };
  }

  console.log(`Upserting ${assetRows.length} equity quotes (as_of ${asOfDate})...`);
  const equityUpdated = await upsertAssets(url, apiKey, assetRows);
  const bseIsinRows = bse.assetRows
    .filter((row) => /^[A-Z0-9]{12}$/.test(String(row.isin ?? '')))
    .map(({ asset_type, asset_key, isin, synced_at }) => ({
      asset_type,
      asset_key,
      isin,
      synced_at,
    }));
  const sgbIsinRows = sgb.assetRows.map(({ asset_type, asset_key, isin, synced_at }) => ({
    asset_type,
    asset_key,
    isin,
    synced_at,
  }));
  await upsertSecurityIsins(url, apiKey, [...bseIsinRows, ...sgbIsinRows]);

  let historyUpserted = 0;
  if (writeHistory) {
    const historyRows = [
      ...equityHistoryRows(stockQuotes, 'stock', asOfDate, syncedAt),
      ...equityHistoryRows(typedEtfs, 'etf', asOfDate, syncedAt),
      ...bse.historyRows,
      ...sgb.historyRows,
    ];
    console.log(`Upserting ${historyRows.length} equity history points...`);
    historyUpserted = await upsertHistory(url, apiKey, historyRows);
  }

  return {
    equityUpdated,
    historyUpserted,
    stockCount: stockQuotes.length,
    etfCount: typedEtfs.length,
    sgbCount: sgb.assetRows.length,
    sgbMeta: {
      universe: sgbUniverse.rows.length,
      invalid_universe: sgbUniverse.invalid,
      fetched: sgbQuotes.length,
      missing: sgb.missing,
    },
    bseUpdated: bse.assetRows.length,
    bseIsinsUpdated: bseIsinRows.length,
    sgbIsinsUpdated: sgbIsinRows.length,
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
  const istToday = istDateString();

  const assetByKey = new Map();
  const historyByKey = new Map();
  const fundIsinByValue = new Map();
  for (const scheme of schemes) {
    const key = String(scheme.schemeCode ?? '').trim();
    if (!key || scheme.nav == null) continue;
    const asOfDate = scheme.navDate || istToday;
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
      if (/^[A-Z0-9]{12}$/.test(value)) {
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
  const historyRows = [...historyByKey.values()];
  const fundIsinRows = [...fundIsinByValue.values()];

  const arrival = summarizeFundNavArrival(assetRows, existingByKey, istToday);
  logFundNavArrival({
    syncedAt,
    istToday,
    totalSchemes: assetRows.length,
    arrival,
  });

  try {
    await insertNavIngestRun(url, apiKey, {
      run_at: syncedAt,
      ist_date: istToday,
      total_schemes: assetRows.length,
      today_nav_count: arrival.todayNavCount,
      new_date_advances: arrival.newDateAdvances,
      date_counts: arrival.dateCounts,
      source: 'amfi_navall',
      meta: { first_seen_today: arrival.firstSeenToday },
    });
  } catch (err) {
    console.warn('Could not persist NAV ingest run snapshot:', err.message);
  }

  console.log(`Upserting ${assetRows.length} fund NAVs...`);
  const fundUpdated = await upsertAssets(url, apiKey, assetRows);
  console.log(`Upserting ${fundIsinRows.length} mutual-fund ISIN mappings...`);
  const fundIsinsUpdated = await upsertSecurityIsins(url, apiKey, fundIsinRows);

  let historyUpserted = 0;
  if (writeHistory && historyRows.length) {
    console.log(`Upserting ${historyRows.length} fund history points...`);
    historyUpserted = await upsertHistory(url, apiKey, historyRows);
  }

  return {
    fundUpdated,
    fundIsinsUpdated,
    historyUpserted,
    schemeCount: assetRows.length,
    navArrival: {
      istToday,
      todayNavCount: arrival.todayNavCount,
      newDateAdvances: arrival.newDateAdvances,
      firstSeenToday: arrival.firstSeenToday,
      dateCounts: arrival.dateCounts,
    },
  };
}

function amfiHistoryUrl(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
    month - 1
  ];
  return `https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?frmdt=${day
    .toString()
    .padStart(2, '0')}-${monthName}-${year}`;
}

/**
 * Backfill a historical AMFI date without altering the current fund quote.
 * The live holdings and daily P&L continue to use the latest NAV in
 * social_market_assets; this only fills missing price-history points.
 */
async function backfillFundHistory({ url, apiKey, historyDate, syncedAt }) {
  const sourceUrl = amfiHistoryUrl(historyDate);
  console.log(`Fetching AMFI historical NAV report for ${historyDate}...`);
  const res = await fetch(sourceUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`AMFI history fetch failed: ${res.status}`);

  const schemes = parseNavHistory(await res.text());
  const rows = schemes
    .filter((scheme) => scheme.nav != null && scheme.navDate === historyDate)
    .map((scheme) => ({
      asset_type: 'fund',
      asset_key: String(scheme.schemeCode).trim(),
      as_of_date: historyDate,
      close_price: scheme.nav,
      previous_close: null,
      change_pct: null,
      source: 'amfi',
      synced_at: syncedAt,
    }));

  console.log(`Upserting ${rows.length} historical fund NAVs for ${historyDate}...`);
  const historyUpserted = await upsertHistory(url, apiKey, rows);
  return { historyUpserted, schemeCount: rows.length };
}

/** Existing MCX/IBJA commodity rows — day change vs prior session close (not MCX tick delta). */
async function fetchExistingCommodityQuotes(url, apiKey) {
  const base = url.replace(/\/$/, '');
  const map = new Map();
  const pageSize = 1000;
  let from = 0;

  for (;;) {
    const to = from + pageSize - 1;
    const res = await fetch(
      `${base}/rest/v1/social_market_assets?asset_type=eq.commodity&select=asset_key,price,as_of_date,previous_close&order=asset_key.asc`,
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
      throw new Error(`fetch existing commodities HTTP ${res.status}: ${text}`);
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

function commodityDayChange({ price, asOfDate, existing }) {
  return fundDayChange({ nav: price, asOfDate, existing });
}

async function refreshCommodities({ url, apiKey, writeHistory, asOfDate, syncedAt }) {
  console.log('Fetching MCX spot market prices...');
  const { items } = await fetchMcxSpotPrices();
  const existingByKey = await fetchExistingCommodityQuotes(url, apiKey);

  const assetByKey = new Map();
  const historyByKey = new Map();

  for (const item of items) {
    const symbol = String(item.id ?? item.name ?? '').trim();
    const location = String(item.location ?? 'NA').trim();
    if (!symbol || item.spotPrice == null || !Number.isFinite(item.spotPrice)) continue;

    const assetKey = `${symbol}-${location}`.toUpperCase();
    const rowAsOf = parseMcxDate(item.date, asOfDate);
    // Prefer day-over-day vs prior session close. MCX `change` is often a tiny
    // intraday tick (~₹0.4) which rounds to 0.00% in the Markets UI.
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
        previousClose != null && previousClose !== 0 ? (change / previousClose) * 100 : null;
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

/** IBJA Fine Gold (999) ₹/g — benchmark for SGB premium/discount. */
async function refreshIbjaGold({ url, apiKey, writeHistory, syncedAt }) {
  console.log('Fetching IBJA Fine Gold (999) rate...');
  const quote = await fetchIbjaGoldRates();
  const asOfDate = quote.asOfDate || istDateString();
  const price = quote.fineGold999PerGram;

  let previousClose = null;
  let changePct = null;
  try {
    const base = url.replace(/\/$/, '');
    const res = await fetch(
      `${base}/rest/v1/social_market_assets?asset_type=eq.commodity&asset_key=eq.${encodeURIComponent(IBJA_GOLD_999_KEY)}&select=price,as_of_date,previous_close`,
      { headers: restHeaders(apiKey) },
    );
    if (res.ok) {
      const rows = await res.json();
      const prev = rows?.[0];
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
    }
  } catch {
    // Non-fatal — still upsert the spot.
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

  console.log(
    `Upserting ${IBJA_GOLD_999_KEY}=${price} as_of=${asOfDate} session=${quote.session || '?'}...`,
  );
  const commodityUpdated = await upsertAssets(url, apiKey, [assetRow]);

  let historyUpserted = 0;
  if (writeHistory && asOfDate) {
    historyUpserted = await upsertHistory(url, apiKey, [
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
    ]);
  }

  return {
    commodityUpdated,
    historyUpserted,
    commodityCount: 1,
    ibja: {
      price,
      asOfDate,
      session: quote.session,
    },
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
          sgb: {
            universe: validation.sgbMeta.universe,
            invalid_universe: validation.sgbMeta.invalid_universe,
            fetched: validation.sgbMeta.fetched,
            matched: validation.sgbCount,
            missing: validation.sgbMeta.missing,
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
  let indexUpdated = 0;
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
      meta.sgb = {
        universe: eq.sgbMeta.universe,
        fetched: eq.sgbMeta.fetched,
        matched: eq.sgbCount,
        missing: eq.sgbMeta.missing.length,
        isins: eq.sgbIsinsUpdated,
      };
      meta.bse = {
        universe: eq.bseMeta.universe,
        fetched: eq.bseMeta.fetched,
        matched: eq.bseMeta.matched.length,
        missing: eq.bseMeta.missing.length,
        ambiguous: eq.bseMeta.ambiguous.length,
        nse_covered: eq.bseMeta.nseCovered.length,
        isins: eq.bseIsinsUpdated,
      };
    }

    // Indices are managed by Supabase cron/edge updater in production.
    // Keep manual index runs available via --mode=indices or --mode=all.
    if (args.mode === 'all' || args.mode === 'indices') {
      const ix = await refreshIndices({
        url,
        apiKey,
        writeHistory: args.writeHistory,
        asOfDate,
        syncedAt,
      });
      indexUpdated = ix.indexUpdated;
      historyUpserted += ix.historyUpserted;
      meta.indices = ix.indexCount;
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
      meta.fund_isins = fd.fundIsinsUpdated;
      if (fd.navArrival) meta.nav_arrival = fd.navArrival;
    }

    if (args.mode === 'fund-history') {
      const fd = await backfillFundHistory({
        url,
        apiKey,
        historyDate: args.fundHistoryDate,
        syncedAt,
      });
      historyUpserted += fd.historyUpserted;
      meta.fund_history_date = args.fundHistoryDate;
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

    // IBJA gold is on its own hourly schedule (10:00–19:00 IST); also via --mode=ibja|all.
    if (args.mode === 'all' || args.mode === 'ibja') {
      const ib = await refreshIbjaGold({
        url,
        apiKey,
        writeHistory: args.writeHistory,
        syncedAt,
      });
      commodityUpdated += ib.commodityUpdated;
      historyUpserted += ib.historyUpserted;
      meta.ibja = ib.ibja;
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
      `Done. equity=${equityUpdated} indices=${indexUpdated} funds=${fundUpdated} commodities=${commodityUpdated} history=${historyUpserted}`
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
