/**
 * Fetch AMFI NAVAll.txt and write equity Direct Growth schemes as JSON.
 *
 *   npm run fetch:amfi-equity-direct-growth
 *
 * Output: public/data/screener/amfi-equity-direct-growth.json
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NAV_ALL_URL = 'https://portal.amfiindia.com/spages/NAVAll.txt';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outPath = path.join(root, 'public', 'data', 'screener', 'amfi-equity-direct-growth.json');

const CATEGORY_RE =
  /^(Open Ended Schemes|Closed Ended Schemes|Interval Scheme|Solution Oriented Scheme|Other Schemes)\((.+)\)\s*$/i;
const SCHEME_ROW_RE = /^(\d+);/;
const AMC_RE = /mutual fund\s*$/i;

function parseCategoryLine(line) {
  const m = line.match(CATEGORY_RE);
  if (!m) return null;
  const inner = m[2].trim();
  const dash = inner.indexOf(' - ');
  if (dash >= 0) {
    return {
      category: inner.slice(0, dash).trim(),
      subCategory: inner.slice(dash + 3).trim(),
    };
  }
  return { category: inner, subCategory: '' };
}

function pickIsin(colGrowthOrPayout, colReinvest) {
  for (const raw of [colGrowthOrPayout, colReinvest]) {
    const v = (raw ?? '').trim();
    if (v && v !== '-') return v.toUpperCase();
  }
  return '';
}

function derivePlan(name) {
  return /\bdirect\b/i.test(name) ? 'Direct' : 'Regular';
}

function derivePayout(name) {
  return /\bgrowth\b/i.test(name) ? 'Growth' : 'IDCW';
}

function parseNavAll(text) {
  const rows = [];
  let category = '';
  let subCategory = '';
  let amc = '';

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^scheme code;/i.test(line)) continue;

    const cat = parseCategoryLine(line);
    if (cat) {
      category = cat.category;
      subCategory = cat.subCategory;
      continue;
    }

    if (SCHEME_ROW_RE.test(line)) {
      const parts = line.split(';');
      if (parts.length < 4) continue;
      const amfiCode = parts[0].trim();
      const isin = pickIsin(parts[1], parts[2]);
      const name = parts[3].trim();
      if (!amfiCode || !name) continue;
      rows.push({
        amfiCode,
        isin,
        name,
        category,
        subCategory,
        amc,
        plan: derivePlan(name),
        payout: derivePayout(name),
      });
      continue;
    }

    if (AMC_RE.test(line) && !line.includes(';')) {
      amc = line.trim();
    }
  }

  return rows;
}

async function main() {
  const res = await fetch(NAV_ALL_URL, {
    headers: { 'User-Agent': 'pocketedge/0.1 (+amfi-equity-direct-growth)' },
  });
  if (!res.ok) throw new Error(`NAVAll fetch failed: ${res.status} ${res.statusText}`);

  const text = await res.text();
  const allRows = parseNavAll(text);
  const rows = allRows
    .filter((r) => r.category === 'Equity Scheme' && r.plan === 'Direct' && r.payout === 'Growth')
    .sort((a, b) => a.amfiCode.localeCompare(b.amfiCode));

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(rows)}\n`, 'utf8');

  console.log(
    `[fetch-amfi-equity-direct-growth] wrote ${rows.length} equity Direct Growth schemes → ${outPath}`,
  );
  console.log(
    `[fetch-amfi-equity-direct-growth] from ${allRows.length} active schemes in NAVAll`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
