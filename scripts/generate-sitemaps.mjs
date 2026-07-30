#!/usr/bin/env node
/**
 * Generate public sitemap index + child sitemaps from static market/brief data.
 * Run: node scripts/generate-sitemaps.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const ORIGIN = 'https://www.pocketedge.in';
const TODAY = new Date().toISOString().slice(0, 10);

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function urlEntry(loc, { changefreq = 'weekly', priority = '0.5', lastmod = TODAY } = {}) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function writeUrlset(fileName, entries) {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(PUBLIC, fileName), body);
  console.log(`wrote ${fileName} (${entries.length} urls)`);
}

function writeIndex(children) {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${children
  .map(
    (name) => `  <sitemap>
    <loc>${ORIGIN}/${name}</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>`
  )
  .join('\n')}
</sitemapindex>
`;
  fs.writeFileSync(path.join(PUBLIC, 'sitemap.xml'), body);
  console.log(`wrote sitemap.xml (${children.length} children)`);
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(PUBLIC, rel), 'utf8'));
}

// --- static ---
const staticUrls = [
  ['/', 'daily', '1.0'],
  ['/insights', 'daily', '0.9'],
  ['/business-model', 'weekly', '0.9'],
  ['/markets', 'hourly', '0.9'],
  ['/search', 'weekly', '0.7'],
  ['/resources', 'weekly', '0.7'],
  ['/resources/mf-screener', 'weekly', '0.6'],
  ['/resources/etf-inav', 'daily', '0.6'],
  ['/resources/sgb', 'daily', '0.6'],
  ['/disclosures', 'monthly', '0.4'],
  ['/disclosures/privacy', 'monthly', '0.3'],
  ['/disclosures/terms', 'monthly', '0.3'],
].map(([p, cf, pr]) => urlEntry(`${ORIGIN}${p}`, { changefreq: cf, priority: pr }));

writeUrlset('sitemap-static.xml', staticUrls);

// --- briefs ---
const briefsIndex = readJson('data/company-briefs/index.json');
const briefItems = Array.isArray(briefsIndex.items) ? briefsIndex.items : [];
const briefUrls = briefItems.map((item) =>
  urlEntry(`${ORIGIN}/business-model/${encodeURIComponent(item.symbol)}`, {
    changefreq: 'monthly',
    priority: '0.7',
  })
);
writeUrlset('sitemap-briefs.xml', briefUrls);

// --- stocks + etfs ---
const stocksSearch = readJson('data/markets/stocks-search.json');
const etfSearch = readJson('data/markets/etf-search.json');
const stockRows = Array.isArray(stocksSearch.items)
  ? stocksSearch.items
  : Array.isArray(stocksSearch)
    ? stocksSearch
    : [];
const etfRows = Array.isArray(etfSearch.items)
  ? etfSearch.items
  : Array.isArray(etfSearch)
    ? etfSearch
    : [];

const stockUrls = stockRows
  .map((row) => String(row.symbol ?? row.id ?? '').trim().toUpperCase())
  .filter(Boolean)
  .map((sym) =>
    urlEntry(`${ORIGIN}/stock/${encodeURIComponent(sym)}`, {
      changefreq: 'daily',
      priority: '0.8',
    })
  );

const etfUrls = etfRows
  .map((row) => String(row.symbol ?? row.id ?? '').trim().toUpperCase())
  .filter(Boolean)
  .map((sym) =>
    urlEntry(`${ORIGIN}/etf/${encodeURIComponent(sym)}`, {
      changefreq: 'daily',
      priority: '0.7',
    })
  );

writeUrlset('sitemap-stocks.xml', [...stockUrls, ...etfUrls]);

// --- selective funds: Growth + Direct only (name heuristics) ---
const fundsSearch = readJson('data/markets/mutual-funds-search.json');
const fundRows = Array.isArray(fundsSearch.items)
  ? fundsSearch.items
  : Array.isArray(fundsSearch)
    ? fundsSearch
    : [];

function isSelectiveFund(row) {
  const name = String(row.name ?? row.schemeName ?? '').toLowerCase();
  const plan = String(row.plan ?? row.planType ?? '').toLowerCase();
  const option = String(row.option ?? row.optionName ?? '').toLowerCase();
  const hay = `${name} ${plan} ${option}`;
  const isDirect = /\bdirect\b/.test(hay);
  const isGrowth = /\bgrowth\b/.test(hay) && !/\bidcw\b|\bdividend\b/.test(hay);
  return isDirect && isGrowth;
}

const selectiveFunds = fundRows.filter(isSelectiveFund);
const fundUrls = selectiveFunds
  .map((row) => String(row.schemeCode ?? row.id ?? '').trim())
  .filter(Boolean)
  .map((code) =>
    urlEntry(`${ORIGIN}/fund/${encodeURIComponent(code)}`, {
      changefreq: 'daily',
      priority: '0.55',
    })
  );

writeUrlset('sitemap-funds.xml', fundUrls);

writeIndex([
  'sitemap-static.xml',
  'sitemap-briefs.xml',
  'sitemap-stocks.xml',
  'sitemap-funds.xml',
]);

console.log(
  `selective funds: ${fundUrls.length} of ${fundRows.length} (Growth+Direct heuristic)`
);
