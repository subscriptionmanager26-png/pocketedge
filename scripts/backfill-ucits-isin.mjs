#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadUcitsIsinIndex, lookupIsinForUcitsRow } from './lib/ucits-isin-index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '../public/data/ucits-screener.json');

function main() {
  const payload = JSON.parse(readFileSync(OUT_PATH, 'utf8'));
  const index = loadUcitsIsinIndex();
  const funds = payload.funds || [];

  let added = 0;
  let unchanged = 0;
  let stillMissing = 0;

  for (const fund of funds) {
    if (fund.isin) {
      unchanged += 1;
      continue;
    }

    const isin = lookupIsinForUcitsRow(fund, index);
    if (isin) {
      fund.isin = isin;
      added += 1;
    } else {
      stillMissing += 1;
    }
  }

  payload.generatedAt = new Date().toISOString();
  writeFileSync(OUT_PATH, `${JSON.stringify(payload)}\n`);

  console.log(`ISIN backfill: added ${added}, already had ${unchanged}, still missing ${stillMissing}/${funds.length}`);
}

main();
