#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonDir = path.resolve(
  process.argv[2] ?? path.join(__dirname, '..', '.tmp', 'market-asset-json-batches')
);

function requireEnv(...names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  throw new Error(`Missing ${names.join(' or ')}`);
}

async function main() {
  const baseUrl = requireEnv('VITE_SUPABASE_URL', 'SUPABASE_URL');
  const apiKey = requireEnv('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
  const rpcUrl = `${baseUrl.replace(/\/$/, '')}/rest/v1/rpc/bulk_upsert_social_market_assets`;

  const files = (await readdir(jsonDir)).filter((f) => f.endsWith('.json')).sort();
  let total = 0;

  for (const file of files) {
    const payload = JSON.parse(await readFile(path.join(jsonDir, file), 'utf8'));
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_rows: payload }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${file}: HTTP ${res.status} ${text}`);
    }
    const n = Number(await res.text());
    total += Number.isFinite(n) ? n : payload.length;
    process.stdout.write(`\r  ${file} (${total}/${files.length * payload.length}+ rows)`);
  }

  process.stdout.write('\n');

  const countRes = await fetch(`${baseUrl.replace(/\/$/, '')}/rest/v1/social_market_assets?select=asset_key`, {
    headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, Prefer: 'count=exact' },
  });
  console.log(`Done. Upserted ~${total} rows. Table count header: ${countRes.headers.get('content-range') ?? 'unknown'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
