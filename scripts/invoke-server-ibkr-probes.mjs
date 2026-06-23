#!/usr/bin/env node
/**
 * Invoke server-side probes on Supabase Edge + Vercel.
 *
 * Usage:
 *   node scripts/invoke-server-ibkr-probes.mjs --sample=50
 *   node scripts/invoke-server-ibkr-probes.mjs --yahoo --sample=10
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const yahooMode = process.argv.includes('--yahoo');
const sampleArg = process.argv.find((arg) => arg.startsWith('--sample='));
const sample = sampleArg ? sampleArg.split('=')[1] : yahooMode ? '10' : '50';
const probeSecret = process.env.IBKR_PROBE_SECRET;

const supabaseUrl =
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  'https://zweqxjeuwwfrlpbuuayg.supabase.co';
const vercelUrl =
  process.env.VERCEL_PROBE_URL ??
  process.env.VITE_SITE_URL ??
  'https://www.pocketedge.in';

const headers = {
  Accept: 'application/json',
  ...(probeSecret ? { 'x-probe-secret': probeSecret } : {}),
};

function summarizeBody(body) {
  if (body.probe_type === 'yahoo_chart' && body.summary) {
    return (
      `priced=${body.summary.priced}/${body.summary.total} ` +
      `by_venue=${JSON.stringify(body.summary.by_venue)} ` +
      `finra=${body.finra_otc?.ok ? 'ok' : body.finra_otc?.error ?? 'n/a'} ` +
      `runtime=${body.runtime} region=${body.region}`
    );
  }
  if (body.summary?.by_step) {
    return (
      `priced=${body.summary.priced}/${body.summary.total} ` +
      `steps=${JSON.stringify(body.summary.by_step)} runtime=${body.runtime} region=${body.region}`
    );
  }
  return `error=${body.error ?? body.raw ?? 'unknown'}`;
}

async function invoke(label, url) {
  const started = Date.now();
  console.log(`\n→ ${label}: ${url}`);
  const response = await fetch(url, { headers });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { ok: false, raw: text.slice(0, 500) };
  }
  const elapsed = Date.now() - started;
  console.log(`  status=${response.status} elapsed=${elapsed}ms`);
  console.log(`  ${summarizeBody(body)}`);
  if (body.probe_type === 'yahoo_chart' && body.results) {
    const misses = body.results.filter((row) => !row.ok);
    if (misses.length) {
      console.log(
        `  misses: ${misses.map((row) => `${row.yahoo_symbol}(${row.error})`).join(', ')}`
      );
    }
  }
  return { label, url, status: response.status, elapsed_ms: elapsed, body };
}

async function main() {
  const probeName = yahooMode ? 'yahoo-probe' : 'ibkr-preflight-ladder-probe';
  const query = yahooMode
    ? `?sample=${encodeURIComponent(sample)}`
    : `?sample=${encodeURIComponent(sample)}&batch-size=10`;

  const targets = [
    {
      label: 'supabase_edge',
      url: `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${probeName}${query}`,
    },
    {
      label: 'vercel',
      url: `${vercelUrl.replace(/\/$/, '')}/api/${probeName}${query}`,
    },
  ];

  const results = [];
  for (const target of targets) {
    try {
      results.push(await invoke(target.label, target.url));
    } catch (error) {
      results.push({
        label: target.label,
        url: target.url,
        status: 0,
        elapsed_ms: 0,
        body: { ok: false, error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  const outDir = path.join(DATA_DIR, 'probe-server-runs');
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const prefix = yahooMode ? 'yahoo-probe' : 'ibkr-probe';
  const outPath = path.join(outDir, `${prefix}-${stamp}.json`);
  await writeFile(
    outPath,
    `${JSON.stringify({ mode: yahooMode ? 'yahoo' : 'ibkr', sample, results }, null, 2)}\n`
  );
  console.log(`\nWrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
