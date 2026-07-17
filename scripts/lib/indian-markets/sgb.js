import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SGB_UNIVERSE_FILE = path.join(__dirname, '..', '..', '..', 'data', 'sgb-isin-mapping.csv');
const ISIN_PATTERN = /^[A-Z0-9]{12}$/;

/** Load the supported SGB symbols and their canonical ISIN identities. */
export async function loadSgbUniverse() {
  const text = await readFile(SGB_UNIVERSE_FILE, 'utf8');
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const columns = header.split(',').map((value) => value.trim().toLowerCase());
  const symbolIndex = columns.indexOf('symbol');
  const isinIndex = columns.indexOf('isin');
  if (symbolIndex < 0 || isinIndex < 0) {
    throw new Error('SGB universe must contain symbol and isin columns.');
  }

  const seenSymbols = new Set();
  const seenIsins = new Set();
  const rows = [];
  const invalid = [];
  for (const line of lines) {
    const values = line.split(',').map((value) => value.trim());
    const symbol = String(values[symbolIndex] ?? '').toUpperCase();
    const isin = String(values[isinIndex] ?? '').toUpperCase();
    if (!symbol || !ISIN_PATTERN.test(isin) || seenSymbols.has(symbol) || seenIsins.has(isin)) {
      invalid.push({ symbol, isin });
      continue;
    }
    seenSymbols.add(symbol);
    seenIsins.add(isin);
    rows.push({ symbol, isin });
  }
  return { rows, invalid };
}
