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
import { detectFetchSlot } from './lib/nav-engine.mjs';
import { attachUsdToPriceRows, fetchFxRatesToUsd } from './lib/fx-rates-usd.mjs';
import { refreshFxRatesInDb, updateBasketNavs } from './lib/basket-nav-update.mjs';

function pricesUsdMapFromRows(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (row.conid != null && row.price_usd != null && row.price_usd > 0) {
      map.set(Number(row.conid), Number(row.price_usd));
    }
  }
  return map;
}

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

  if (!DRY_RUN) {
    console.log('Refreshing FX rates…');
    await refreshFxRatesInDb(config);
  }
  const fxRates = await fetchFxRatesToUsd({ force: !DRY_RUN });

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
  const usdPriceRows = attachUsdToPriceRows(priceRows, fxRates);
  console.log(
    `Phase 1 — prices: ${usdPriceRows.length}/${conids.length} ` +
      `(${ibkrCount} IBKR, ${yahooCount} Yahoo, ${missing} missing)`
  );

  const currentPrices = pricesUsdMapFromRows(usdPriceRows);

  if (!DRY_RUN) {
    const pricesTable = supabaseRest('instrument_prices', config);
    const historyTable = supabaseRest('instrument_price_history', config);

    await pricesTable.upsert(
      usdPriceRows.map((r) => ({
        conid: r.conid,
        price: r.price,
        price_usd: r.price_usd,
        fx_rate_to_usd: r.fx_rate_to_usd,
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
      usdPriceRows.map((r) => ({
        conid: r.conid,
        price: r.price,
        price_usd: r.price_usd,
        fx_rate_to_usd: r.fx_rate_to_usd,
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
