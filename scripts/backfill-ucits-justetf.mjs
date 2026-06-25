#!/usr/bin/env node
/**
 * JustETF fallback for missing AUM and/or index (one request per ISIN).
 *
 * Usage:
 *   node scripts/backfill-ucits-justetf.mjs
 *   node scripts/backfill-ucits-justetf.mjs --aum-only
 *   node scripts/backfill-ucits-justetf.mjs --index-only
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyIsinPeerAumFallback } from './lib/ucits-aum.mjs';
import { applyUsdAumToFunds, fetchFxRatesToUsd } from './lib/ucits-aum-usd.mjs';
import { fetchJustEtfProfileData } from './lib/justetf-profile-data.mjs';
import { loadUcitsIsinIndex, lookupIsinForUcitsRow } from './lib/ucits-isin-index.mjs';
import { applyIsinPeerIndexFallback } from './lib/ucits-tracked-index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '../public/data/ucits-screener.json');

function applyProfileToFund(fund, profile, { aumOnly, indexOnly }) {
  if (!profile) return { aum: false, index: false };

  let aum = false;
  let index = false;

  if (!indexOnly && fund.aum == null && profile.aum != null) {
    fund.aum = profile.aum;
    fund.aumFmt = profile.aumFmt;
    fund.aumCurrency = profile.aumCurrency;
    fund.aumMillions = profile.aumMillions;
    fund.aumSource = profile.aumSource;
    fund.aumSymbol = profile.aumSymbol;
    aum = true;
  }

  if (!aumOnly && !fund.trackedIndex && profile.trackedIndex) {
    fund.trackedIndex = profile.trackedIndex;
    fund.trackedIndexSource = profile.trackedIndexSource;
    index = true;
  }

  return { aum, index };
}

async function main() {
  const aumOnly = process.argv.includes('--aum-only');
  const indexOnly = process.argv.includes('--index-only');
  const payload = JSON.parse(readFileSync(OUT_PATH, 'utf8'));
  const index = loadUcitsIsinIndex();
  const funds = payload.funds || [];

  for (const fund of funds) {
    if (!fund.isin) fund.isin = lookupIsinForUcitsRow(fund, index);
  }

  const needsFetch = new Set();
  for (const fund of funds) {
    if (!fund.isin) continue;
    let shouldFetch = false;
    if (aumOnly) shouldFetch = fund.aum == null;
    else if (indexOnly) shouldFetch = !fund.trackedIndex;
    else shouldFetch = fund.aum == null || !fund.trackedIndex;
    if (shouldFetch) needsFetch.add(fund.isin);
  }

  const isins = [...needsFetch];
  console.log(`JustETF fallback for ${isins.length} unique ISINs…`);

  let fetched = 0;
  let aumFilled = 0;
  let indexFilled = 0;
  let misses = 0;

  for (let i = 0; i < isins.length; i += 1) {
    const isin = isins[i];
    const sample = [...funds].find((f) => f.isin === isin);
    process.stdout.write(`[${i + 1}/${isins.length}] ${sample?.symbol || isin} (${isin})… `);

    const profile = await fetchJustEtfProfileData(isin, { delayMs: 1000, retries: 4, useCache: true });
    if (!profile) {
      misses += 1;
      console.log('—');
      continue;
    }

    fetched += 1;
    const parts = [];
    if (profile.aumFmt) parts.push(`AUM ${profile.aumFmt} ${profile.aumCurrency || ''}`.trim());
    if (profile.trackedIndex) parts.push(`Index ${profile.trackedIndex}`);
    console.log(`✓ ${parts.join(' · ')}`);

    for (const fund of funds) {
      if (fund.isin !== isin) continue;
      const applied = applyProfileToFund(fund, profile, { aumOnly, indexOnly });
      if (applied.aum) aumFilled += 1;
      if (applied.index) indexFilled += 1;
    }
  }

  const peerAum = applyIsinPeerAumFallback(funds);
  const peerIndex = applyIsinPeerIndexFallback(funds);
  const rates = await fetchFxRatesToUsd();
  const usdConverted = applyUsdAumToFunds(funds, rates);

  payload.generatedAt = new Date().toISOString();
  writeFileSync(OUT_PATH, `${JSON.stringify(payload)}\n`);

  const withAum = funds.filter((f) => f.aum != null).length;
  const withIndex = funds.filter((f) => f.trackedIndex).length;
  console.log(`\nDone. profiles=${fetched} misses=${misses}`);
  console.log(`AUM ${withAum}/${funds.length} (+${aumFilled} listings, peer ${peerAum}, usd ${usdConverted})`);
  console.log(`Index ${withIndex}/${funds.length} (+${indexFilled} listings, peer ${peerIndex})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
