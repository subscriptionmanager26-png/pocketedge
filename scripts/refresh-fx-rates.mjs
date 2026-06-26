#!/usr/bin/env node
/**
 * Refresh FX rates in fx_rates_to_usd (Yahoo Finance).
 *
 * Usage:
 *   node --env-file=.env scripts/refresh-fx-rates.mjs
 */

import { getSupabaseAdminConfig, supabaseRest } from './lib/supabase-admin.mjs';
import { fetchFxRatesToUsd, fxRatesRowsForDb } from './lib/fx-rates-usd.mjs';

async function main() {
  const fetchedAt = new Date().toISOString();
  const rates = await fetchFxRatesToUsd({ force: true });
  const rows = fxRatesRowsForDb(rates, fetchedAt);

  console.log('FX rates to USD:');
  for (const row of rows.sort((a, b) => a.currency.localeCompare(b.currency))) {
    console.log(`  ${row.currency}: ${row.rate_to_usd}`);
  }

  const config = getSupabaseAdminConfig({ requireServiceRole: true });
  const table = supabaseRest('fx_rates_to_usd', config);
  await table.upsert(rows, 'currency');
  console.log(`Upserted ${rows.length} FX rates at ${fetchedAt}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
