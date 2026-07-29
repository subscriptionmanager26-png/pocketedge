/**
 * Seed specific AMC scheme watchlists from tmp_seed/payloads.json
 * Usage: node scripts/seed-specific-amc-schemes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const payloads = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'tmp_seed/payloads.json'), 'utf8'),
);

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function seedAmcWatchlists(username, portfolios) {
  const res = await fetch(`${url}/rest/v1/rpc/seed_amc_watchlists`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      p_username: username,
      p_portfolios: portfolios,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`seed_amc_watchlists HTTP ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

for (const item of payloads) {
  const data = await seedAmcWatchlists(item.username, [item.portfolio]);
  console.log(item.code, item.username, JSON.stringify(data));
}
console.log('Done', payloads.length);
