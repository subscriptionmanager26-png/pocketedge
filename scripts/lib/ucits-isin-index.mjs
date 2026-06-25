/**
 * ISIN lookup for UCITS rows via IBKR ETF instrument file.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { yahooSymbolCandidates } from './ucits-yahoo-symbol.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IBKR_CSV = join(__dirname, '../../data/ibkr-instruments.csv');

const IBKR_TO_UCITS_EXCHANGE = {
  LSEETF: 'LSE',
  LSE: 'LSE',
  AEB: 'XETR',
  IBIS: 'XETR',
  GETTEX: 'XETR',
  TGATE: 'XETR',
  SBF: 'Euronext',
  EPA: 'Euronext',
  ENEXT: 'Euronext',
  EBS: 'SIX',
  BVME: 'MTA',
  MTAA: 'MTA',
  XAMS: 'AMS',
  XETR: 'XETR',
  XSWX: 'SIX',
  FWB: 'XETR',
  SWB: 'XETR',
};

function normalizeSymbol(symbol = '') {
  return String(symbol).trim().toUpperCase().split('.')[0];
}

export function loadUcitsIsinIndex(csvPath = IBKR_CSV) {
  const isinByFundKey = new Map();
  const listingsByIsin = new Map();

  for (const line of readFileSync(csvPath, 'utf8').split('\n')) {
    if (!line || line.startsWith('conid')) continue;
    const cols = line.split(',');
    if (cols[10] !== 'ETF') continue;

    const symbol = cols[2];
    const exchangeId = cols[4];
    const isin = cols[7]?.trim();
    if (!isin || isin.length < 10) continue;

    const fundKey = `${normalizeSymbol(symbol)}|${exchangeId}`;
    if (!isinByFundKey.has(fundKey)) {
      isinByFundKey.set(fundKey, isin);
    }

    const ucitsExchange = IBKR_TO_UCITS_EXCHANGE[exchangeId] || exchangeId;
    const listing = {
      symbol: normalizeSymbol(symbol),
      exchangeId,
      ucitsExchange,
      yahooCandidates: yahooSymbolCandidates(symbol, ucitsExchange),
    };

    const bucket = listingsByIsin.get(isin) || [];
    const dedupeKey = `${listing.symbol}|${listing.ucitsExchange}`;
    if (!bucket.some((entry) => `${entry.symbol}|${entry.ucitsExchange}` === dedupeKey)) {
      bucket.push(listing);
      listingsByIsin.set(isin, bucket);
    }
  }

  return { isinByFundKey, listingsByIsin, ibkrToUcitsExchange: IBKR_TO_UCITS_EXCHANGE };
}

export function lookupIsinForUcitsRow(row, index) {
  const symbol = normalizeSymbol(row.symbol);
  const exchange = row.exchange;

  for (const [ibkrExchange, ucitsExchange] of Object.entries(index.ibkrToUcitsExchange)) {
    if (ucitsExchange !== exchange) continue;
    const isin = index.isinByFundKey.get(`${symbol}|${ibkrExchange}`);
    if (isin) return isin;
  }

  for (const ibkrExchange of [exchange, `${exchange}ETF`]) {
    const isin = index.isinByFundKey.get(`${symbol}|${ibkrExchange}`);
    if (isin) return isin;
  }

  return null;
}

export function yahooCandidatesForIsin(isin, index, { exclude = [] } = {}) {
  if (!isin) return [];
  const skip = new Set(exclude);
  const out = [];
  for (const listing of index.listingsByIsin.get(isin) || []) {
    for (const candidate of listing.yahooCandidates) {
      if (!skip.has(candidate) && !out.includes(candidate)) {
        out.push(candidate);
      }
    }
  }
  return out;
}
