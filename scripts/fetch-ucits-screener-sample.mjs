#!/usr/bin/env node
/**
 * Fetch Yahoo holdings + sector data for a sample of UCITS funds.
 *
 * Usage:
 *   node scripts/fetch-ucits-screener-sample.mjs [--limit 100]
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchYahooQuoteSummary,
  inferTrackedIndex,
  parseSectorWeightings,
  parseTopHoldings,
} from './lib/yahoo-quote-summary.mjs';
import { resolveYahooSymbolForUcits } from './lib/ucits-yahoo-symbol.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const UCITS_PATH = join(ROOT, 'data/ucits-info-instruments.json');
const OUT_PATH = join(ROOT, 'data/ucits-screener-sample.json');
const MANIFEST_PATH = join(ROOT, 'data/ucits-screener-manifest.json');

const PROVIDER_KEYWORDS = [
  'ishares',
  'vanguard',
  'amundi',
  'invesco',
  'spdr',
  'xtrackers',
  'lyxor',
  'ubs',
  'wisdomtree',
  'hsbc',
  'jpmorgan',
  'franklin',
  'pimco',
  'ssga',
  'state street',
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const CURATED_SYMBOLS = new Set([
  'CSPX', 'EQQQ', 'IWDA', 'VWRA', 'VWCE', 'SXR8', 'IMEU', 'CNYA', 'EMIM', 'AGGU',
  'VUSA', 'VUKE', 'VMID', 'VHYL', 'VAPX', 'VFEM', 'SPX5', 'ACWD', 'CNDX', 'SWDA',
  'IUSA', 'IDTL', 'SWRD', 'HMWO', 'EIMI', 'IJPA', 'CIBR', 'WTEF', 'LQDA', 'SDIA',
  'CBU0', 'CBUX', 'EXSA', 'EXS1', 'EXW1', 'EXV1', 'EXV4', 'EXV6', 'EXXY', 'XD9U',
  'XDWG', 'XESC', 'XGLE', 'XJSE', 'XMLD', 'XMME', 'XMWO', 'XNAS', 'XSX6', 'XXSC',
]);

function scoreInstrument(row) {
  const name = row.name.toLowerCase();
  let score = 0;
  if (CURATED_SYMBOLS.has(row.symbol)) score += 20;
  if (row.symbol.length <= 5 && /^[A-Z0-9]+$/i.test(row.symbol)) score += 2;
  for (const kw of PROVIDER_KEYWORDS) {
    if (name.includes(kw)) score += 3;
  }
  if (/msci|s&p|nasdaq|ftse|stoxx|dax|cac/i.test(name)) score += 2;
  if (row.exchange === 'LSE' || row.exchange === 'XETR') score += 1;
  return score;
}

function pickCandidates(all, targetPool = 180) {
  const picked = [];
  const seen = new Set();

  for (const symbol of CURATED_SYMBOLS) {
    for (const row of all) {
      if (row.symbol !== symbol) continue;
      const key = `${row.symbol}:${row.exchange}`;
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(row);
    }
  }

  const ranked = [...all]
    .map((row) => ({ row, score: scoreInstrument(row) }))
    .sort((a, b) => b.score - a.score || a.row.symbol.localeCompare(b.row.symbol));

  for (const { row } of ranked) {
    const key = `${row.symbol}:${row.exchange}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(row);
    if (picked.length >= targetPool) break;
  }

  return picked;
}

async function enrichUcits(row) {
  const resolved = await resolveYahooSymbolForUcits(row);
  if (!resolved) return null;

  await sleep(120);
  const summary = await fetchYahooQuoteSummary(resolved.yahooSymbol);
  if (!summary?.topHoldings) return null;

  const quoteType = summary.quoteType || {};
  const fundProfile = summary.fundProfile || {};
  const topHoldings = summary.topHoldings || {};
  const longName = quoteType.longName || row.name;
  const trackedIndex = inferTrackedIndex(row.name, longName);

  return {
    id: `${row.symbol}-${row.exchange}`,
    symbol: row.symbol,
    exchange: row.exchange,
    domicile: row.domicile,
    name: row.name.replace(/&amp;/g, '&'),
    yahooSymbol: resolved.yahooSymbol,
    longName,
    shortName: quoteType.shortName || null,
    quoteType: quoteType.quoteType || 'ETF',
    yahooExchange: quoteType.exchange || resolved.exchangeName || null,
    currency: resolved.currency || null,
    family: fundProfile.family || null,
    legalType: fundProfile.legalType || null,
    expenseRatio:
      fundProfile.feesExpensesInvestment?.annualReportExpenseRatio?.fmt ||
      fundProfile.feesExpensesInvestment?.annualReportExpenseRatio?.raw ||
      null,
    turnover:
      fundProfile.feesExpensesInvestment?.annualHoldingsTurnover?.fmt ||
      fundProfile.feesExpensesInvestment?.annualHoldingsTurnover?.raw ||
      null,
    trackedIndex,
    assetMix: {
      stock: topHoldings.stockPosition?.fmt || null,
      bond: topHoldings.bondPosition?.fmt || null,
      cash: topHoldings.cashPosition?.fmt || null,
      other: topHoldings.otherPosition?.fmt || null,
    },
    sectorWeightings: parseSectorWeightings(topHoldings.sectorWeightings),
    topHoldings: parseTopHoldings(topHoldings.holdings),
    fetchedAt: new Date().toISOString(),
  };
}

async function main() {
  const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 100);
  const all = JSON.parse(readFileSync(UCITS_PATH, 'utf8'));
  const candidates = pickCandidates(all, Math.max(limit * 2, 150));

  console.log(`Trying up to ${candidates.length} UCITS candidates to collect ${limit} enriched rows…`);

  const funds = [];
  const failures = [];

  for (const row of candidates) {
    if (funds.length >= limit) break;

    process.stdout.write(`  · ${row.symbol} (${row.exchange})… `);
    try {
      const enriched = await enrichUcits(row);
      if (enriched) {
        funds.push(enriched);
        console.log(`✓ ${enriched.yahooSymbol}`);
      } else {
        failures.push({ symbol: row.symbol, exchange: row.exchange, reason: 'no_yahoo_data' });
        console.log('—');
      }
    } catch (err) {
      failures.push({ symbol: row.symbol, exchange: row.exchange, reason: err.message });
      console.log('×');
    }

    await sleep(280);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'ucits.info + Yahoo Finance quoteSummary',
    universeSize: all.length,
    sampleSize: funds.length,
    funds,
  };

  writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(
    MANIFEST_PATH,
    `${JSON.stringify(
      {
        generatedAt: payload.generatedAt,
        universeSize: all.length,
        sampleSize: funds.length,
        failureCount: failures.length,
        failures: failures.slice(0, 30),
      },
      null,
      2,
    )}\n`,
  );

  console.log(`\nSaved ${funds.length} funds → ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
