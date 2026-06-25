#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyUsdAumToFunds, fetchFxRatesToUsd } from './lib/ucits-aum-usd.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '../public/data/ucits-screener.json');

async function main() {
  const payload = JSON.parse(readFileSync(OUT_PATH, 'utf8'));
  const rates = await fetchFxRatesToUsd();
  console.log('FX rates to USD:', rates);

  const converted = applyUsdAumToFunds(payload.funds || [], rates);
  payload.generatedAt = new Date().toISOString();
  writeFileSync(OUT_PATH, `${JSON.stringify(payload)}\n`);

  const withAum = payload.funds.filter((f) => f.aum != null).length;
  const usdOnly = payload.funds.filter((f) => f.aum != null && f.aumCurrency === 'USD').length;
  console.log(`Converted ${converted} funds. AUM coverage ${withAum}/${payload.funds.length}, USD ${usdOnly}/${withAum}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
