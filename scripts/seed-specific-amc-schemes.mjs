/**
 * Seed specific AMC scheme watchlists from tmp_seed/payloads.json
 * Usage: node scripts/seed-specific-amc-schemes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const payloads = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'tmp_seed/payloads.json'), 'utf8'),
);

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

for (const item of payloads) {
  const { data, error } = await supabase.rpc('seed_amc_watchlists', {
    p_username: item.username,
    p_portfolios: [item.portfolio],
  });
  if (error) {
    console.error(item.code, error);
    process.exit(1);
  }
  console.log(item.code, item.username, JSON.stringify(data));
}
console.log('Done', payloads.length);
