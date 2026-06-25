#!/usr/bin/env node
/**
 * NAV-only update — uses prices already in instrument_prices / instrument_price_history.
 * Run after universe fetch, or manually to backfill from the latest price snapshot.
 *
 * Usage:
 *   node --env-file=.env scripts/run-basket-nav-update.mjs
 *   node --env-file=.env scripts/run-basket-nav-update.mjs --slot=us_close
 *   node --env-file=.env scripts/run-basket-nav-update.mjs --fetched-at=2026-06-25T04:46:43.434Z
 *   node --env-file=.env scripts/run-basket-nav-update.mjs --dry-run
 */

import { getSupabaseAdminConfig, supabaseRest } from './lib/supabase-admin.mjs';
import { detectFetchSlot } from './lib/nav-engine.mjs';
import { updateBasketNavs } from './lib/basket-nav-update.mjs';

const slotArg = process.argv.find((a) => a.startsWith('--slot='));
const fetchedAtArg = process.argv.find((a) => a.startsWith('--fetched-at='));
const DRY_RUN = process.argv.includes('--dry-run');
const FETCH_SLOT = slotArg ? slotArg.split('=')[1] : detectFetchSlot();

if (!['us_close', 'overnight'].includes(FETCH_SLOT)) {
  console.error('Invalid --slot. Use us_close or overnight.');
  process.exit(1);
}

async function resolveFetchedAt(config) {
  if (fetchedAtArg) {
    return fetchedAtArg.split('=')[1];
  }

  const runsTable = supabaseRest('universe_price_fetch_runs', config);
  const { url, key } = config;
  const response = await fetch(
    `${url}/rest/v1/universe_price_fetch_runs?fetch_slot=eq.${FETCH_SLOT}&status=eq.completed&order=fetched_at.desc&limit=1&select=fetched_at`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (response.ok) {
    const rows = await response.json();
    if (rows[0]?.fetched_at) {
      return rows[0].fetched_at;
    }
  }

  return new Date().toISOString();
}

async function main() {
  const config = getSupabaseAdminConfig({ requireServiceRole: !DRY_RUN });
  const fetchedAt = await resolveFetchedAt(config);

  console.log(`Basket NAV update — slot=${FETCH_SLOT} fetched_at=${fetchedAt}`);
  if (DRY_RUN) console.log('DRY RUN — no database writes');

  await updateBasketNavs({
    fetchSlot: FETCH_SLOT,
    fetchedAt,
    dryRun: DRY_RUN,
    config,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
