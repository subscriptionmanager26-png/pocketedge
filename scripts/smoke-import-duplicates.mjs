/**
 * Smoke: duplicate merge identities (key / ISIN / AMFI / name) + qty statuses.
 * Usage: npx vite-node scripts/smoke-import-duplicates.mjs
 */
import {
  mergePortfolioImportWithAssets,
  qtysEqual,
} from '../src/lib/portfolioImportMerge.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assetMap(entries) {
  const map = new Map();
  for (const [token, asset] of entries) {
    map.set(token, asset);
    map.set(asset.key, asset);
    if (asset.isin) map.set(asset.isin, asset);
  }
  return map;
}

async function main() {
  assert(qtysEqual('10', 10), 'qty string/number');
  assert(qtysEqual('10.0', '10'), 'qty trailing zero');
  assert(!qtysEqual('10', '11'), 'qty different');

  const reliance = {
    key: 'RELIANCE',
    symbol: 'RELIANCE',
    name: 'Reliance Industries',
    kind: 'stock',
    isin: 'INE002A01018',
  };
  const ppfas = {
    key: '120503',
    symbol: '120503',
    name: 'Parag Parikh Flexi Cap Fund Direct Growth',
    kind: 'fund',
    isin: 'INF879O01027',
  };
  const mirae = {
    key: '140502',
    symbol: '140502',
    name: 'Mirae Asset Large Cap Fund Direct Growth',
    kind: 'fund',
    isin: 'INF209K01EN2',
  };

  const assets = assetMap([
    ['RELIANCE', reliance],
    ['INE002A01018', reliance],
    ['120503', ppfas],
    ['INF879O01027', ppfas],
    ['INF209K01EN2', mirae],
    ['140502', mirae],
  ]);

  const current = [
    { id: 'c1', ticker: 'RELIANCE', name: '', isin: null, qty: '10' },
    {
      id: 'c2',
      ticker: '120503',
      name: 'Parag Parikh Flexi Cap Fund Direct Growth',
      isin: null,
      qty: '50.5',
    },
  ];

  // Same qty: portfolio symbols/scheme codes vs PDF ISINs → Same
  const same = mergePortfolioImportWithAssets({
    currentRows: current,
    importedRows: [
      {
        id: 'i1',
        ticker: 'INE002A01018',
        name: 'RELIANCE INDUSTRIES LTD',
        isin: 'INE002A01018',
        qty: '10',
      },
      {
        id: 'i2',
        ticker: 'INF879O01027',
        name: 'Parag Parikh Flexi Cap Fund - Direct Plan',
        isin: 'INF879O01027',
        amfi: '120503',
        qty: '50.5',
      },
    ],
    assetsByToken: assets,
    makeRowId: () => 'new',
  });
  assert(same.staleRows.length === 0, `stale ${same.staleRows.length}`);
  assert(
    same.reviewRows.length === 2 && same.reviewRows.every((r) => r.matchStatus === 'unchanged'),
    `expected unchanged, got ${same.reviewRows.map((r) => r.matchStatus)}`
  );
  console.log('same qty duplicates → Same: ok');

  // Different qty → Updated
  const updated = mergePortfolioImportWithAssets({
    currentRows: current,
    importedRows: [
      {
        id: 'i1',
        ticker: 'INE002A01018',
        isin: 'INE002A01018',
        qty: '25',
      },
      {
        id: 'i2',
        ticker: '120503',
        isin: 'INF879O01027',
        amfi: '120503',
        qty: '60',
      },
    ],
    assetsByToken: assets,
    makeRowId: () => 'new',
  });
  assert(updated.staleRows.length === 0, 'diff qty stale');
  assert(
    updated.reviewRows.every((r) => r.matchStatus === 'updated'),
    `expected updated, got ${updated.reviewRows.map((r) => r.matchStatus)}`
  );
  console.log('different qty duplicates → Updated: ok');

  // Name-only match when tickers differ / unresolved current token
  const nameMatch = mergePortfolioImportWithAssets({
    currentRows: [
      {
        id: 'c3',
        ticker: 'MIRAELOCAL',
        name: 'Mirae Asset Large Cap Fund Direct Growth',
        isin: null,
        qty: '3',
      },
    ],
    importedRows: [
      {
        id: 'i3',
        ticker: 'INF209K01EN2',
        name: 'Mirae Asset Large Cap Fund Direct Growth',
        isin: 'INF209K01EN2',
        qty: '3',
      },
    ],
    assetsByToken: assets,
    makeRowId: () => 'x',
  });
  assert(
    nameMatch.reviewRows.some((r) => r.matchStatus === 'unchanged'),
    `name match failed: ${JSON.stringify(nameMatch)}`
  );
  console.log('name match → Same: ok');

  // Truly new holding
  const mixed = mergePortfolioImportWithAssets({
    currentRows: current,
    importedRows: [
      { id: 'i1', ticker: 'INE002A01018', isin: 'INE002A01018', qty: '10' },
      { id: 'iNew', ticker: 'INF209K01EN2', isin: 'INF209K01EN2', qty: '1' },
    ],
    assetsByToken: assets,
    makeRowId: () => 'brand-new',
  });
  assert(mixed.staleRows.some((r) => r.ticker === '120503'), 'ppfas should be stale');
  assert(mixed.reviewRows.some((r) => r.matchStatus === 'unchanged'), 'reliance same');
  assert(mixed.reviewRows.some((r) => r.matchStatus === 'new'), 'mirae new');
  console.log('new + stale mix: ok');

  console.log('all duplicate cases passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
