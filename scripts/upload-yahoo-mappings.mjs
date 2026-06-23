#!/usr/bin/env node
/**
 * Upload Yahoo symbol mappings to Supabase for server-side backup fetches.
 *
 * Usage:
 *   node --env-file=.env scripts/upload-yahoo-mappings.mjs
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSupabaseAdminConfig, supabaseRest } from './lib/supabase-admin.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const BATCH = 500;

const mappingPath =
  process.argv.find((a) => a.startsWith('--input='))?.split('=')[1] ??
  path.join(DATA_DIR, 'yahoo-isin-mapping-venue-currency-fixed', 'mapping.json');

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const config = getSupabaseAdminConfig();
  const table = supabaseRest('instrument_yahoo_mappings', config);
  const raw = JSON.parse(await readFile(mappingPath, 'utf8'));
  const rows = (raw.mappings ?? raw).filter(
    (row) => row.conid && row.yahoo_symbol && row.status === 'mapped'
  );

  console.log(`Uploading ${rows.length} Yahoo mappings from ${mappingPath}`);

  const batches = chunk(rows, BATCH);
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i].map((row) => ({
      conid: Number(row.conid),
      yahoo_symbol: row.yahoo_symbol,
      exchange_id: row.exchange_id ?? row.exchangeId ?? null,
      currency: row.currency ?? null,
      status: 'mapped',
      updated_at: new Date().toISOString(),
    }));
    await table.upsert(batch, 'conid');
    process.stdout.write(`\rBatch ${i + 1}/${batches.length}`);
  }

  process.stdout.write('\nDone.\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
