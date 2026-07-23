/**
 * Fetch Upvaly scheme data for equity Direct Growth funds and write a compact
 * screener snapshot under public/data/screener/.
 *
 *   npm run fetch:mf-screener-snapshot
 *
 * API: https://finapi.upvaly.com/api/mf/scheme-code/{amfiCode}
 * Rate limit: ~120 req/min — 550ms delay between calls (~5–6 min for ~580 funds).
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UPVALY_SCHEME_URL = 'https://finapi.upvaly.com/api/mf/scheme-code';
const DELAY_MS = 550;
const MAX_RETRIES = 3;
const RATE_LIMIT_WAIT_MS = 65_000;
const FETCH_TIMEOUT_MS = 30_000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'public', 'data', 'screener');
const csvPath = path.join(outDir, 'amfi-equity-direct-growth.csv');
const snapshotPath = path.join(outDir, 'screener-snapshot.json');
const metaPath = path.join(outDir, 'screener-snapshot-meta.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function loadEquityDirectGrowthCodes() {
  const text = readFileSync(csvPath, 'utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const codes = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const amfiCode = cols[0]?.trim();
    if (!amfiCode || !/^\d+$/.test(amfiCode)) continue;
    codes.push(amfiCode);
  }
  return [...new Set(codes)].sort((a, b) => a.localeCompare(b));
}

function compactScheme(data) {
  return {
    schemeCode: data.schemeCode,
    schemeName: data.schemeName,
    schemeCategory: data.schemeCategory,
    schemeCategoryLabel: data.schemeCategoryLabel,
    aum: data.aum,
    expenseRatio: data.expenseRatio,
    inceptionDate: data.inceptionDate,
    cagr: data.cagr,
    fundamentals: data.fundamentals
      ? {
          pe: data.fundamentals.pe,
          pb: data.fundamentals.pb,
          priceToSale: data.fundamentals.priceToSale,
        }
      : undefined,
    ranks: data.ranks,
    rollingReturns: data.rollingReturns,
    riskMetrics: data.riskMetrics,
    holdings: (data.holdings || []).slice(0, 10).map((h) => ({
      name: h.name,
      sector: h.sector,
      weightage: h.weightage,
    })),
  };
}

async function fetchScheme(amfiCode, attempt = 0) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${UPVALY_SCHEME_URL}/${encodeURIComponent(amfiCode)}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (res.status === 429 && attempt < MAX_RETRIES) {
      console.warn(`[fetch-mf-screener] rate limited on ${amfiCode}, waiting…`);
      await sleep(RATE_LIMIT_WAIT_MS);
      return fetchScheme(amfiCode, attempt + 1);
    }
    if (!res.ok) return { ok: false, status: res.status };
    const body = await res.json();
    if (body?.status !== 'success' || !body?.data?.schemeCode) {
      return { ok: false, status: res.status, message: body?.message };
    }
    return { ok: true, data: body.data };
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await sleep(2000 * (attempt + 1));
      return fetchScheme(amfiCode, attempt + 1);
    }
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  if (!existsSync(csvPath)) {
    throw new Error(`Missing ${csvPath} — equity Direct Growth scheme list required`);
  }

  const codes = loadEquityDirectGrowthCodes();
  const retryOnly = process.argv.includes('--retry-failed');

  let existing = { funds: {}, failed: [] };
  if (retryOnly && existsSync(snapshotPath)) {
    existing = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    console.log(`[fetch-mf-screener] retry mode: ${existing.failed?.length ?? 0} failed`);
  }

  const toFetch = retryOnly
    ? [...new Set([...(existing.failed ?? []), ...codes.filter((c) => !existing.funds?.[c])])]
    : codes;

  console.log(`[fetch-mf-screener] fetching ${toFetch.length} equity Direct Growth funds`);

  const funds = { ...(existing.funds ?? {}) };
  for (let i = 0; i < toFetch.length; i += 1) {
    const code = toFetch[i];
    if (i > 0) await sleep(DELAY_MS);

    const result = await fetchScheme(code);
    if (result.ok) {
      funds[code] = compactScheme(result.data);
    } else {
      console.warn(`[fetch-mf-screener] failed ${code}:`, result.message ?? result.status);
    }

    if ((i + 1) % 25 === 0 || i === toFetch.length - 1) {
      console.log(
        `[fetch-mf-screener] progress ${i + 1}/${toFetch.length} (ok ${Object.keys(funds).length})`,
      );
    }
  }

  const allFailed = codes.filter((c) => !funds[c]);
  const snapshot = {
    generatedAt: new Date().toISOString().slice(0, 10),
    fetchedAt: new Date().toISOString(),
    source: UPVALY_SCHEME_URL,
    fundCount: codes.length,
    fetched: Object.keys(funds).length,
    failed: allFailed,
    funds,
  };

  mkdirSync(outDir, { recursive: true });
  const json = JSON.stringify(snapshot);
  writeFileSync(snapshotPath, json, 'utf8');

  const meta = {
    generatedAt: snapshot.generatedAt,
    fetchedAt: snapshot.fetchedAt,
    source: snapshot.source,
    fundCount: snapshot.fundCount,
    fetched: snapshot.fetched,
    failedCount: snapshot.failed.length,
  };
  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

  console.log(
    `[fetch-mf-screener] wrote ${(json.length / 1024 / 1024).toFixed(2)} MB → ${snapshotPath}`,
  );
  console.log(
    `[fetch-mf-screener] done: ${snapshot.fetched}/${snapshot.fundCount} ok, ${snapshot.failed.length} failed`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
