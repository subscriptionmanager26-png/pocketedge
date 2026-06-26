#!/usr/bin/env node
/**
 * Fetch prices for the full IBKR universe via the 5-step IBKR/Yahoo ladder.
 * Designed for long-running hosts (GitHub Actions, local machine) — no 300s cap.
 *
 * Usage:
 *   node --env-file=.env scripts/run-universe-price-fetch.mjs
 *   node --env-file=.env scripts/run-universe-price-fetch.mjs --slot=overnight
 *   node --env-file=.env scripts/run-universe-price-fetch.mjs --dry-run --limit=500
 */

import { detectFetchSlot } from './lib/nav-engine.mjs';
import { getSupabaseAdminConfig, supabaseRest } from './lib/supabase-admin.mjs';
import { refreshFxRatesInDb, updateBasketNavs } from './lib/basket-nav-update.mjs';
import { attachUsdToPriceRows, fetchFxRatesToUsd } from './lib/fx-rates-usd.mjs';
import { IBKR_BATCH_SIZE, processInstrumentChunk } from './lib/universe-price-ladder.mjs';

const slotArg = process.argv.find((a) => a.startsWith('--slot='));
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const chunkArg = process.argv.find((a) => a.startsWith('--chunk='));
const DRY_RUN = process.argv.includes('--dry-run');
const FETCH_SLOT = slotArg ? slotArg.split('=')[1] : detectFetchSlot();
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : null;
const PROCESS_CHUNK = chunkArg ? Number(chunkArg.split('=')[1]) : 500;
const FETCHED_AT = new Date().toISOString();
const RUNTIME =
  process.env.GITHUB_ACTIONS === 'true' ? 'github_actions' : 'local';

if (!['us_close', 'overnight'].includes(FETCH_SLOT)) {
  console.error('Invalid --slot. Use us_close or overnight.');
  process.exit(1);
}

function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  return min > 0 ? `${min}m ${sec % 60}s` : `${sec}s`;
}

async function upsertInBatches(table, rows, onConflict, batchSize = 500) {
  for (let i = 0; i < rows.length; i += batchSize) {
    await table.upsert(rows.slice(i, i + batchSize), onConflict);
  }
}

async function insertInBatches(table, rows, batchSize = 500) {
  for (let i = 0; i < rows.length; i += batchSize) {
    await table.insert(rows.slice(i, i + batchSize));
  }
}

async function main() {
  const startedAt = Date.now();
  const config = getSupabaseAdminConfig({ requireServiceRole: !DRY_RUN });
  const rpc = supabaseRest('instrument_prices', config);
  const runsTable = supabaseRest('universe_price_fetch_runs', config);

  const universeCount = Number(await rpc.rpc('count_universe_instruments_for_price_fetch'));
  const universeSize =
    LIMIT != null && LIMIT > 0 ? Math.min(universeCount, LIMIT) : universeCount;

  if (!universeSize) {
    console.log('No universe instruments to fetch.');
    return;
  }

  console.log(
    `Universe price fetch — slot=${FETCH_SLOT} runtime=${RUNTIME} at ${FETCHED_AT}`,
  );
  console.log(
    `Universe: ${universeSize.toLocaleString()} instruments | ` +
      `IBKR batch=${IBKR_BATCH_SIZE} | process chunk=${PROCESS_CHUNK}` +
      (DRY_RUN ? ' [dry-run]' : ''),
  );

  if (!DRY_RUN) {
    console.log('Refreshing FX rates…');
    await refreshFxRatesInDb(config);
  }
  const fxRates = await fetchFxRatesToUsd({ force: !DRY_RUN });

  let runId = null;
  if (!DRY_RUN) {
    const runRecord = await runsTable.insertReturning({
      fetch_slot: FETCH_SLOT,
      fetched_at: FETCHED_AT,
      universe_size: universeSize,
      status: 'running',
      chunk_offset: 0,
      chunk_size: PROCESS_CHUNK,
      processed_count: 0,
      runtime: RUNTIME,
    });
    runId = String(runRecord.id);
    console.log(`Run id: ${runId}`);
  }

  const aggregate = {
    ibkrCount: 0,
    yahooCount: 0,
    finraCount: 0,
    priced: 0,
    stepCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };

  let offset = 0;

  try {
    while (offset < universeSize) {
      const chunkLimit = Math.min(PROCESS_CHUNK, universeSize - offset);
      const instruments = await rpc.rpc('list_universe_instruments_for_price_fetch', {
        p_offset: offset,
        p_limit: chunkLimit,
      });

      const batch = Array.isArray(instruments) ? instruments : [];
      if (!batch.length) break;

      const chunkStarted = Date.now();
      process.stdout.write(
        `\n[${offset + 1}–${offset + batch.length}/${universeSize}] fetching…`,
      );

      const result = await processInstrumentChunk({
        runId: runId ?? 'dry-run',
        fetchSlot: FETCH_SLOT,
        fetchedAt: FETCHED_AT,
        instruments: batch,
        onIbkrProgress: ({ step, batch: b, batches, priced }) => {
          process.stdout.write(
            `\r[${offset + 1}–${offset + batch.length}/${universeSize}] ` +
              `IBKR step ${step} batch ${b}/${batches} (${priced} priced)`,
          );
        },
        onYahooProgress: (done, total, priced) => {
          process.stdout.write(
            `\r[${offset + 1}–${offset + batch.length}/${universeSize}] ` +
              `Yahoo ${done}/${total} (${priced} priced)`,
          );
        },
      });

      process.stdout.write('\n');
      const chunkSec = ((Date.now() - chunkStarted) / 1000).toFixed(1);
      console.log(
        `  chunk done in ${chunkSec}s — priced ${result.priced}/${result.processed} ` +
          `(IBKR ${result.ibkrCount}, Yahoo ${result.yahooCount}, FINRA ${result.finraCount})`,
      );

      aggregate.ibkrCount += result.ibkrCount;
      aggregate.yahooCount += result.yahooCount;
      aggregate.finraCount += result.finraCount;
      aggregate.priced += result.priced;
      for (const key of [1, 2, 3, 4, 5]) {
        aggregate.stepCounts[key] += result.stepCounts[key];
      }

      if (!DRY_RUN && result.priceRows.length) {
        const pricesTable = supabaseRest('instrument_prices', config);
        const historyTable = supabaseRest('instrument_price_history', config);
        const ladderTable = supabaseRest('ibkr_fetch_ladder_results', config);
        const usdPriceRows = attachUsdToPriceRows(result.priceRows, fxRates);

        await upsertInBatches(
          pricesTable,
          usdPriceRows.map((r) => ({
            conid: r.conid,
            price: r.price,
            price_usd: r.price_usd,
            fx_rate_to_usd: r.fx_rate_to_usd,
            currency: r.currency,
            source: r.source,
            exchange_id: r.exchange_id,
            yahoo_symbol: r.yahoo_symbol,
            ibkr_reference_price: r.ibkr_reference_price,
            quote_confidence: r.quote_confidence,
            fetched_at: FETCHED_AT,
            updated_at: FETCHED_AT,
          })),
          'conid',
        );

        await insertInBatches(
          historyTable,
          usdPriceRows.map((r) => ({
            conid: r.conid,
            price: r.price,
            price_usd: r.price_usd,
            fx_rate_to_usd: r.fx_rate_to_usd,
            currency: r.currency,
            source: r.source,
            exchange_id: r.exchange_id,
            yahoo_symbol: r.yahoo_symbol,
            ibkr_reference_price: r.ibkr_reference_price,
            quote_confidence: r.quote_confidence,
            fetch_slot: FETCH_SLOT,
            fetched_at: FETCHED_AT,
          })),
        );

        if (result.ladderRows.length) {
          await upsertInBatches(ladderTable, result.ladderRows, 'run_id,conid');
        }
      }

      offset += batch.length;

      if (!DRY_RUN && runId) {
        await runsTable.update(
          { id: `eq.${runId}` },
          {
            chunk_offset: offset,
            processed_count: offset,
            ibkr_priced: aggregate.ibkrCount,
            yahoo_priced: aggregate.yahooCount,
            finra_priced: aggregate.finraCount,
            missing: universeSize - aggregate.priced,
            ibkr_step_1: aggregate.stepCounts[1],
            ibkr_step_2: aggregate.stepCounts[2],
            ibkr_step_3: aggregate.stepCounts[3],
            ibkr_step_4: aggregate.stepCounts[4],
            yahoo_backup: aggregate.stepCounts[5],
          },
        );
      }

      const elapsed = Date.now() - startedAt;
      const rate = offset / (elapsed / 1000);
      const etaSec = rate > 0 ? (universeSize - offset) / rate : 0;
      console.log(
        `  progress ${offset.toLocaleString()}/${universeSize.toLocaleString()} ` +
          `(${((offset / universeSize) * 100).toFixed(1)}%) — ` +
          `elapsed ${formatDuration(elapsed)}, ETA ~${formatDuration(etaSec * 1000)}`,
      );
    }

    const durationMs = Date.now() - startedAt;
    const missing = universeSize - aggregate.priced;

    console.log(
      `\nDone — priced ${aggregate.priced.toLocaleString()}/${universeSize.toLocaleString()} ` +
        `(${aggregate.ibkrCount} IBKR, ${aggregate.yahooCount} Yahoo, ` +
        `${aggregate.finraCount} FINRA, ${missing} missing) ` +
        `in ${formatDuration(durationMs)}`,
    );
    console.log(
      `Ladder: step1=${aggregate.stepCounts[1]} step2=${aggregate.stepCounts[2]} ` +
        `step3=${aggregate.stepCounts[3]} step4=${aggregate.stepCounts[4]} ` +
        `yahoo=${aggregate.stepCounts[5]}`,
    );

    if (!DRY_RUN && runId) {
      await runsTable.update(
        { id: `eq.${runId}` },
        {
          status: 'completed',
          duration_ms: durationMs,
          missing,
          processed_count: offset,
          chunk_offset: offset,
        },
      );
      console.log('Updated universe_price_fetch_runs');
    }

    // ── Phase 2: basket NAV (uses prices written above) ───────────────────
    console.log('\n── Basket NAV update ──');
    await updateBasketNavs({
      fetchSlot: FETCH_SLOT,
      fetchedAt: FETCHED_AT,
      dryRun: DRY_RUN,
      config,
    });
  } catch (error) {
    if (!DRY_RUN && runId) {
      await runsTable
        .update(
          { id: `eq.${runId}` },
          {
            status: 'failed',
            error_message: error instanceof Error ? error.message : String(error),
            duration_ms: Date.now() - startedAt,
            processed_count: offset,
            chunk_offset: offset,
          },
        )
        .catch(() => {});
    }
    throw error;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
