#!/usr/bin/env node
/**
 * Render a multi-stock Daily Brief digest PDF (A4, paginated).
 *
 * Usage:
 *   node --env-file=.env scripts/render-daily-brief-pdf.mjs
 *
 *   node --env-file=.env scripts/render-daily-brief-pdf.mjs \
 *     --date=2026-07-17 --limit=30 --html-only
 *
 *   node --env-file=.env scripts/render-daily-brief-pdf.mjs \
 *     --from-csv=~/Downloads/mn_daily_stock_explanations_openai_rows.csv
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { buildDigestData, expandHome, todayIst } from './daily-stock-summary/lib/brief-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TEMPLATE_DIR = path.join(__dirname, 'daily-stock-summary');
const TEMPLATE_PATH = path.join(TEMPLATE_DIR, 'digest-template.html');
const DEFAULT_OUT_DIR = path.join(TEMPLATE_DIR, 'out');

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

function parseArgs(argv) {
  const args = {
    fromCsv: null,
    date: null,
    out: null,
    outDir: null,
    limit: null,
    tickers: null,
    rowsPerPage: 5,
    htmlOnly: false,
    noFetchMeta: false,
  };

  for (const arg of argv) {
    if (arg.startsWith('--from-csv=')) args.fromCsv = expandHome(arg.slice('--from-csv='.length));
    else if (arg.startsWith('--date=')) args.date = arg.slice('--date='.length);
    else if (arg.startsWith('--out=')) args.out = expandHome(arg.slice('--out='.length));
    else if (arg.startsWith('--out-dir=')) args.outDir = expandHome(arg.slice('--out-dir='.length));
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length));
    else if (arg.startsWith('--tickers=')) {
      args.tickers = arg.slice('--tickers='.length).split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    } else if (arg.startsWith('--rows-per-page=')) args.rowsPerPage = Number(arg.slice('--rows-per-page='.length));
    else if (arg === '--html-only') args.htmlOnly = true;
    else if (arg === '--no-fetch-meta') args.noFetchMeta = true;
  }

  return args;
}

function resolveChrome() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Chrome/Chromium not found. Install Google Chrome or set CHROME_PATH.');
}

function prepareAssets(outDir) {
  const assetsSrc = path.join(TEMPLATE_DIR, 'assets');
  const assetsDst = path.join(outDir, 'assets');
  fs.mkdirSync(assetsDst, { recursive: true });
  if (fs.existsSync(assetsSrc)) {
    for (const name of fs.readdirSync(assetsSrc)) {
      fs.copyFileSync(path.join(assetsSrc, name), path.join(assetsDst, name));
    }
  }
}

async function renderPdf(htmlPath, pdfPath) {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || resolveChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: 'load', timeout: 120_000 });

    await page.waitForSelector('.page', { timeout: 30_000 });

    const pageCount = await page.evaluate(() => document.querySelectorAll('.page').length);

    await page.waitForFunction(() => {
      const imgs = [...document.querySelectorAll('.slogo img')];
      if (!imgs.length) return true;
      return imgs.every(img => img.complete);
    }, { timeout: 60_000 }).catch(() => {});

    await new Promise(r => setTimeout(r, 1500));

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return pageCount;
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const asOfDate = args.date || todayIst();

  const source = args.fromCsv ? `CSV ${args.fromCsv}` : 'Supabase mn_daily_stock_explanations';
  console.log(`Building digest for ${asOfDate} from ${source}`);

  const data = await buildDigestData({
    csvPath: args.fromCsv,
    date: args.date || todayIst(),
    tickers: args.tickers,
    limit: args.limit,
    rowsPerPage: args.rowsPerPage,
    fetchMeta: !args.noFetchMeta,
  });

  const outDir = args.outDir || DEFAULT_OUT_DIR;
  fs.mkdirSync(outDir, { recursive: true });
  prepareAssets(outDir);

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const html = template.replace('__BRIEF_DATA__', JSON.stringify(data));

  const htmlOut = path.join(outDir, `daily-brief_${data.asOfDate}.html`);
  fs.writeFileSync(htmlOut, html);

  const stockCount = data.summary.total;
  console.log(`Stocks: ${stockCount}  Pages (est.): ${data.pages.length}`);
  console.log(`HTML: ${htmlOut}`);

  if (args.htmlOnly) {
    console.log('html-only — skipped PDF');
    return;
  }

  const pdfOut = args.out || path.join(outDir, `daily-brief_${data.asOfDate}.pdf`);
  console.log('Rendering PDF…');
  const renderedPages = await renderPdf(htmlOut, pdfOut);
  console.log(`Pages: ${renderedPages}`);
  console.log(`PDF: ${pdfOut} (${fs.statSync(pdfOut).size} bytes)`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
