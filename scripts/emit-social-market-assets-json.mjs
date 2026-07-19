#!/usr/bin/env node
/** Emit JSON batch files for bulk_upsert_social_market_assets RPC. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKETS_DIR = path.join(__dirname, '..', 'social', 'public', 'data', 'markets');
const BATCH_SIZE = 300;
const outDir = path.resolve(process.argv[2] ?? path.join(__dirname, '..', '.tmp', 'market-asset-json-batches'));

async function readSearchIndex(fileName) {
  const raw = await readFile(path.join(MARKETS_DIR, fileName), 'utf8');
  return JSON.parse(raw).items ?? [];
}

function stockRows(items, assetType) {
  const syncedAt = new Date().toISOString();
  return items
    .map((item) => {
      const key = String(item.symbol ?? item.id ?? '').trim().toUpperCase();
      if (!key) return null;
      return {
        asset_type: assetType,
        asset_key: key,
        name: item.name ?? key,
        price: item.price ?? item.ltp ?? item.nav ?? null,
        change_pct: item.changePct ?? null,
        synced_at: syncedAt,
      };
    })
    .filter(Boolean);
}

function fundRows(items) {
  const syncedAt = new Date().toISOString();
  return items
    .map((item) => {
      const key = String(item.schemeCode ?? item.id ?? '').trim();
      if (!key) return null;
      return {
        asset_type: 'fund',
        asset_key: key,
        name: item.name ?? key,
        price: item.nav ?? null,
        change_pct: null,
        synced_at: syncedAt,
      };
    })
    .filter(Boolean);
}

async function main() {
  const [stocks, etfs, funds] = await Promise.all([
    readSearchIndex('stocks-search.json'),
    readSearchIndex('etf-search.json'),
    readSearchIndex('mutual-funds-search.json'),
  ]);
  const rows = [...stockRows(stocks, 'stock'), ...stockRows(etfs, 'etf'), ...fundRows(funds)];
  await mkdir(outDir, { recursive: true });
  const files = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const name = `batch-${String(Math.floor(i / BATCH_SIZE) + 1).padStart(3, '0')}.json`;
    const filePath = path.join(outDir, name);
    await writeFile(filePath, JSON.stringify(batch));
    files.push(filePath);
  }
  console.log(JSON.stringify({ total: rows.length, batches: files.length, outDir }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
