/**
 * Phase 2 — apply fetch-boundary NAV updates for all baskets.
 * Used after universe price fetch (prices already in DB) or after basket price fetch.
 */

import { getSupabaseAdminConfig, supabaseRest } from './supabase-admin.mjs';
import { applyFetchBoundary } from './nav-engine.mjs';
import {
  attachUsdToPriceRows,
  fetchFxRatesToUsd,
  fxRatesRowsForDb,
  ratesMapFromDbRows,
  resolveUsdPrice,
} from './fx-rates-usd.mjs';

export async function loadFxRatesFromDb(config = getSupabaseAdminConfig()) {
  const { url, key } = config;
  const response = await fetch(`${url}/rest/v1/fx_rates_to_usd?select=currency,rate_to_usd`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) {
    console.warn('Could not load FX rates:', await response.text());
    return { USD: 1 };
  }
  return ratesMapFromDbRows(await response.json());
}

export async function refreshFxRatesInDb(config = getSupabaseAdminConfig()) {
  const fetchedAt = new Date().toISOString();
  const rates = await fetchFxRatesToUsd({ force: true });
  const table = supabaseRest('fx_rates_to_usd', config);
  await table.upsert(fxRatesRowsForDb(rates, fetchedAt), 'currency');
  return rates;
}

function pricesUsdMapFromRows(rows, fxRates) {
  const map = new Map();
  for (const row of rows || []) {
    if (row.conid == null) continue;
    const usd = resolveUsdPrice(row, fxRates);
    if (usd != null && usd > 0) map.set(Number(row.conid), usd);
  }
  return map;
}

export async function loadPriorPrices(conids, lastFetchAt, config = getSupabaseAdminConfig()) {
  if (!lastFetchAt || !conids.length) return new Map();

  const fxRates = await loadFxRatesFromDb(config);
  const { url, key } = config;
  const inList = conids.join(',');
  const response = await fetch(
    `${url}/rest/v1/instrument_price_history?conid=in.(${inList})&fetched_at=eq.${encodeURIComponent(lastFetchAt)}&select=conid,price,price_usd,currency`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }
  );
  if (!response.ok) {
    console.warn('Could not load prior prices:', await response.text());
    return new Map();
  }
  const rows = await response.json();
  return pricesUsdMapFromRows(rows, fxRates);
}

export async function loadCurrentPricesFromDb(conids, fetchedAt, config = getSupabaseAdminConfig()) {
  if (!conids.length) return new Map();

  const fxRates = await loadFxRatesFromDb(config);
  const { url, key } = config;
  const inList = conids.join(',');
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  const prices = new Map();
  const rows = [];

  const historyResponse = await fetch(
    `${url}/rest/v1/instrument_price_history?conid=in.(${inList})&fetched_at=eq.${encodeURIComponent(fetchedAt)}&select=conid,price,price_usd,currency`,
    { headers }
  );
  if (!historyResponse.ok) {
    throw new Error(
      `Could not load boundary prices (${historyResponse.status}): ${await historyResponse.text()}`
    );
  }
  rows.push(...(await historyResponse.json()));

  const missing = conids.filter((conid) => !rows.some((row) => Number(row.conid) === conid));
  if (missing.length) {
    const missingList = missing.join(',');
    const latestResponse = await fetch(
      `${url}/rest/v1/instrument_prices?conid=in.(${missingList})&select=conid,price,price_usd,currency`,
      { headers }
    );
    if (!latestResponse.ok) {
      throw new Error(
        `Could not load latest prices (${latestResponse.status}): ${await latestResponse.text()}`
      );
    }
    rows.push(...(await latestResponse.json()));
  }

  return pricesUsdMapFromRows(rows, fxRates);
}

export async function listBasketConidsForNav(config = getSupabaseAdminConfig()) {
  const { url, key } = config;
  const response = await fetch(`${url}/rest/v1/rpc/list_conids_for_price_fetch`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!response.ok) {
    throw new Error(`list_conids_for_price_fetch failed (${response.status}): ${await response.text()}`);
  }
  const conidList = await response.json();
  return (Array.isArray(conidList) ? conidList : []).map(Number).filter(Boolean);
}

/**
 * @param {object} options
 * @param {string} options.fetchSlot
 * @param {string} options.fetchedAt
 * @param {Map<number, number>} [options.currentPrices] — omit to load from instrument_prices
 * @param {boolean} [options.dryRun]
 * @param {ReturnType<typeof getSupabaseAdminConfig>} [options.config]
 */
export async function updateBasketNavs({
  fetchSlot,
  fetchedAt,
  currentPrices,
  dryRun = false,
  config = getSupabaseAdminConfig({ requireServiceRole: !dryRun }),
}) {
  const db = supabaseRest('instrument_prices', config);

  const baskets = await db.rpc('list_baskets_for_nav_fetch');
  const basketList = Array.isArray(baskets) ? baskets : [];

  if (!basketList.length) {
    console.log('Basket NAV — no baskets to update.');
    return { okCount: 0, errorCount: 0, basketCount: 0 };
  }

  let prices = currentPrices;
  if (!prices) {
    const conids = await listBasketConidsForNav(config);
    prices = await loadCurrentPricesFromDb(conids, fetchedAt, config);
    console.log(
      `Basket NAV — loaded ${prices.size}/${conids.length} current prices from DB (fetched_at=${fetchedAt})`
    );
  }

  console.log(`Basket NAV — updating ${basketList.length} baskets (slot=${fetchSlot})…`);

  const snapshotsTable = supabaseRest('basket_fetch_snapshots', config);
  const navHistoryTable = supabaseRest('basket_nav_history', config);
  const navStateTable = supabaseRest('basket_nav_state', config);
  const errorsTable = supabaseRest('basket_nav_errors', config);

  let okCount = 0;
  let errorCount = 0;

  for (const basket of basketList) {
    const returnConids = (basket.return_constituents || [])
      .map((c) => Number(c.conid))
      .filter(Boolean);
    const currentConids = (basket.constituents || [])
      .map((c) => Number(c.conid))
      .filter(Boolean);
    const priceConids = [...new Set([...returnConids, ...currentConids])];

    const priorPrices = await loadPriorPrices(priceConids, basket.last_fetch_at, config);

    const result = applyFetchBoundary({
      navState: basket,
      currentConstituents: basket.constituents || [],
      priorPrices,
      currentPrices: prices,
    });

    if (!result.ok) {
      errorCount += 1;
      console.warn(
        `  ${basket.basket_id.slice(0, 8)}… ERROR — missing conids: ${result.missing_conids.join(', ')}`
      );

      if (!dryRun) {
        await errorsTable.insert([
          {
            basket_id: basket.basket_id,
            missing_conids: result.missing_conids,
          },
        ]);

        await navStateTable.update(
          { basket_id: `eq.${basket.basket_id}` },
          {
            nav_status: 'error',
            updated_at: fetchedAt,
          }
        );
      }
      continue;
    }

    okCount += 1;
    console.log(
      `  ${basket.basket_id.slice(0, 8)}… NAV ${result.prior_nav.toFixed(2)} → ${result.nav.toFixed(2)} ` +
        `(${result.was_cash_period ? 'cash activation' : `${(result.period_return * 100).toFixed(2)}%`})` +
        (basket.nav_status === 'error' ? ' [recovered]' : '')
    );

    if (dryRun) continue;

    await snapshotsTable.insert([
      {
        basket_id: basket.basket_id,
        fetch_slot: fetchSlot,
        fetched_at: fetchedAt,
        prior_nav: result.prior_nav,
        nav: result.nav,
        period_return: result.period_return,
        prior_constituents: result.prior_constituents,
        current_constituents: result.current_constituents,
        was_cash_period: result.was_cash_period,
      },
    ]);

    await navHistoryTable.insert([
      {
        basket_id: basket.basket_id,
        nav: result.nav,
        period_return: result.period_return,
        fetch_slot: fetchSlot,
        fetched_at: fetchedAt,
      },
    ]);

    await navStateTable.update(
      { basket_id: `eq.${basket.basket_id}` },
      {
        nav: result.nav,
        return_constituents: result.return_constituents,
        is_activated: result.is_activated,
        nav_status: 'ok',
        last_fetch_slot: fetchSlot,
        last_fetch_at: fetchedAt,
        updated_at: fetchedAt,
      }
    );
  }

  console.log(`Basket NAV — done: ${okCount} updated, ${errorCount} errors.`);
  return { okCount, errorCount, basketCount: basketList.length };
}
