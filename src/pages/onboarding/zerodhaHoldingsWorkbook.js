import { mergeHoldingsToEditRows } from './onboardingHoldings.js';

const EQUITY_SHEET = 'Equity';
const FUND_SHEET = 'Mutual Funds';
const HEADER_ROW_LIMIT = 40;

function normalizedHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function parseNumber(value) {
  if (value == null || value === '' || value === '-') return null;
  const parsed = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function findHeaderRow(rows) {
  return rows.findIndex((row) => {
    const headers = row.map(normalizedHeader);
    return headers.includes('symbol') && headers.includes('quantityavailable');
  });
}

function valueAt(row, headers, ...names) {
  for (const name of names) {
    const index = headers.get(name);
    if (index != null) return row[index];
  }
  return null;
}

function rowsFromSheet(xlsx, sheet, { type }) {
  if (!sheet) return [];
  const values = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const headerRow = findHeaderRow(values.slice(0, HEADER_ROW_LIMIT));
  if (headerRow < 0) {
    throw new Error(`The Zerodha ${type} tab does not have the expected holdings columns.`);
  }

  const headerMap = new Map(
    values[headerRow].map((header, index) => [normalizedHeader(header), index])
  );
  const parsed = [];
  for (const row of values.slice(headerRow + 1)) {
    const symbol = String(valueAt(row, headerMap, 'symbol') ?? '').trim();
    const isin = String(valueAt(row, headerMap, 'isin') ?? '').trim().toUpperCase();
    const quantity = parseNumber(valueAt(row, headerMap, 'quantityavailable'));
    const averagePrice = parseNumber(valueAt(row, headerMap, 'averageprice'));
    if (!symbol || quantity == null || quantity <= 0) continue;
    if (type === FUND_SHEET && !/^[A-Z0-9]{12}$/.test(isin)) continue;

    const name =
      String(valueAt(row, headerMap, 'tradingsymbol', 'instrumentname', 'name') ?? symbol).trim() ||
      symbol;
    parsed.push({
    // ISIN is the shared identity across stocks, ETFs, and funds. The
    // portfolio resolver maps it to the exchange/scheme quote key when known.
    ticker: /^[A-Z0-9]{12}$/.test(isin) ? isin : symbol.toUpperCase(),
      name,
      isin: isin || null,
      qty: quantity,
      avg: averagePrice ?? 0,
      invested: quantity * (averagePrice ?? 0),
    });
  }
  return parsed;
}

/**
 * Parse Zerodha's holdings statement. Only the dedicated Equity and Mutual
 * Funds tabs are read; the duplicated Combined tab and non-equity instruments
 * embedded in the Equity sheet are deliberately ignored.
 */
export async function parseZerodhaHoldingsWorkbook(file) {
  if (!file || !/\.(xlsx|xls)$/i.test(file.name ?? '')) {
    throw new Error('Choose a Zerodha holdings Excel file (.xlsx or .xls).');
  }

  try {
    const xlsx = await import('xlsx');
    const workbook = xlsx.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const equity = workbook.Sheets[EQUITY_SHEET];
    const funds = workbook.Sheets[FUND_SHEET];
    if (!equity && !funds) {
      throw new Error(
        'This does not look like a Zerodha holdings statement with Equity or Mutual Funds tabs.'
      );
    }

    const rows = [
      ...rowsFromSheet(xlsx, equity, { type: EQUITY_SHEET }),
      ...rowsFromSheet(xlsx, funds, { type: FUND_SHEET }),
    ];
    if (!rows.length) {
      throw new Error('No supported Equity or Mutual Fund holdings were found in this file.');
    }
    return mergeHoldingsToEditRows(rows);
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('That file could not be read as a supported Zerodha holdings workbook.');
  }
}
