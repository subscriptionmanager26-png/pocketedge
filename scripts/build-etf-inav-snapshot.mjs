#!/usr/bin/env node
/**
 * Merge AMC iNAV CSV with NSE ETF LTP catalog into a static snapshot
 * for /resources/etf-inav.
 *
 * Usage:
 *   node scripts/build-etf-inav-snapshot.mjs
 *   node scripts/build-etf-inav-snapshot.mjs --inav data/etf-inav/amc-inav.csv
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyEtfCategory } from '../src/lib/etfInav/categories.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = {
    inav: path.join(ROOT, 'data/etf-inav/amc-inav.csv'),
    etf: path.join(ROOT, 'public/data/markets/etf.json'),
    out: path.join(ROOT, 'public/data/etf-inav/etf-inav-snapshot.json'),
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--inav') out.inav = path.resolve(ROOT, argv[++i]);
    else if (argv[i] === '--etf') out.etf = path.resolve(ROOT, argv[++i]);
    else if (argv[i] === '--out') out.out = path.resolve(ROOT, argv[++i]);
  }
  return out;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    // Simple CSV (no embedded commas in our AMC scrape)
    const cols = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? '').trim();
    });
    return row;
  });
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function premiumRatio(ltp, inav) {
  if (ltp == null || inav == null || inav === 0) return null;
  return ltp / inav;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [inavText, etfJson] = await Promise.all([
    readFile(args.inav, 'utf8'),
    readFile(args.etf, 'utf8'),
  ]);

  const etfCatalog = JSON.parse(etfJson);
  const etfBySymbol = new Map(
    (etfCatalog.items || []).map((item) => [String(item.symbol).toUpperCase(), item]),
  );

  const inavRows = parseCsv(inavText);
  const bySymbol = new Map();

  for (const row of inavRows) {
    const symbol = String(row.NSE_Symbol || row.symbol || '')
      .trim()
      .toUpperCase();
    const inav = num(row.INAV ?? row.inav);
    if (!symbol || inav == null) continue;

    const nse = etfBySymbol.get(symbol);
    const ltp = nse ? num(nse.ltp) : null;
    const name = nse?.name || row.ETF || symbol;
    const etfName = row.ETF || name;
    const amc = row.AMC || null;
    const ratio = premiumRatio(ltp, inav);
    const category = classifyEtfCategory({ name, symbol, etfName });

    bySymbol.set(symbol, {
      symbol,
      name,
      etfName,
      amc,
      category,
      ltp,
      // AMC scrape is the iNAV truth for the tracker (not NSE nav).
      inav,
      amcInav: inav,
      nseNav: nse ? num(nse.nav) : null,
      changePct: nse ? num(nse.changePct) : null,
      premium: ratio,
      premiumPct: ratio == null ? null : (ratio - 1) * 100,
    });
  }

  const items = [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  const withBoth = items.filter((i) => i.ltp != null && i.inav != null).length;

  const snapshot = {
    generatedAt: new Date().toISOString(),
    nseSyncedAt: etfCatalog.syncedAt || null,
    source: {
      inavCsv: path.relative(ROOT, args.inav),
      etfJson: path.relative(ROOT, args.etf),
    },
    counts: {
      items: items.length,
      withLtpAndInav: withBoth,
      categories: Object.fromEntries(
        [...new Set(items.map((i) => i.category))]
          .sort()
          .map((c) => [c, items.filter((i) => i.category === c).length]),
      ),
    },
    items,
  };

  await mkdir(path.dirname(args.out), { recursive: true });
  await writeFile(args.out, `${JSON.stringify(snapshot)}\n`, 'utf8');
  console.log(
    `Wrote ${items.length} ETFs (${withBoth} with LTP+iNAV) → ${path.relative(ROOT, args.out)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
