/**
 * IBKR snapshot + Yahoo ISIN fallback for basket constituent prices.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchBestYahooQuote } from './yahoo-fetch.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const SNAPSHOT_URL =
  'https://www.interactivebrokers.com/portal.proxy/v1/mkt/iserver/marketdata/snapshot';
const BATCH_SIZE = 100;
const FIELDS = '31';
const REQUESTS_PER_SECOND = 3;
const MIN_GAP_MS = Math.ceil(1000 / REQUESTS_PER_SECOND);
const PREFLIGHT_WAIT_MS = 1000;
const MAX_RETRIES = 4;

let nextRequestSlot = 0;
let yahooMappingCache;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function throttle() {
  const now = Date.now();
  if (now < nextRequestSlot) await sleep(nextRequestSlot - now);
  nextRequestSlot = Math.max(Date.now(), nextRequestSlot) + MIN_GAP_MS;
}

function parsePrice(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  const match = text.match(/^([A-Z]{1,3})?(-?\d[\d,]*(?:\.\d+)?)$/);
  if (!match) return null;
  const numeric = Number(match[2].replace(/,/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

async function fetchIbkrSnapshot(conids) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    await throttle();
    const url = `${SNAPSHOT_URL}?conids=${conids.join(',')}&fields=${FIELDS}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Referer: 'https://www.interactivebrokers.com/en/trading/symbol.php',
      },
    });
    if (response.status === 429 || response.status >= 500) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (!response.ok) throw new Error(`IBKR snapshot ${response.status}`);
    return response.json();
  }
  throw new Error(`IBKR snapshot failed after retries for ${conids.length} conids`);
}

async function fetchIbkrBatch(conids) {
  await fetchIbkrSnapshot(conids);
  await sleep(PREFLIGHT_WAIT_MS);
  const snapshots = await fetchIbkrSnapshot(conids);
  const prices = new Map();
  for (const row of snapshots) {
    const price = parsePrice(row['31']);
    if (price != null) prices.set(row.conid, price);
  }
  return prices;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function fetchIbkrPrices(conids, { onProgress } = {}) {
  const unique = [...new Set(conids.map(Number).filter(Boolean))];
  const prices = new Map();
  const batches = chunk(unique, BATCH_SIZE);

  for (let i = 0; i < batches.length; i += 1) {
    const batchPrices = await fetchIbkrBatch(batches[i]);
    for (const [conid, price] of batchPrices) prices.set(conid, price);
    onProgress?.(i + 1, batches.length, prices.size);
  }

  return prices;
}

async function loadYahooMapping() {
  if (yahooMappingCache) return yahooMappingCache;
  yahooMappingCache = new Map();

  const paths = [
    path.join(DATA_DIR, 'yahoo-isin-mapping-venue-currency-fixed', 'mapping.json'),
    path.join(DATA_DIR, 'yahoo-isin-mapping-venue-fixed', 'mapping.json'),
    path.join(DATA_DIR, 'yahoo-isin-mapping-currency-fixed', 'mapping.json'),
    path.join(DATA_DIR, 'yahoo-isin-mapping-full', 'mapping.json'),
    path.join(DATA_DIR, 'yahoo-isin-mapping-unresolved', 'mapping.json'),
  ];

  for (const file of paths) {
    try {
      const raw = JSON.parse(await readFile(file, 'utf8'));
      const rows = raw.mappings ?? raw;
      for (const row of rows) {
        if (row.conid && row.yahoo_symbol && row.status === 'mapped') {
          yahooMappingCache.set(Number(row.conid), row);
        }
      }
    } catch {
      // optional
    }
  }

  return yahooMappingCache;
}

export async function fetchYahooFallbackPrices(missingConids, instrumentsByConid, { onProgress } = {}) {
  const mapping = await loadYahooMapping();
  const quotes = new Map();
  const list = missingConids.map(Number).filter(Boolean);

  for (let i = 0; i < list.length; i += 1) {
    const conid = list[i];
    const mappingRow = mapping.get(conid) ?? null;
    const inst = instrumentsByConid.get(conid) ?? mappingRow;
    if (!inst) {
      onProgress?.(i + 1, list.length, quotes.size);
      continue;
    }

    const hit = await fetchBestYahooQuote(inst, mappingRow);
    if (hit?.price != null) quotes.set(conid, hit);
    await sleep(120);
    onProgress?.(i + 1, list.length, quotes.size);
  }

  return quotes;
}

export async function fetchAllBasketPrices(conids, instrumentsByConid = new Map()) {
  const unique = [...new Set(conids.map(Number).filter(Boolean))];
  console.log(`Fetching IBKR prices for ${unique.length} conids…`);

  const ibkr = await fetchIbkrPrices(unique, {
    onProgress: (batch, total, priced) => {
      process.stdout.write(`\rIBKR batch ${batch}/${total} (${priced} priced)`);
    },
  });
  process.stdout.write('\n');

  const missing = unique.filter((conid) => !ibkr.has(conid));
  let yahoo = new Map();
  if (missing.length) {
    console.log(`Yahoo fallback for ${missing.length} misses…`);
    yahoo = await fetchYahooFallbackPrices(missing, instrumentsByConid, {
      onProgress: (done, total, priced) => {
        process.stdout.write(`\rYahoo ${done}/${total} (${priced} priced)`);
      },
    });
    process.stdout.write('\n');
  }

  const rows = [];
  for (const conid of unique) {
    const inst = instrumentsByConid.get(conid);
    const ibkrPrice = ibkr.get(conid);
    const yahooHit = yahoo.get(conid);

    if (ibkrPrice != null) {
      rows.push({
        conid,
        price: ibkrPrice,
        currency: inst?.currency ?? null,
        source: 'ibkr',
        exchange_id: inst?.exchange_id ?? null,
        yahoo_symbol: null,
        ibkr_reference_price: null,
        quote_confidence: 'high',
      });
      continue;
    }

    if (yahooHit?.price != null) {
      rows.push({
        conid,
        price: yahooHit.price,
        currency: yahooHit.currency ?? inst?.currency ?? null,
        source: yahooHit.source ?? 'yahoo',
        exchange_id: inst?.exchange_id ?? null,
        yahoo_symbol: yahooHit.yahoo_symbol ?? null,
        ibkr_reference_price: null,
        quote_confidence: yahooHit.quote_confidence ?? 'low',
      });
    }
  }

  return {
    rows,
    ibkrCount: ibkr.size,
    yahooCount: yahoo.size,
    missing: unique.length - rows.length,
  };
}
