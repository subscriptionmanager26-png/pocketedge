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
  FWB: 'XETR',
  SWB: 'XETR',
  SBF: 'Euronext',
  EPA: 'Euronext',
  ENEXT: 'Euronext',
  EBS: 'SIX',
  BVME: 'MTA',
  'BVME.ETF': 'MTA',
  MTAA: 'MTA',
  XAMS: 'AMS',
  XETR: 'XETR',
  XSWX: 'SIX',
  // German venue aliases used in ucits.info
  IBIS2: 'Munich',
  MUN: 'Munich',
  XBER: 'XBER',
  XDUS: 'XDUS',
  XHAN: 'XHAN',
  XHAM: 'XHAM',
  FSX: 'FSX',
};

const UCITS_TO_IBKR_EXCHANGES = {
  LSE: ['LSEETF', 'LSE'],
  XETR: ['IBIS', 'AEB', 'GETTEX', 'TGATE', 'FWB', 'SWB', 'XETR'],
  Munich: ['IBIS', 'GETTEX', 'FWB'],
  FSX: ['IBIS', 'FWB'],
  XBER: ['IBIS', 'FWB'],
  XDUS: ['IBIS', 'GETTEX'],
  XHAN: ['IBIS'],
  XHAM: ['IBIS'],
  Euronext: ['SBF', 'EPA', 'ENEXT'],
  SIX: ['EBS', 'XSWX'],
  MTA: ['BVME', 'BVME.ETF', 'MTAA'],
  AMS: ['XAMS'],
};

function normalizeSymbol(symbol = '') {
  return String(symbol).trim().toUpperCase().split('.')[0];
}

export function loadUcitsIsinIndex(csvPath = IBKR_CSV) {
  const isinByFundKey = new Map();
  const listingsByIsin = new Map();
  const isinsBySymbol = new Map();

  for (const line of readFileSync(csvPath, 'utf8').split('\n')) {
    if (!line || line.startsWith('conid')) continue;
    const cols = line.split(',');
    if (cols[10] !== 'ETF') continue;

    const symbol = cols[2];
    const exchangeId = cols[4];
    const isin = cols[7]?.trim();
    if (!isin || isin.length < 10) continue;

    const normalized = normalizeSymbol(symbol);
    const fundKey = `${normalized}|${exchangeId}`;
    if (!isinByFundKey.has(fundKey)) {
      isinByFundKey.set(fundKey, isin);
    }

    const symbolBucket = isinsBySymbol.get(normalized) || new Set();
    symbolBucket.add(isin);
    isinsBySymbol.set(normalized, symbolBucket);

    const ucitsExchange = IBKR_TO_UCITS_EXCHANGE[exchangeId] || exchangeId;
    const listing = {
      symbol: normalized,
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

  const uniqueIsinBySymbol = new Map();
  for (const [symbol, isins] of isinsBySymbol.entries()) {
    if (isins.size === 1) uniqueIsinBySymbol.set(symbol, [...isins][0]);
  }

  return {
    isinByFundKey,
    listingsByIsin,
    uniqueIsinBySymbol,
    ibkrToUcitsExchange: IBKR_TO_UCITS_EXCHANGE,
    ucitsToIbkrExchanges: UCITS_TO_IBKR_EXCHANGES,
  };
}

export function lookupIsinForUcitsRow(row, index) {
  const symbol = normalizeSymbol(row.symbol);
  const exchange = row.exchange;

  const ibkrExchanges = index.ucitsToIbkrExchanges?.[exchange] || [];
  for (const ibkrExchange of ibkrExchanges) {
    const isin = index.isinByFundKey.get(`${symbol}|${ibkrExchange}`);
    if (isin) return isin;
  }

  for (const [ibkrExchange, ucitsExchange] of Object.entries(index.ibkrToUcitsExchange)) {
    if (ucitsExchange !== exchange) continue;
    const isin = index.isinByFundKey.get(`${symbol}|${ibkrExchange}`);
    if (isin) return isin;
  }

  for (const ibkrExchange of [exchange, `${exchange}ETF`]) {
    const isin = index.isinByFundKey.get(`${symbol}|${ibkrExchange}`);
    if (isin) return isin;
  }

  return index.uniqueIsinBySymbol?.get(symbol) || null;
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
