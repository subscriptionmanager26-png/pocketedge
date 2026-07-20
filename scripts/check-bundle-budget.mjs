#!/usr/bin/env node
/**
 * Fail CI when gzipped main bundles exceed perf budget.
 * Run after `npm run build`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(__dirname, '../dist/assets');

const BUDGETS = {
  index: 110 * 1024,
  'react-vendor': 55 * 1024,
  vendor: 130 * 1024,
  supabase: 70 * 1024,
};

function gzipSize(filePath) {
  return gzipSync(readFileSync(filePath)).length;
}

function main() {
  let files;
  try {
    files = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
  } catch {
    console.error('dist/assets not found — run npm run build first');
    process.exit(1);
  }

  const failures = [];
  for (const [prefix, maxBytes] of Object.entries(BUDGETS)) {
    const match = files.find((f) => f.startsWith(`${prefix}-`) || f === `${prefix}.js`);
    if (!match) continue;
    const size = gzipSize(path.join(assetsDir, match));
    if (size > maxBytes) {
      failures.push(`${match}: ${size} bytes gzip (budget ${maxBytes})`);
    } else {
      console.log(`OK ${match}: ${size} bytes gzip`);
    }
  }

  if (failures.length) {
    console.error('Bundle budget exceeded:\n' + failures.join('\n'));
    process.exit(1);
  }

  console.log('All bundle budgets passed.');
}

main();
