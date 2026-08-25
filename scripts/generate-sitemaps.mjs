#!/usr/bin/env node
/**
 * Generate public sitemap index + child sitemaps from static market/brief data.
 * Also builds a compact fund-seo-lite.json for edge SEO handlers.
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

function marketItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
}

// --- static ---
const staticUrls = [
  ['/', 'daily', '1.0'],
  ['/openfin', 'weekly', '0.85'],
  ['/openfin/api', 'weekly', '0.8'],
  ['/openfin/roadmap', 'weekly', '0.75'],
  ['/insights', 'daily', '0.9'],
  ['/business-model', 'weekly', '0.9'],
  ['/resources', 'weekly', '0.7'],
  ['/resources/mf-screener', 'weekly', '0.6'],
  ['/etf-tracker', 'daily', '0.6'],
  ['/gold-tracker', 'daily', '0.6'],
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
const stockRows = marketItems(readJson('data/markets/stocks-search.json'));
const etfRows = marketItems(readJson('data/markets/etf-search.json'));

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
const fundRows = marketItems(readJson('data/markets/mutual-funds-search.json'));

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

// --- indices + commodities ---
const indexRows = marketItems(readJson('data/markets/indices-search.json'));
const commodityRows = marketItems(readJson('data/markets/commodities-search.json'));

const indexUrls = indexRows
  .map((row) => String(row.id ?? row.symbol ?? '').trim())
  .filter(Boolean)
  .map((id) =>
    urlEntry(`${ORIGIN}/index/${encodeURIComponent(id)}`, {
      changefreq: 'daily',
      priority: '0.55',
    })
  );

const commodityUrls = commodityRows
  .map((row) => String(row.id ?? row.symbol ?? '').trim())
  .filter(Boolean)
  .map((id) =>
    urlEntry(`${ORIGIN}/commodity/${encodeURIComponent(id)}`, {
      changefreq: 'daily',
      priority: '0.5',
    })
  );

writeUrlset('sitemap-markets-extra.xml', [...indexUrls, ...commodityUrls]);

writeIndex([
  'sitemap-static.xml',
  'sitemap-briefs.xml',
  'sitemap-stocks.xml',
  'sitemap-funds.xml',
  'sitemap-markets-extra.xml',
]);

console.log(
  `selective funds: ${fundUrls.length} of ${fundRows.length} (Growth+Direct heuristic)`
);
console.log(`indices: ${indexUrls.length}; commodities: ${commodityUrls.length}`);

// --- compact fund SEO lite for edge handlers ---
function buildFundSeoLite() {
  const snapshotPath = path.join(PUBLIC, 'data/screener/screener-snapshot.json');
  if (!fs.existsSync(snapshotPath)) {
    console.warn('skip fund-seo-lite: screener-snapshot.json missing');
    return;
  }
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const funds = snapshot?.funds && typeof snapshot.funds === 'object' ? snapshot.funds : {};
  const lite = {};
  for (const [code, fund] of Object.entries(funds)) {
    const holdings = Array.isArray(fund?.holdings) ? fund.holdings : [];
    lite[code] = {
      aum: fund?.aum ?? null,
      expenseRatio: fund?.expenseRatio ?? null,
      cagr: fund?.cagr
        ? {
            '1y': fund.cagr['1y'] ?? fund.cagr['1Y'] ?? null,
            '3y': fund.cagr['3y'] ?? fund.cagr['3Y'] ?? null,
            '5y': fund.cagr['5y'] ?? fund.cagr['5Y'] ?? null,
          }
        : null,
      holdings: holdings.slice(0, 10).map((h) => ({
        name: h?.name ?? null,
        weightage: h?.weightage ?? null,
        sector: h?.sector ?? null,
      })),
    };
  }
  const outDir = path.join(PUBLIC, 'data/screener');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'fund-seo-lite.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify({
      generatedAt: TODAY,
      fundCount: Object.keys(lite).length,
      funds: lite,
    })
  );
  const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log(`wrote data/screener/fund-seo-lite.json (${Object.keys(lite).length} funds, ${mb} MB)`);
}

buildFundSeoLite();
