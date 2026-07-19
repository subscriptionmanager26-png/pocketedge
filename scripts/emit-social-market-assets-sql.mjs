#!/usr/bin/env node
/**
 * Emit SQL batch files for social_market_assets upserts (for MCP / manual apply).
 * Usage: node scripts/emit-social-market-assets-sql.mjs [outDir]
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKETS_DIR = path.join(__dirname, '..', 'social', 'public', 'data', 'markets');
const BATCH_SIZE = 400;
const outDir = path.resolve(process.argv[2] ?? path.join(__dirname, '..', '.tmp', 'market-asset-batches'));

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

function sqlForBatch(rows, tag) {
  const payload = JSON.stringify(rows);
  return `
insert into public.social_market_assets (asset_type, asset_key, name, price, change_pct, synced_at)
select
  r.asset_type,
  r.asset_key,
  r.name,
  r.price,
  r.change_pct,
  r.synced_at::timestamptz
from jsonb_to_recordset($json$${payload}$json$::jsonb) as r(
  asset_type text,
  asset_key text,
  name text,
  price numeric,
  change_pct numeric,
  synced_at text
)
on conflict (asset_type, asset_key) do update set
  name = excluded.name,
  price = excluded.price,
  change_pct = excluded.change_pct,
  synced_at = excluded.synced_at;
-- ${tag}
`.trim();
}

async function main() {
  const [stocks, etfs, funds] = await Promise.all([
    readSearchIndex('stocks-search.json'),
    readSearchIndex('etf-search.json'),
    readSearchIndex('mutual-funds-search.json'),
  ]);

  const rows = [
    ...stockRows(stocks, 'stock'),
    ...stockRows(etfs, 'etf'),
    ...fundRows(funds),
  ];

  await mkdir(outDir, { recursive: true });

  const files = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const name = `batch-${String(Math.floor(i / BATCH_SIZE) + 1).padStart(3, '0')}.sql`;
    const filePath = path.join(outDir, name);
    await writeFile(filePath, sqlForBatch(batch, `${i + 1}-${i + batch.length} of ${rows.length}`), 'utf8');
    files.push(filePath);
  }

  console.log(JSON.stringify({ total: rows.length, batches: files.length, outDir, files }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
