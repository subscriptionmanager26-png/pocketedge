/**
 * Full IBKR preflight ladder (steps 1–4) + Yahoo backup (step 5) for universe fetch.
 */

import { chunk, createIbkrSnapshotClient, parseIbkrField31 } from './ibkr-snapshot.mjs';
import { fetchYahooBackupBatch } from './yahoo-backup.mjs';

export const LADDER_STEPS = [
  { step: 1, preflightCount: 0, preflightWaitMs: 0, label: 'no_preflight_initial' },
  { step: 2, preflightCount: 0, preflightWaitMs: 0, label: 'no_preflight_retry' },
  { step: 3, preflightCount: 1, preflightWaitMs: 1000, label: 'preflight_1' },
  { step: 4, preflightCount: 2, preflightWaitMs: 2000, label: 'preflight_2' },
];

export const IBKR_BATCH_SIZE = 100;

function initLadderState(instruments) {
  return new Map(
    instruments.map((row) => [
      row.conid,
      {
        conid: row.conid,
        symbol: row.symbol,
        exchange_id: row.exchange_id,
        success_step: null,
        success_step_label: null,
        last: null,
        last_raw: null,
        price_source: null,
      },
    ]),
  );
}

function ladderRowsToPrices(instruments, ladder, yahoo) {
  const rows = [];
  for (const inst of instruments) {
    const ibkr = ladder.get(inst.conid);
    if (ibkr?.last != null && ibkr.last > 0) {
      rows.push({
        conid: inst.conid,
        price: ibkr.last,
        currency: inst.currency,
        source: 'ibkr',
        exchange_id: inst.exchange_id,
        yahoo_symbol: null,
        ibkr_reference_price: null,
        quote_confidence: 'high',
      });
      continue;
    }
    const hit = yahoo.get(inst.conid);
    if (hit?.price != null && hit.price > 0) {
      rows.push({
        conid: inst.conid,
        price: hit.price,
        currency: hit.currency ?? inst.currency,
        source: hit.source,
        exchange_id: inst.exchange_id,
        yahoo_symbol: hit.yahoo_symbol,
        ibkr_reference_price: null,
        quote_confidence: hit.quote_confidence,
      });
    }
  }
  return rows;
}

function ladderDbRows(runId, instruments, ladder, yahoo) {
  const rows = [];
  for (const inst of instruments) {
    const entry = ladder.get(inst.conid);
    const yhit = yahoo.get(inst.conid);
    if (yhit) {
      rows.push({
        run_id: runId,
        conid: inst.conid,
        symbol: inst.symbol,
        exchange_id: inst.exchange_id,
        success_step: 5,
        success_step_label: 'yahoo_backup',
        last_price: yhit.price,
        last_raw: null,
        price_source: yhit.source,
      });
      continue;
    }
    if (entry?.success_step != null) {
      rows.push({
        run_id: runId,
        conid: inst.conid,
        symbol: entry.symbol ?? inst.symbol,
        exchange_id: entry.exchange_id ?? inst.exchange_id,
        success_step: entry.success_step,
        success_step_label: entry.success_step_label,
        last_price: entry.last,
        last_raw: entry.last_raw,
        price_source: entry.price_source,
      });
      continue;
    }
    rows.push({
      run_id: runId,
      conid: inst.conid,
      symbol: inst.symbol,
      exchange_id: inst.exchange_id,
      success_step: null,
      success_step_label: null,
      last_price: null,
      last_raw: null,
      price_source: null,
    });
  }
  return rows;
}

export async function processInstrumentChunk({
  runId,
  fetchSlot,
  fetchedAt,
  instruments,
  batchSize = IBKR_BATCH_SIZE,
  yahooConcurrency = 10,
  onIbkrProgress,
  onYahooProgress,
}) {
  const client = createIbkrSnapshotClient();
  const ladder = initLadderState(instruments);
  const totals = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const stepConfig of LADDER_STEPS) {
    const pending = instruments.filter((row) => ladder.get(row.conid).success_step == null);
    if (!pending.length) continue;

    const batches = chunk(pending, batchSize);
    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i];
      const conids = batch.map((row) => row.conid);
      try {
        const snapshots = await client.fetchBatch(conids, {
          preflightCount: stepConfig.preflightCount,
          preflightWaitMs: stepConfig.preflightWaitMs,
        });

        for (const snapshot of snapshots) {
          const parsed = parseIbkrField31(snapshot['31']);
          const entry = ladder.get(snapshot.conid);
          if (
            !entry ||
            entry.success_step != null ||
            parsed.price == null ||
            parsed.price <= 0
          ) {
            continue;
          }
          entry.success_step = stepConfig.step;
          entry.success_step_label = stepConfig.label;
          entry.last = parsed.price;
          entry.last_raw = parsed.raw;
          entry.price_source = 'ibkr';
          totals[stepConfig.step] += 1;
        }
      } catch {
        // Continue other batches.
      }
      onIbkrProgress?.({
        step: stepConfig.step,
        batch: i + 1,
        batches: batches.length,
        priced: [...ladder.values()].filter((r) => r.success_step != null).length,
      });
    }
  }

  const missesAfterIbkr = instruments.filter((row) => ladder.get(row.conid)?.success_step == null);
  const yahooCandidates = missesAfterIbkr.filter(
    (row) =>
      row.yahoo_symbol ||
      ['NASDAQ', 'NYSE', 'ARCA', 'OTCLNKECN', 'OTC'].includes(row.exchange_id ?? ''),
  );

  const yahoo = yahooCandidates.length
    ? await fetchYahooBackupBatch(yahooCandidates, {
        concurrency: yahooConcurrency,
        onProgress: onYahooProgress,
      })
    : new Map();
  totals[5] = yahoo.size;

  const priceRows = ladderRowsToPrices(instruments, ladder, yahoo);
  const ladderRows = ladderDbRows(runId, instruments, ladder, yahoo);

  const ibkrCount = priceRows.filter((r) => r.source === 'ibkr').length;
  const yahooCount = priceRows.filter((r) => r.source === 'yahoo').length;
  const finraCount = priceRows.filter((r) => r.source === 'finra').length;

  return {
    fetchSlot,
    fetchedAt,
    priceRows,
    ladderRows,
    processed: instruments.length,
    priced: priceRows.length,
    missing: instruments.length - priceRows.length,
    ibkrCount,
    yahooCount,
    finraCount,
    stepCounts: totals,
    ibkrMetrics: client.metrics,
  };
}
