#!/usr/bin/env node
/**
 * Fetch Yahoo holdings + sector data for the full UCITS universe.
 * Resumable via checkpoint file.
 *
 * Usage:
 *   node scripts/fetch-ucits-screener.mjs
 *   node scripts/fetch-ucits-screener.mjs --resume
 *     Skips rows already enriched (ok); retries miss/error rows.
 *   node scripts/fetch-ucits-screener.mjs --delay=200
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enrichUcits, ucitsRowId } from './lib/ucits-screener-enrich.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const UCITS_PATH = join(ROOT, 'data/ucits-info-instruments.json');
const OUT_PATH = join(ROOT, 'public/data/ucits-screener.json');
const CHECKPOINT_PATH = join(ROOT, 'data/ucits-screener-checkpoint.json');
const MANIFEST_PATH = join(ROOT, 'data/ucits-screener-manifest.json');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs() {
  const resume = process.argv.includes('--resume');
  const delay = Number(process.argv.find((a) => a.startsWith('--delay='))?.split('=')[1] || 200);
  const checkpointEvery = Number(
    process.argv.find((a) => a.startsWith('--checkpoint='))?.split('=')[1] || 25,
  );
  return { resume, delay, checkpointEvery };
}

function loadCheckpoint() {
  if (!existsSync(CHECKPOINT_PATH)) {
    return { funds: [], processed: {}, failures: [] };
  }
  const data = JSON.parse(readFileSync(CHECKPOINT_PATH, 'utf8'));
  return {
    funds: data.funds || [],
    processed: data.processed || {},
    failures: data.failures || [],
  };
}

function saveCheckpoint(state, universeSize) {
  writeFileSync(
    CHECKPOINT_PATH,
    `${JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        universeSize,
        fundsCount: state.funds.length,
        processedCount: Object.keys(state.processed).length,
        failureCount: state.failures.length,
        funds: state.funds,
        processed: state.processed,
        failures: state.failures,
      },
      null,
      2,
    )}\n`,
  );
}

function writeOutput(state, universeSize) {
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'ucits.info + Yahoo Finance quoteSummary',
    universeSize,
    sampleSize: state.funds.length,
    funds: state.funds,
  };
  writeFileSync(OUT_PATH, `${JSON.stringify(payload)}\n`);
  writeFileSync(
    MANIFEST_PATH,
    `${JSON.stringify(
      {
        generatedAt: payload.generatedAt,
        universeSize,
        enrichedCount: state.funds.length,
        processedCount: Object.keys(state.processed).length,
        failureCount: state.failures.length,
        successRate:
          Object.keys(state.processed).length > 0
            ? `${Math.round((state.funds.length / Object.keys(state.processed).length) * 100)}%`
            : '0%',
        failures: state.failures.slice(-50),
      },
      null,
      2,
    )}\n`,
  );
}

async function main() {
  const { resume, delay, checkpointEvery } = parseArgs();
  const all = JSON.parse(readFileSync(UCITS_PATH, 'utf8'));
  const state = resume ? loadCheckpoint() : { funds: [], processed: {}, failures: [] };

  console.log(
    `UCITS screener fetch — ${all.length} instruments, ${state.funds.length} already enriched, resume=${resume}`,
  );

  let sinceCheckpoint = 0;

  for (let i = 0; i < all.length; i += 1) {
    const row = all[i];
    const id = ucitsRowId(row);
    if (resume && state.processed[id] === 'ok') continue;

    const progress = `[${i + 1}/${all.length}]`;
    process.stdout.write(`${progress} ${row.symbol} (${row.exchange})… `);

    try {
      const enriched = await enrichUcits(row, { delayMs: 120 });
      state.processed[id] = enriched ? 'ok' : 'miss';

      if (enriched) {
        const existingIdx = state.funds.findIndex((f) => f.id === id);
        if (existingIdx >= 0) state.funds[existingIdx] = enriched;
        else state.funds.push(enriched);
        state.failures = state.failures.filter((f) => f.id !== id);
        console.log(`✓ ${enriched.yahooSymbol}`);
      } else {
        state.failures.push({ id, symbol: row.symbol, exchange: row.exchange, reason: 'no_yahoo_data' });
        console.log('—');
      }
    } catch (err) {
      state.processed[id] = 'error';
      state.failures.push({ id, symbol: row.symbol, exchange: row.exchange, reason: err.message });
      console.log(`× ${err.message}`);
      if (String(err.message).includes('429')) {
        console.log('Rate limited — sleeping 30s…');
        await sleep(30000);
      }
    }

    sinceCheckpoint += 1;
    if (sinceCheckpoint >= checkpointEvery) {
      saveCheckpoint(state, all.length);
      writeOutput(state, all.length);
      sinceCheckpoint = 0;
      console.log(`  ↳ checkpoint (${state.funds.length} funds)`);
    }

    await sleep(delay);
  }

  saveCheckpoint(state, all.length);
  writeOutput(state, all.length);

  console.log(`\nDone. ${state.funds.length} funds enriched → ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
