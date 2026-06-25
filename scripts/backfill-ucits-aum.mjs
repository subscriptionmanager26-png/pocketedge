#!/usr/bin/env node
/**
 * Backfill AUM on existing ucits-screener.json using Yahoo + ISIN + JustETF fallbacks.
 *
 * Usage:
 *   node scripts/backfill-ucits-aum.mjs
 *   node scripts/backfill-ucits-aum.mjs --fetch-alts   # also probe alternate ISIN listings
 *   node scripts/backfill-ucits-aum.mjs --justetf      # JustETF for funds still missing AUM
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchJustEtfAum } from './lib/justetf-aum.mjs';
import {
  applyIsinPeerAumFallback,
  fetchIsinAlternateAum,
  parseYahooAum,
} from './lib/ucits-aum.mjs';
import { loadUcitsIsinIndex, lookupIsinForUcitsRow } from './lib/ucits-isin-index.mjs';
import { applyUsdAumToFunds, fetchFxRatesToUsd } from './lib/ucits-aum-usd.mjs';
import { fetchYahooQuoteSummary } from './lib/yahoo-quote-summary.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_PATH = join(ROOT, 'public/data/ucits-screener.json');
const PROBE_CACHE = '/tmp/ucits-aum-probe.json';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadProbeCache() {
  if (!existsSync(PROBE_CACHE)) return {};
  try {
    return JSON.parse(readFileSync(PROBE_CACHE, 'utf8'));
  } catch {
    return {};
  }
}

function applyAumFields(fund, fields, { source, symbol }) {
  fund.aum = fields.aum ?? null;
  fund.aumFmt = fields.aumFmt ?? null;
  fund.aumCurrency = fields.aumCurrency ?? fund.currency ?? null;
  fund.aumMillions = fields.aumMillions ?? null;
  fund.navPrice = fields.navPrice || fund.navPrice || null;
  fund.aumSource = source;
  fund.aumSymbol = symbol;
}

async function main() {
  const fetchAlts = process.argv.includes('--fetch-alts');
  const fetchJustEtf = process.argv.includes('--justetf');
  const payload = JSON.parse(readFileSync(OUT_PATH, 'utf8'));
  const index = loadUcitsIsinIndex();
  const probeCache = loadProbeCache();
  const funds = payload.funds || [];

  let fromCache = 0;
  let fromFetch = 0;
  let isinAlt = 0;
  let fromJustEtf = 0;

  for (let i = 0; i < funds.length; i += 1) {
    const fund = funds[i];
    if (!fund.isin) fund.isin = lookupIsinForUcitsRow(fund, index);

    const cached = probeCache[fund.id];
    if (cached?.hasAum) {
      applyAumFields(
        fund,
        {
          aum: cached.aumRaw,
          aumFmt: cached.aumFmt,
          aumCurrency: cached.aumCurrency || fund.currency || null,
          navPrice: cached.navFmt,
        },
        { source: 'yahoo', symbol: fund.yahooSymbol },
      );
      fromCache += 1;
      continue;
    }

    if (fund.aum != null) {
      if (!fund.aumCurrency) fund.aumCurrency = fund.currency || null;
      continue;
    }
    if (!fetchAlts) continue;

    process.stdout.write(`[${i + 1}/${funds.length}] ${fund.symbol}… `);

    const summary = await fetchYahooQuoteSummary(
      fund.yahooSymbol,
      'summaryDetail,defaultKeyStatistics',
    );
    const parsed = parseYahooAum(summary);
    if (parsed?.aum != null || parsed?.aumFmt) {
      applyAumFields(fund, parsed, { source: 'yahoo', symbol: fund.yahooSymbol });
      fromFetch += 1;
      console.log(`✓ ${fund.aumFmt} ${fund.aumCurrency || ''}`.trim());
      await sleep(90);
      continue;
    }

    const alt = await fetchIsinAlternateAum(fund, index, {
      exclude: [fund.yahooSymbol],
      delayMs: 90,
      isin: fund.isin,
    });
    if (alt?.aum != null || alt?.aumFmt) {
      applyAumFields(fund, alt, { source: alt.aumSource, symbol: alt.aumSymbol });
      fund.isin = alt.isin || fund.isin;
      isinAlt += 1;
      console.log(`✓ isin ${fund.aumFmt} ${fund.aumCurrency || ''}`.trim());
    } else {
      console.log('—');
    }
    await sleep(90);
  }

  if (fetchJustEtf) {
    const justEtfCache = new Map();
    const missing = funds.filter((f) => f.aum == null && f.isin);
    console.log(`\nJustETF fallback for ${missing.length} funds…`);

    for (let i = 0; i < missing.length; i += 1) {
      const fund = missing[i];
      let result = justEtfCache.get(fund.isin);
      const cached = Boolean(result);

      if (!result) {
        process.stdout.write(`[${i + 1}/${missing.length}] ${fund.symbol} (${fund.isin})… `);
        result = await fetchJustEtfAum(fund.isin, { delayMs: 250, retries: 4 });
        if (result) justEtfCache.set(fund.isin, result);
        console.log(result ? `✓ ${result.aumFmt} ${result.aumCurrency}` : '—');
      }

      if (result) {
        applyAumFields(fund, result, { source: result.aumSource, symbol: result.aumSymbol });
        if (!cached) fromJustEtf += 1;
      }
    }
  }

  const peerFilled = applyIsinPeerAumFallback(funds);
  const rates = await fetchFxRatesToUsd();
  const usdConverted = applyUsdAumToFunds(funds, rates);
  const withAum = funds.filter((f) => f.aum != null).length;

  payload.generatedAt = new Date().toISOString();
  payload.funds = funds;
  writeFileSync(OUT_PATH, `${JSON.stringify(payload)}\n`);

  console.log(
    `\nDone. AUM coverage ${withAum}/${funds.length} (${Math.round((withAum / funds.length) * 100)}%)`,
  );
  console.log(
    `  cache=${fromCache} fetch=${fromFetch} isin_alt=${isinAlt} justetf=${fromJustEtf} isin_peer=${peerFilled} usd=${usdConverted}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
