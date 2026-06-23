/**
 * Xetra ISIN → German ticker lookup for Yahoo .DE symbols.
 * Sources: scraped Xetra shares + Deutsche Börse ETF master CSV.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const XETRA_JSON = path.join(DATA_DIR, 'xetra-isin-symbols.json');
const XETRA_PARTIAL = path.join(DATA_DIR, 'xetra-isin-symbols.partial.json');
const XETRA_ETF_CSV = path.join(DATA_DIR, 'xetra-etf-etps.csv');

let isinToRowCache = null;
let isinCurrencyCache = null;
let listingsByIsinCache = null;

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      quoted = !quoted;
      continue;
    }
    if (c === ',' && !quoted) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function normalizeRow(raw) {
  if (!raw?.isin || !raw?.mnemonic) return null;
  return {
    isin: String(raw.isin).toUpperCase(),
    mnemonic: String(raw.mnemonic).trim(),
    name: raw.name ?? null,
    currency: raw.trading_currency ?? raw.currency ?? null,
    yahoo_symbol: raw.yahoo_symbol ?? `${raw.mnemonic}.DE`,
    source: raw.source ?? 'xetra',
    product_type: raw.product_type ?? null,
  };
}

function pickPreferredRow(rows, currency) {
  if (!rows?.length) return null;
  const want = currency ? String(currency).toUpperCase() : null;
  if (want) {
    const match = rows.find((r) => String(r.currency ?? '').toUpperCase() === want);
    if (match) return match;
  }
  const eur = rows.find((r) => String(r.currency ?? '').toUpperCase() === 'EUR');
  if (eur) return eur;
  return rows.length === 1 ? rows[0] : rows[0];
}

async function parseEtfCsvFile() {
  try {
    const text = await readFile(XETRA_ETF_CSV, 'utf8');
    const rows = [];
    for (const line of text.split(/\r?\n/).filter(Boolean).slice(1)) {
      const cols = parseCsvLine(line);
      if (cols.length < 12) continue;
      const row = normalizeRow({
        isin: cols[2],
        mnemonic: cols[4],
        name: cols[1],
        product_type: cols[0],
        trading_currency: cols[11],
        source: 'xetra_etf_master',
      });
      if (row) rows.push(row);
    }
    return rows;
  } catch {
    return [];
  }
}

async function readXetraRows() {
  for (const file of [XETRA_JSON, XETRA_PARTIAL]) {
    try {
      const raw = JSON.parse(await readFile(file, 'utf8'));
      if (raw.rows?.length) return raw.rows.map((r) => normalizeRow({ ...r, source: r.source ?? 'xetra_shares' })).filter(Boolean);
      if (raw.by_isin) {
        return Object.values(raw.by_isin).map((r) => normalizeRow({ ...r, source: r.source ?? 'xetra_shares' })).filter(Boolean);
      }
    } catch {
      // try next
    }
  }
  return [];
}

export async function loadXetraIsinMap() {
  if (isinToRowCache && isinCurrencyCache && listingsByIsinCache) {
    return isinToRowCache;
  }

  isinToRowCache = new Map();
  isinCurrencyCache = new Map();
  listingsByIsinCache = new Map();

  const shareRows = await readXetraRows();
  const etfRows = await parseEtfCsvFile();
  const allRows = [...shareRows, ...etfRows];

  for (const row of allRows) {
    const isin = row.isin;
    const currency = row.currency ?? '';
    isinCurrencyCache.set(`${isin}|${currency}`, row);
    if (!listingsByIsinCache.has(isin)) listingsByIsinCache.set(isin, []);
    const list = listingsByIsinCache.get(isin);
    if (!list.some((r) => r.mnemonic === row.mnemonic && r.currency === row.currency)) {
      list.push(row);
    }
  }

  for (const [isin, list] of listingsByIsinCache) {
    isinToRowCache.set(isin, pickPreferredRow(list));
  }

  return isinToRowCache;
}

export function xetraYahooSymbolFromRow(row) {
  if (!row?.mnemonic) return null;
  return row.yahoo_symbol ?? `${row.mnemonic}.DE`;
}

export async function getXetraRowByIsin(isin, currency = null) {
  if (!isin) return null;
  await loadXetraIsinMap();
  const upper = String(isin).toUpperCase();
  if (currency) {
    const exact = isinCurrencyCache.get(`${upper}|${String(currency).toUpperCase()}`);
    if (exact) return exact;
  }
  const listings = listingsByIsinCache.get(upper);
  return pickPreferredRow(listings, currency) ?? isinToRowCache.get(upper) ?? null;
}

/**
 * Resolve Yahoo .DE symbol for German IBKR listings via Xetra ISIN table.
 */
export async function resolveXetraYahooSymbol(instrument) {
  const isin = instrument?.isin;
  if (!isin) return null;
  const row = await getXetraRowByIsin(isin, instrument?.currency ?? null);
  return row ? xetraYahooSymbolFromRow(row) : null;
}
