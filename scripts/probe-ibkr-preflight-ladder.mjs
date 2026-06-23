#!/usr/bin/env node
/**
 * Probe IBKR field-31 fetch using a 4-step preflight ladder:
 *   1. Initial fetch — no preflight
 *   2. Retry misses — no preflight
 *   3. Retry misses — 1× preflight (1s wait)
 *   4. Retry misses — 2× preflight (2s wait)
 *
 * Records which step priced each ticker. Use before scheduling server jobs
 * to confirm IBKR responds from the deployment environment.
 *
 * Usage:
 *   node scripts/probe-ibkr-preflight-ladder.mjs
 *   node scripts/probe-ibkr-preflight-ladder.mjs --sample=50 --batch-size=10
 *   node scripts/probe-ibkr-preflight-ladder.mjs --conids=265598,118089500
 */

import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  chunk,
  createIbkrSnapshotClient,
  parseIbkrField31,
} from './lib/ibkr-snapshot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const STEPS = [
  { step: 1, preflightCount: 0, preflightWaitMs: 0, label: 'no_preflight_initial' },
  { step: 2, preflightCount: 0, preflightWaitMs: 0, label: 'no_preflight_retry' },
  { step: 3, preflightCount: 1, preflightWaitMs: 1000, label: 'preflight_1' },
  { step: 4, preflightCount: 2, preflightWaitMs: 2000, label: 'preflight_2' },
];

function argValue(name, fallback) {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

const SAMPLE_SIZE = Number(argValue('sample', '50'));
const BATCH_SIZE = Number(argValue('batch-size', '10'));
const OUTPUT_PATH = argValue(
  'output',
  path.join(DATA_DIR, 'probe-ibkr-preflight-ladder.json')
);
const CONIDS_ARG = argValue('conids', '');

async function loadUniverse() {
  const raw = await readFile(path.join(DATA_DIR, 'ibkr-universe.json'), 'utf8');
  return JSON.parse(raw);
}

async function loadPrices() {
  try {
    const raw = await readFile(path.join(DATA_DIR, 'ibkr-prices-80k.json'), 'utf8');
    const parsed = JSON.parse(raw);
    const rows = parsed.prices ?? parsed;
    return new Map(rows.map((row) => [row.conid, row]));
  } catch {
    return new Map();
  }
}

function buildSample(universe, priceMap, size) {
  const missing = universe.filter((row) => !priceMap.get(row.conid)?.last);
  const liquid = universe
    .filter(
      (row) =>
        ['NASDAQ', 'NYSE', 'ARCA'].includes(row.exchangeId) && priceMap.get(row.conid)?.last
    )
    .slice(0, Math.ceil(size * 0.3));
  const hard = missing
    .filter((row) => ['OTCLNKECN', 'AEQLIT', 'TASE'].includes(row.exchangeId))
    .slice(0, Math.ceil(size * 0.3));
  const mid = missing
    .filter((row) => !['OTCLNKECN', 'AEQLIT', 'TASE'].includes(row.exchangeId))
    .slice(0, size);
  const seen = new Set();
  const sample = [];
  for (const row of [...liquid, ...hard, ...mid]) {
    if (seen.has(row.conid)) continue;
    seen.add(row.conid);
    sample.push(row);
    if (sample.length >= size) break;
  }
  return sample;
}

function mapSnapshots(snapshots, byConid) {
  const out = new Map();
  for (const snapshot of snapshots) {
    const instrument = byConid.get(snapshot.conid) ?? {};
    const parsed = parseIbkrField31(snapshot['31']);
    out.set(snapshot.conid, {
      conid: snapshot.conid,
      symbol: instrument.symbol ?? null,
      exchange_id: instrument.exchangeId ?? null,
      last_raw: parsed.raw,
      last: parsed.price,
      field_31: snapshot['31'] ?? null,
    });
  }
  return out;
}

async function runStep(client, instruments, stepConfig, byConid) {
  const batches = chunk(instruments, BATCH_SIZE);
  const priced = new Map();

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const conids = batch.map((row) => row.conid);
    const snapshots = await client.fetchBatch(conids, {
      preflightCount: stepConfig.preflightCount,
      preflightWaitMs: stepConfig.preflightWaitMs,
    });
    const mapped = mapSnapshots(snapshots, byConid);
    for (const [conid, row] of mapped) {
      if (row.last != null) priced.set(conid, row);
    }
    process.stdout.write(
      `\r  step ${stepConfig.step} batch ${i + 1}/${batches.length} ` +
        `(${priced.size}/${instruments.length} priced so far)`
    );
  }
  process.stdout.write('\n');
  return priced;
}

function summarizeByStep(rows) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, missing: 0 };
  for (const row of rows) {
    if (row.success_step == null) counts.missing += 1;
    else counts[row.success_step] += 1;
  }
  return counts;
}

async function main() {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const client = createIbkrSnapshotClient();

  let sample;
  if (CONIDS_ARG) {
    const conids = CONIDS_ARG.split(',').map((value) => Number(value.trim())).filter(Boolean);
    const universe = await loadUniverse();
    const byConid = new Map(universe.map((row) => [row.conid, row]));
    sample = conids.map((conid) => byConid.get(conid) ?? { conid, symbol: null, exchangeId: null });
  } else {
    const [universe, priceMap] = await Promise.all([loadUniverse(), loadPrices()]);
    sample = buildSample(universe, priceMap, SAMPLE_SIZE);
  }

  const byConid = new Map(sample.map((row) => [row.conid, row]));
  const state = new Map(
    sample.map((row) => [
      row.conid,
      {
        conid: row.conid,
        symbol: row.symbol ?? null,
        exchange_id: row.exchangeId ?? null,
        success_step: null,
        success_step_label: null,
        last: null,
        last_raw: null,
        field_31: null,
      },
    ])
  );

  console.log(`IBKR preflight ladder probe`);
  console.log(`  run_id: ${runId}`);
  console.log(`  sample: ${sample.length} tickers, batch_size: ${BATCH_SIZE}`);
  console.log(`  host: ${process.env.VERCEL_REGION ?? process.env.AWS_REGION ?? 'local'}`);
  console.log('');

  const stepSummaries = [];

  for (const stepConfig of STEPS) {
    const pending = sample.filter((row) => state.get(row.conid).success_step == null);
    if (!pending.length) {
      console.log(`Step ${stepConfig.step} (${stepConfig.label}): skipped — nothing pending`);
      stepSummaries.push({
        step: stepConfig.step,
        label: stepConfig.label,
        attempted: 0,
        newly_priced: 0,
      });
      continue;
    }

    console.log(
      `Step ${stepConfig.step} (${stepConfig.label}): ${pending.length} tickers, ` +
        `preflight=${stepConfig.preflightCount}, wait=${stepConfig.preflightWaitMs}ms`
    );

    let newlyPriced = 0;
    try {
      const priced = await runStep(client, pending, stepConfig, byConid);
      for (const [conid, row] of priced) {
        const entry = state.get(conid);
        if (entry.success_step == null && row.last != null) {
          entry.success_step = stepConfig.step;
          entry.success_step_label = stepConfig.label;
          entry.last = row.last;
          entry.last_raw = row.last_raw;
          entry.field_31 = row.field_31;
          newlyPriced += 1;
        }
      }
    } catch (error) {
      console.error(`\nStep ${stepConfig.step} failed: ${error.message}`);
      stepSummaries.push({
        step: stepConfig.step,
        label: stepConfig.label,
        attempted: pending.length,
        newly_priced: newlyPriced,
        error: error.message,
      });
      break;
    }

    stepSummaries.push({
      step: stepConfig.step,
      label: stepConfig.label,
      attempted: pending.length,
      newly_priced: newlyPriced,
    });
    console.log(`  → newly priced: ${newlyPriced}`);
  }

  const rows = [...state.values()];
  const byStep = summarizeByStep(rows);
  const finishedAt = new Date().toISOString();

  const report = {
    run_id: runId,
    probe_type: 'ibkr_preflight_ladder',
    started_at: startedAt,
    finished_at: finishedAt,
    sample_size: sample.length,
    batch_size: BATCH_SIZE,
    steps: STEPS,
    step_summaries: stepSummaries,
    summary: {
      total: rows.length,
      priced: rows.filter((row) => row.success_step != null).length,
      missing: rows.filter((row) => row.success_step == null).length,
      by_step: byStep,
    },
    metrics: client.metrics,
    results: rows,
    ladder_rows: rows.map((row) => ({
      run_id: runId,
      conid: row.conid,
      symbol: row.symbol,
      exchange_id: row.exchange_id,
      success_step: row.success_step,
      success_step_label: row.success_step_label,
      last: row.last,
      last_raw: row.last_raw,
    })),
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log('');
  console.log('Summary:');
  console.log(`  priced: ${report.summary.priced}/${report.summary.total}`);
  console.log(`  step 1: ${byStep[1]}, step 2: ${byStep[2]}, step 3: ${byStep[3]}, step 4: ${byStep[4]}`);
  console.log(`  still missing: ${byStep.missing}`);
  console.log(`  IBKR requests: ${client.metrics.requests}, 429s: ${client.metrics.rateLimited}`);
  console.log(`  wrote ${OUTPUT_PATH}`);

  if (report.summary.priced === 0) {
    console.error('\nWARNING: zero tickers priced — IBKR may be unreachable from this environment.');
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
