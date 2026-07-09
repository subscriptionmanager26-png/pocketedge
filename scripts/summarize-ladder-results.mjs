#!/usr/bin/env node
/**
 * Archive ibkr_fetch_ladder_results older than RETENTION_DAYS into
 * ibkr_fetch_ladder_ticker_summary, then delete the raw rows.
 *
 * universe_price_fetch_runs is kept (run-level step totals + timestamps).
 * instrument_price_history is not touched.
 *
 * What gets stored in ibkr_fetch_ladder_ticker_summary (per conid):
 *   - total_runs       — how many fetch runs included this ticker
 *   - total_priced     — how many times a price was obtained
 *   - step_1 … step_5  — which ladder step succeeded (cumulative counts)
 *   - total_failures   — runs where no price was obtained
 *
 * Step labels (not stored in DB — see lib/ladder-steps.js):
 *   1=no_preflight_initial  2=no_preflight_retry  3=preflight_1
 *   4=preflight_2  5=yahoo_backup
 *
 * Usage:
 *   node scripts/summarize-ladder-results.mjs
 *   node scripts/summarize-ladder-results.mjs --dry-run
 *   RETENTION_DAYS=7 node scripts/summarize-ladder-results.mjs
 */

import { getSupabaseAdminConfig, supabaseRest } from './lib/supabase-admin.mjs';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const retentionDays = Number(process.env.RETENTION_DAYS ?? '7');

if (!Number.isFinite(retentionDays) || retentionDays < 1) {
  console.error('RETENTION_DAYS must be a positive integer');
  process.exit(1);
}

async function countSummaryTickers({ url, key }) {
  const response = await fetch(
    `${url}/rest/v1/ibkr_fetch_ladder_ticker_summary?select=conid&limit=0`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'count=exact',
      },
    }
  );
  if (!response.ok) return null;
  const range = response.headers.get('content-range');
  const total = range?.split('/')?.[1];
  return total != null ? Number(total) : null;
}

async function main() {
  const config = getSupabaseAdminConfig({ requireServiceRole: true });
  const db = supabaseRest('instrument_prices', config);

  console.log(
    `Ladder archive — retention=${retentionDays} day(s)${dryRun ? ' (dry run)' : ''}`
  );

  const result = await db.rpc('archive_ibkr_fetch_ladder_results', {
    p_retention_days: retentionDays,
    p_dry_run: dryRun,
  });

  console.log('Result:', JSON.stringify(result, null, 2));

  if (!dryRun) {
    const summaryTickers = await countSummaryTickers(config);
    if (summaryTickers != null) {
      console.log(`Ticker summaries in DB: ${summaryTickers.toLocaleString()}`);
    }
  }

  if (dryRun && result.rows_to_archive > 0) {
    console.log(
      'Re-run without --dry-run to merge into ibkr_fetch_ladder_ticker_summary and purge raw rows.'
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
