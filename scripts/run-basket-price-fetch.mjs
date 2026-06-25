#!/usr/bin/env node
/**
 * Phase 1: fetch prices for all required conids (current + return composition).
 * Phase 2: compute NAV per basket; on missing prices → error (no NAV update).
 *
 * Usage:
 *   node --env-file=.env scripts/run-basket-price-fetch.mjs
 *   node --env-file=.env scripts/run-basket-price-fetch.mjs --slot=us_close
 *   node --env-file=.env scripts/run-basket-price-fetch.mjs --dry-run
 */

import { getSupabaseAdminConfig, supabaseRest } from './lib/supabase-admin.mjs';
import { fetchAllBasketPrices } from './lib/basket-prices.mjs';
import { detectFetchSlot, pricesMapFromRows } from './lib/nav-engine.mjs';
import { updateBasketNavs } from './lib/basket-nav-update.mjs';

const slotArg = process.argv.find((a) => a.startsWith('--slot='));
const DRY_RUN = process.argv.includes('--dry-run');
const FETCH_SLOT = slotArg ? slotArg.split('=')[1] : detectFetchSlot();
const FETCHED_AT = new Date().toISOString();

if (!['us_close', 'overnight'].includes(FETCH_SLOT)) {
  console.error('Invalid --slot. Use us_close or overnight.');
  process.exit(1);
}

async function main() {
  const config = getSupabaseAdminConfig({ requireServiceRole: !DRY_RUN });
  const db = supabaseRest('instrument_prices', config);

  console.log(`Basket price fetch — slot=${FETCH_SLOT} at ${FETCHED_AT}`);
  if (DRY_RUN) console.log('DRY RUN — no database writes');

  // ── Phase 1: global price fetch ─────────────────────────────────────────
  const conidList = await db.rpc('list_conids_for_price_fetch');
  const conids = (Array.isArray(conidList) ? conidList : []).map(Number).filter(Boolean);

  if (!conids.length) {
    console.log('No conids to fetch — running NAV update only.');
    await updateBasketNavs({
      fetchSlot: FETCH_SLOT,
      fetchedAt: FETCHED_AT,
      dryRun: DRY_RUN,
      config,
    });
    return;
  }

  const { rows: priceRows, ibkrCount, yahooCount, missing } = await fetchAllBasketPrices(conids);
  console.log(
    `Phase 1 — prices: ${priceRows.length}/${conids.length} ` +
      `(${ibkrCount} IBKR, ${yahooCount} Yahoo, ${missing} missing)`
  );

  const currentPrices = pricesMapFromRows(priceRows);

  if (!DRY_RUN) {
    const pricesTable = supabaseRest('instrument_prices', config);
    const historyTable = supabaseRest('instrument_price_history', config);

    await pricesTable.upsert(
      priceRows.map((r) => ({
        conid: r.conid,
        price: r.price,
        currency: r.currency,
        source: r.source,
        exchange_id: r.exchange_id ?? null,
        yahoo_symbol: r.yahoo_symbol ?? null,
        ibkr_reference_price: r.ibkr_reference_price ?? null,
        quote_confidence: r.quote_confidence ?? null,
        fetched_at: FETCHED_AT,
        updated_at: FETCHED_AT,
      })),
      'conid'
    );

    await historyTable.insert(
      priceRows.map((r) => ({
        conid: r.conid,
        price: r.price,
        currency: r.currency,
        source: r.source,
        exchange_id: r.exchange_id ?? null,
        yahoo_symbol: r.yahoo_symbol ?? null,
        ibkr_reference_price: r.ibkr_reference_price ?? null,
        quote_confidence: r.quote_confidence ?? null,
        fetch_slot: FETCH_SLOT,
        fetched_at: FETCHED_AT,
      }))
    );
  }

  // ── Phase 2: per-basket NAV ─────────────────────────────────────────────
  await updateBasketNavs({
    fetchSlot: FETCH_SLOT,
    fetchedAt: FETCHED_AT,
    currentPrices,
    dryRun: DRY_RUN,
    config,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
