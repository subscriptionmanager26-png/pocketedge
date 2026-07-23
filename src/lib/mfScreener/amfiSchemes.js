/** Load equity Direct Growth scheme list from the static AMFI CSV. */

let cache = null;
let loadPromise = null;

const CSV_URL = '/data/screener/amfi-equity-direct-growth.csv';

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function parseRows(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 8) continue;
    const [amfiCode, isin, name, category, subCategory, amc, plan, payout] = cols;
    if (!amfiCode?.trim() || !/^\d+$/.test(amfiCode.trim())) continue;
    rows.push({
      amfiCode: amfiCode.trim(),
      isin: (isin ?? '').trim(),
      name: (name ?? '').trim(),
      category: (category ?? '').trim(),
      subCategory: (subCategory ?? '').trim(),
      amc: (amc ?? '').trim(),
      plan: plan === 'Direct' ? 'Direct' : 'Regular',
      payout: payout === 'Growth' ? 'Growth' : 'IDCW',
    });
  }
  return rows;
}

export async function loadAmfiEquityDirectGrowth() {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = (async () => {
      const res = await fetch(CSV_URL);
      if (!res.ok) throw new Error(`Failed to load fund list (${res.status})`);
      cache = parseRows(await res.text());
      return cache;
    })();
  }
  return loadPromise;
}

export function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
