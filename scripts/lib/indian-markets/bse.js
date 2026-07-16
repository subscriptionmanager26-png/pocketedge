import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { UA } from './constants.js';

const BSE_EQUITY_URL = 'https://api.bseindia.com/BseIndiaAPI/api/GetStkCurrMain_new/w';
const FALLBACK_UNIVERSE_FILE = fileURLToPath(
  new URL('../../../data/bse-fallback-universe.csv', import.meta.url)
);
const ISIN_PATTERN = /^[A-Z0-9]{12}$/;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(String(value).replaceAll(',', '').replaceAll('%', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function csvRows(text) {
  // The supplied universe is a simple three-column CSV. This parser still
  // handles quoted fields so the source can safely be updated in place.
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export async function loadBseFallbackUniverse(file = FALLBACK_UNIVERSE_FILE) {
  const [header, ...rows] = csvRows(await readFile(file, 'utf8'));
  const symbolIndex = header.indexOf('BSE SYMBOL');
  const isinIndex = header.indexOf('ISIN No');
  if (symbolIndex < 0 || isinIndex < 0) {
    throw new Error('BSE fallback universe must include BSE SYMBOL and ISIN No columns');
  }

  const valid = [];
  const invalid = [];
  const seenSymbols = new Set();
  const seenIsins = new Set();
  for (const row of rows) {
    const symbol = String(row[symbolIndex] ?? '').trim().toUpperCase();
    const isin = String(row[isinIndex] ?? '').trim().toUpperCase();
    if (!symbol || !ISIN_PATTERN.test(isin) || seenSymbols.has(symbol) || seenIsins.has(isin)) {
      invalid.push({ symbol, isin, reason: !symbol || !ISIN_PATTERN.test(isin) ? 'invalid_identifier' : 'duplicate_identifier' });
      continue;
    }
    seenSymbols.add(symbol);
    seenIsins.add(isin);
    valid.push({ symbol, isin });
  }
  return { rows: valid, invalid };
}

function mapBseRow(row) {
  const scripCode = String(row?.Symbol ?? '').trim();
  const symbol = String(row?.ScripName ?? '').trim().toUpperCase();
  if (!/^\d+$/.test(scripCode) || !symbol) return null;

  const ltp = parseNumber(row.Price);
  const previousClose = parseNumber(row.PreCloseRate);
  const reportedChangePct = parseNumber(
    row.PerChange ?? row.PChange ?? row.ChangePercent ?? row.PercentageChange
  );
  const changePct =
    reportedChangePct ??
    (ltp != null && previousClose != null && previousClose !== 0
      ? ((ltp - previousClose) / previousClose) * 100
      : null);

  return {
    scripCode,
    symbol,
    name: String(row.LongName ?? row.CompanyName ?? row.ScripName ?? symbol).trim(),
    ltp,
    previousClose,
    changePct,
    timestamp: row.LTT ?? row.Ltt ?? row.Time ?? null,
  };
}

function bseHeaders() {
  return {
    Accept: 'application/json, text/plain, */*',
    Origin: 'https://beta.bseindia.com',
    Referer: 'https://beta.bseindia.com/',
    'User-Agent': UA,
  };
}

async function fetchBsePage(page, { retries = 4 } = {}) {
  const params = new URLSearchParams({
    flag: 'Equity',
    ddlVal1: 'All',
    ddlVal2: 'All',
    m: '0',
    pgN: String(page),
    srts: 'D',
    srtb: '6',
  });
  let failure;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(`${BSE_EQUITY_URL}?${params}`, { headers: bseHeaders() });
      if (!response.ok) throw new Error(`BSE page ${page} failed: ${response.status}`);
      return await response.json();
    } catch (error) {
      failure = error;
      if (attempt + 1 < retries) await delay(500 * 2 ** attempt);
    }
  }
  throw failure;
}

/**
 * Fetch BSE's paginated equity listing. Requests are intentionally serialized
 * to avoid BSE rate limiting; callers should filter this complete snapshot
 * against their explicitly approved fallback universe.
 */
export async function fetchBseEquityQuotes({ requestDelayMs = 250 } = {}) {
  const firstPayload = await fetchBsePage(1);
  const firstRows = Array.isArray(firstPayload)
    ? firstPayload
    : firstPayload.Table ?? firstPayload.Table1 ?? firstPayload.data ?? [];
  if (!Array.isArray(firstRows) || firstRows.length === 0) {
    throw new Error('BSE equity response did not include listing rows');
  }
  const total = parseNumber(
    firstPayload.Rcount ??
      firstPayload.TotalRecords ??
      firstPayload.total ??
      firstRows[0]?.Rcount
  );
  const pageCount = total ? Math.ceil(total / firstRows.length) : 1;
  const quotes = new Map();
  for (const row of firstRows) {
    const quote = mapBseRow(row);
    if (quote) quotes.set(quote.scripCode, quote);
  }

  for (let page = 2; page <= pageCount; page += 1) {
    await delay(requestDelayMs);
    const payload = await fetchBsePage(page);
    const rows = Array.isArray(payload) ? payload : payload.Table ?? payload.Table1 ?? payload.data ?? [];
    if (!Array.isArray(rows)) throw new Error(`BSE page ${page} did not include listing rows`);
    for (const row of rows) {
      const quote = mapBseRow(row);
      if (quote) quotes.set(quote.scripCode, quote);
    }
  }
  return [...quotes.values()];
}
