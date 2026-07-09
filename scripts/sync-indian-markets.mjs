#!/usr/bin/env node
/**
 * Sync Indian market master lists + latest quotes into social/public/data/markets/.
 * Intended to run weekly for lists; re-run anytime for fresher quotes.
 *
 * Usage: node scripts/sync-indian-markets.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseNavAll } from './lib/indian-markets/amfi.js';
import { SOURCES, UA } from './lib/indian-markets/constants.js';
import { parseEquityCsv } from './lib/indian-markets/equity-csv.js';
import { fetchMcxSpotPrices } from './lib/indian-markets/mcx.js';
import {
  createNseSession,
  fetchEquityQuotes,
  fetchEtfList,
  fetchIndices,
} from './lib/indian-markets/nse.js';
import {
  PREVIEW_LIMIT,
  buildMutualFundPreview,
  buildPreview,
  compactCommodity,
  compactEtf,
  compactFund,
  compactIndex,
  compactStock,
} from './lib/indian-markets/publish.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'social', 'public', 'data', 'markets');

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Fetch failed ${url}: ${res.status}`);
  return res.text();
}

function mergeEquityMaster(mainRows, smeRows, quotes, etfSymbols) {
  const etfSet = new Set(etfSymbols);
  const merged = new Map();

  for (const row of [...mainRows, ...smeRows]) {
    if (etfSet.has(row.symbol)) continue;
    const quote = quotes.get(row.symbol);
    merged.set(row.symbol, {
      ticker: row.symbol,
      symbol: row.symbol,
      name: row.name,
      series: row.series,
      isin: row.isin,
      segment: row.segment,
      price: quote?.ltp ?? null,
      previousClose: quote?.previousClose ?? null,
      changePct: quote?.changePct ?? null,
    });
  }

  return [...merged.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

async function writeJson(name, payload) {
  const filePath = path.join(OUT_DIR, name);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  const count = payload.items?.length ?? payload.count ?? '?';
  console.log(`  wrote ${name} (${count} items)`);
}

async function main() {
  console.log('Syncing Indian market data...');
  await mkdir(OUT_DIR, { recursive: true });

  const syncedAt = new Date().toISOString();

  console.log('Fetching NSE equity master CSVs...');
  const [equityCsv, smeCsv] = await Promise.all([
    fetchText(SOURCES.equityList),
    fetchText(SOURCES.smeEquityList),
  ]);
  const equityMaster = parseEquityCsv(equityCsv, 'EQ');
  const smeMaster = parseEquityCsv(smeCsv, 'SME');

  console.log('Fetching AMFI NAVAll.txt...');
  const navAllText = await fetchText(SOURCES.amfiNavAll);
  const mutualFunds = parseNavAll(navAllText);

  console.log('Fetching NSE quotes, ETFs, and indices...');
  const nseFetch = await createNseSession();
  const indicesFetch = await createNseSession(SOURCES.nseLiveIndices);
  const [quotes, etfs, indices] = await Promise.all([
    fetchEquityQuotes(nseFetch),
    fetchEtfList(nseFetch),
    fetchIndices(indicesFetch),
  ]);

  console.log('Fetching MCX spot prices...');
  const commodities = await fetchMcxSpotPrices();

  const etfSymbols = etfs.map((e) => e.symbol);
  const stocks = mergeEquityMaster(equityMaster, smeMaster, quotes, etfSymbols);

  const manifest = {
    syncedAt,
    sources: SOURCES,
    counts: {
      stocks: stocks.length,
      mutualFunds: mutualFunds.length,
      etfs: etfs.length,
      indices: indices.length,
      commodities: commodities.items.length,
      equityQuotes: quotes.size,
    },
  };

  await writeJson('manifest.json', {
    ...manifest,
    previewLimit: PREVIEW_LIMIT,
    files: {
      stocks: { full: 'stocks.json', preview: 'stocks-preview.json', search: 'stocks-search.json' },
      mutualFunds: {
        full: 'mutual-funds.json',
        preview: 'mutual-funds-preview.json',
        search: 'mutual-funds-search.json',
      },
      etf: { full: 'etf.json', preview: 'etf-preview.json', search: 'etf-search.json' },
      indices: {
        full: 'indices.json',
        preview: 'indices-preview.json',
        search: 'indices-search.json',
      },
      commodities: {
        full: 'commodities.json',
        preview: 'commodities-preview.json',
        search: 'commodities-search.json',
      },
    },
  });

  await writeJson('stocks.json', { syncedAt, items: stocks });
  await writeJson('stocks-preview.json', {
    syncedAt,
    items: buildPreview(stocks).map(compactStock),
  });
  await writeJson('stocks-search.json', {
    syncedAt,
    items: stocks.map(compactStock),
  });

  await writeJson('mutual-funds.json', { syncedAt, items: mutualFunds });
  await writeJson('mutual-funds-preview.json', {
    syncedAt,
    items: buildMutualFundPreview(mutualFunds).map(compactFund),
  });
  await writeJson('mutual-funds-search.json', {
    syncedAt,
    items: mutualFunds.map(compactFund),
  });

  await writeJson('etf.json', { syncedAt, items: etfs });
  await writeJson('etf-preview.json', {
    syncedAt,
    items: buildPreview(etfs).map(compactEtf),
  });
  await writeJson('etf-search.json', {
    syncedAt,
    items: etfs.map(compactEtf),
  });

  await writeJson('indices.json', { syncedAt, items: indices });
  await writeJson('indices-preview.json', {
    syncedAt,
    items: buildPreview(indices).map(compactIndex),
  });
  await writeJson('indices-search.json', {
    syncedAt,
    items: indices.map(compactIndex),
  });

  await writeJson('commodities.json', {
    syncedAt,
    asOn: commodities.asOn,
    items: commodities.items,
  });
  await writeJson('commodities-preview.json', {
    syncedAt,
    asOn: commodities.asOn,
    items: buildPreview(commodities.items, { changeKey: 'change' }).map(compactCommodity),
  });
  await writeJson('commodities-search.json', {
    syncedAt,
    items: commodities.items.map(compactCommodity),
  });

  console.log('Done.', manifest.counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
