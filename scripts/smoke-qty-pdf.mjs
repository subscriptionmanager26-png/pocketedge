/**
 * Smoke: qty-only model + CDSL/CAMS/MF Central text parse → qty rows.
 * Usage: npx vite-node scripts/smoke-qty-pdf.mjs [pdf] [password]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pdfPath =
  process.argv[2] ||
  path.join(process.env.HOME || '', 'Downloads/MAY2025_AA04781304_TXN.pdf');
const password = process.argv[3];

async function extractLines(fileBuffer, pwd) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = require.resolve(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs'
  );
  const data = new Uint8Array(fileBuffer);
  const pdf = await pdfjs.getDocument({
    data,
    disableFontFace: true,
    password: pwd?.trim() || undefined,
  }).promise;
  const fullLines = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const vh = viewport.height;
    const eps = Math.max(2.5, Math.min(8, vh / 120));
    const buckets = {};
    for (const item of textContent.items) {
      if (!item || typeof item !== 'object' || !('str' in item) || !item.str) continue;
      const tr = item.transform;
      if (!tr || tr.length < 6) continue;
      const key = Math.round(tr[5] / eps) * eps;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push({ x: tr[4], s: item.str, hasEOL: Boolean(item.hasEOL) });
    }
    for (const k of Object.keys(buckets)
      .map(Number)
      .sort((a, b) => b - a)) {
      const row = buckets[k].sort((a, b) => a.x - b.x);
      const buf = [];
      const flush = () => {
        if (!buf.length) return;
        const trimmed = buf.join(' ').replace(/\s+/g, ' ').trim();
        if (trimmed) fullLines.push(trimmed);
        buf.length = 0;
      };
      for (const cell of row) {
        buf.push(cell.s);
        if (cell.hasEOL) flush();
      }
      flush();
    }
  }
  return fullLines;
}

function parseQty(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function pushRow(out, { isin, name, qty, ticker }) {
  const q = parseQty(qty);
  if (q <= 0) return;
  const cleanIsin = String(isin ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  const label = String(name ?? ticker ?? cleanIsin ?? '').trim();
  const token = /^[A-Z0-9]{12}$/.test(cleanIsin)
    ? cleanIsin
    : String(ticker || label)
        .trim()
        .toUpperCase();
  if (!token) return;
  out.push({
    ticker: token,
    name: label || token,
    isin: /^[A-Z0-9]{12}$/.test(cleanIsin) ? cleanIsin : null,
    qty: q,
    avg: 0,
    invested: 0,
  });
}

function rowsFromParsed(parsed) {
  const out = [];
  if (parsed.kind === 'cdsl_cas') {
    for (const h of parsed.data?.demat_holdings ?? []) {
      pushRow(out, { isin: h.isin, name: h.security_name, qty: h.current_balance });
    }
    for (const h of parsed.data?.mf_holdings ?? []) {
      pushRow(out, { isin: h.isin, name: h.scheme_name, qty: h.closing_units });
    }
  } else if (parsed.kind === 'mf_central') {
    for (const h of parsed.data?.holdings ?? []) {
      pushRow(out, {
        isin: h.isin,
        name: h.scheme_name,
        qty: h.closing_units,
        ticker: h.amfi_code || undefined,
      });
    }
  } else if (parsed.kind === 'cams_kfin_cas') {
    for (const h of parsed.data?.holdings ?? []) {
      pushRow(out, {
        isin: h.isin,
        name: h.scheme_name_simple || h.scheme_name,
        qty: h.closing_units,
      });
    }
  }
  return out;
}

async function main() {
  const { validatePortfolioDraft, buildLiveHoldings, summarizeHoldingsChange } = await import(
    path.join(root, 'src/lib/portfolioEdit.js')
  );

  const invalid = validatePortfolioDraft({
    kind: 'live',
    name: 'Test',
    rows: [{ id: '1', ticker: 'RELIANCE', qty: '', invested: '999', avg: '' }],
  });
  if (invalid.valid || !invalid.errors.rows['1']?.qty) {
    throw new Error('empty qty must fail (invested ignored)');
  }
  const valid = validatePortfolioDraft({
    kind: 'live',
    name: 'Test',
    rows: [{ id: '1', ticker: 'RELIANCE', qty: '10', invested: '', avg: '' }],
  });
  if (!valid.valid) throw new Error('qty-only draft should validate');

  const holdings = buildLiveHoldings(
    [{ ticker: 'RELIANCE', qty: '10', name: 'Reliance', isin: null }],
    new Map([
      [
        'RELIANCE',
        {
          key: 'RELIANCE',
          name: 'Reliance Industries',
          price: 100,
          isin: 'INE002A01018',
          kind: 'stock',
        },
      ],
    ])
  );
  if (holdings[0].avg !== 0 || holdings[0].value !== 1000) {
    throw new Error(`avg/value mismatch: ${JSON.stringify(holdings[0])}`);
  }
  const diff = summarizeHoldingsChange(
    [{ ticker: 'RELIANCE', qty: 5 }],
    [{ ticker: 'RELIANCE', qty: 10 }]
  );
  if (diff.qtyDelta !== 5) throw new Error(`qtyDelta ${diff.qtyDelta}`);
  console.log('qty-model: ok');

  if (!fs.existsSync(pdfPath)) {
    console.log('pdf: skipped (missing)', pdfPath);
    return;
  }

  const buf = fs.readFileSync(pdfPath);
  const lines = await extractLines(buf, password);
  console.log(`pdf: ${lines.length} lines from ${path.basename(pdfPath)}`);

  const { parseAnyStatementFromLines } = await import(
    path.join(root, 'src/lib/statementParsers/statementParser.ts')
  );
  const parsed = parseAnyStatementFromLines(lines, path.basename(pdfPath));
  if (parsed.kind === 'unknown') throw new Error(parsed.reason || 'unknown');
  if (parsed.kind === 'nps') throw new Error('NPS not supported');

  const rows = rowsFromParsed(parsed);
  if (!rows.length) throw new Error('no holdings with qty');
  if (rows.some((r) => r.avg !== 0 || r.invested !== 0)) {
    throw new Error('cost fields must be 0');
  }

  const { mergeHoldingsToEditRows } = await import(
    path.join(root, 'src/pages/onboarding/onboardingHoldings.js')
  );
  const editRows = mergeHoldingsToEditRows(rows);
  if (!editRows.length) throw new Error('mergeHoldingsToEditRows empty');
  if (editRows.some((r) => r.invested !== '' || r.avg !== '')) {
    throw new Error('edit rows must discard cost');
  }

  // Qty-only merge without market resolve (browser path uses resolvePortfolioAssets).
  const current = [
    {
      id: 'cur1',
      ticker: editRows[0].ticker,
      name: editRows[0].name,
      isin: editRows[0].isin,
      qty: '1',
      invested: '',
      avg: '',
    },
  ];
  const byIsin = new Map(editRows.filter((r) => r.isin).map((r) => [r.isin, r]));
  const matched = byIsin.get(current[0].isin);
  if (!matched || Number(matched.qty) <= 0) throw new Error('import isin merge failed');

  console.log(
    JSON.stringify(
      {
        kind: parsed.kind,
        rows: rows.length,
        demat: parsed.data?.demat_holdings?.length ?? 0,
        mf: parsed.data?.mf_holdings?.length ?? parsed.data?.holdings?.length ?? 0,
        sample: rows.slice(0, 5).map((r) => ({
          ticker: r.ticker,
          name: r.name.slice(0, 40),
          qty: r.qty,
        })),
        editRows: editRows.length,
        firstQtyAfterMerge: matched.qty,
      },
      null,
      2
    )
  );
  console.log('pdf-merge: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
