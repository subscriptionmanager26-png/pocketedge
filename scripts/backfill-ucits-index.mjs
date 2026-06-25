#!/usr/bin/env node
/**
 * Backfill trackedIndex on existing ucits-screener.json.
 *
 * Usage:
 *   node scripts/backfill-ucits-index.mjs
 *   node scripts/backfill-ucits-index.mjs --justetf
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchJustEtfProfileHtml } from './lib/justetf-profile.mjs';
import { loadUcitsIsinIndex, lookupIsinForUcitsRow } from './lib/ucits-isin-index.mjs';
import {
  applyIsinPeerIndexFallback,
  extractJustEtfIndexFromHtml,
  inferTrackedIndex,
  normalizeTrackedIndexLabel,
} from './lib/ucits-tracked-index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_PATH = join(ROOT, 'public/data/ucits-screener.json');

async function main() {
  const fetchJustEtf = process.argv.includes('--justetf');
  const payload = JSON.parse(readFileSync(OUT_PATH, 'utf8'));
  const index = loadUcitsIsinIndex();
  const funds = payload.funds || [];

  let fromName = 0;
  let fromJustEtf = 0;

  for (const fund of funds) {
    if (!fund.isin) fund.isin = lookupIsinForUcitsRow(fund, index);
    if (fund.trackedIndex) {
      fund.trackedIndex = normalizeTrackedIndexLabel(fund.trackedIndex);
      continue;
    }

    const inferred = inferTrackedIndex(fund.name, fund.longName || fund.name);
    if (inferred) {
      fund.trackedIndex = inferred;
      fund.trackedIndexSource = 'name';
      fromName += 1;
    }
  }

  const peerFilled = applyIsinPeerIndexFallback(funds);

  if (fetchJustEtf) {
    const cache = new Map();
    const missing = funds.filter((f) => !f.trackedIndex && f.isin);
    console.log(`JustETF index fallback for ${missing.length} funds…`);

    for (let i = 0; i < missing.length; i += 1) {
      const fund = missing[i];
      let html = cache.get(fund.isin);

      if (!html) {
        process.stdout.write(`[${i + 1}/${missing.length}] ${fund.symbol} (${fund.isin})… `);
        html = await fetchJustEtfProfileHtml(fund.isin, { delayMs: 250, retries: 4 });
        if (html) cache.set(fund.isin, html);
        const tracked = html ? extractJustEtfIndexFromHtml(html) : null;
        console.log(tracked || '—');
        if (tracked) fromJustEtf += 1;
      }

      const tracked = html ? extractJustEtfIndexFromHtml(html) : null;
      if (tracked) {
        fund.trackedIndex = tracked;
        fund.trackedIndexSource = 'justetf';
      }
    }

    applyIsinPeerIndexFallback(funds);
  }

  const withIndex = funds.filter((f) => f.trackedIndex).length;
  payload.generatedAt = new Date().toISOString();
  payload.funds = funds;
  writeFileSync(OUT_PATH, `${JSON.stringify(payload)}\n`);

  console.log(
    `\nDone. Index coverage ${withIndex}/${funds.length} (${Math.round((withIndex / funds.length) * 100)}%)`,
  );
  console.log(`  name=${fromName} justetf=${fromJustEtf} isin_peer=${peerFilled}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
