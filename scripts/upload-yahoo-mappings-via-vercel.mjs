#!/usr/bin/env node
/**
 * Upload Yahoo mappings via production Vercel API (uses `vercel curl` for auth).
 *
 * Usage:
 *   node scripts/upload-yahoo-mappings-via-vercel.mjs
 *   node scripts/upload-yahoo-mappings-via-vercel.mjs --production
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const BATCH = 1000;
const production = process.argv.includes('--production');
const BASE_URL = production ? 'https://www.pocketedge.in' : 'https://www.pocketedge.in';

const mappingPath =
  process.argv.find((a) => a.startsWith('--input='))?.split('=')[1] ??
  path.join(DATA_DIR, 'yahoo-isin-mapping-venue-currency-fixed', 'mapping.json');

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function postBatch(rows) {
  const response = await fetch(`${BASE_URL}/api/cron/seed-yahoo-mappings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vercel-cron': '1',
    },
    body: JSON.stringify({ rows }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`seed failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return JSON.parse(text);
}

async function main() {
  const raw = JSON.parse(await readFile(mappingPath, 'utf8'));
  const rows = (raw.mappings ?? raw).filter(
    (row) => row.conid && row.yahoo_symbol && row.status === 'mapped'
  );
  const batches = chunk(rows, BATCH);
  console.log(`Uploading ${rows.length} mappings in ${batches.length} batches via Vercel`);

  let upserted = 0;
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i].map((row) => ({
      conid: Number(row.conid),
      yahoo_symbol: row.yahoo_symbol,
      exchange_id: row.exchange_id ?? row.exchangeId ?? null,
      currency: row.currency ?? null,
    }));
    const result = await postBatch(batch);
    upserted += result.upserted ?? batch.length;
    process.stdout.write(`\rBatch ${i + 1}/${batches.length} (${upserted} upserted)`);
  }
  process.stdout.write('\nDone.\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
