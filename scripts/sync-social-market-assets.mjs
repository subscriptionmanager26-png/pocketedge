#!/usr/bin/env node
/**
 * Upload Indian market search indexes into Supabase social_market_assets.
 * Run after sync:indian-markets (or whenever search JSON is refreshed).
 *
 * Usage: node --env-file=.env scripts/sync-social-market-assets.mjs
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKETS_DIR = path.join(__dirname, '..', 'social', 'public', 'data', 'markets');
const BATCH_SIZE = 500;

function requireEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`Missing ${names.join(' or ')}. Set one in .env`);
}

function optionalEnv(...names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return null;
}

async function readSearchIndex(fileName) {
  const filePath = path.join(MARKETS_DIR, fileName);
  const raw = await readFile(filePath, 'utf8');
  const payload = JSON.parse(raw);
  return payload.items ?? [];
}

function stockRows(items, assetType) {
  const syncedAt = new Date().toISOString();
  return items
    .map((item) => {
      const key = String(item.symbol ?? item.id ?? '').trim().toUpperCase();
      if (!key) return null;
      const price = item.price ?? item.ltp ?? item.nav ?? null;
      return {
        asset_type: assetType,
        asset_key: key,
        name: item.name ?? key,
        price,
        change_pct: item.changePct ?? null,
        synced_at: syncedAt,
      };
    })
    .filter(Boolean);
}

function fundRows(items) {
  const syncedAt = new Date().toISOString();
  return items
    .map((item) => {
      const key = String(item.schemeCode ?? item.id ?? '').trim();
      if (!key) return null;
      return {
        asset_type: 'fund',
        asset_key: key,
        name: item.name ?? key,
        price: item.nav ?? null,
        change_pct: null,
        synced_at: syncedAt,
      };
    })
    .filter(Boolean);
}

async function upsertViaRpc(url, apiKey, rows) {
  const rpcUrl = `${url.replace(/\/$/, '')}/rest/v1/rpc/bulk_upsert_social_market_assets`;
  let uploaded = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_rows: batch }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    uploaded += batch.length;
    process.stdout.write(`\r  uploaded ${uploaded}/${rows.length}`);
  }
  process.stdout.write('\n');
  return uploaded;
}

async function upsertViaTable(url, serviceKey, rows) {
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let uploaded = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('social_market_assets').upsert(batch, {
      onConflict: 'asset_type,asset_key',
    });
    if (error) throw error;
    uploaded += batch.length;
    process.stdout.write(`\r  uploaded ${uploaded}/${rows.length}`);
  }
  process.stdout.write('\n');
  return uploaded;
}

async function main() {
  const url = requireEnv('VITE_SUPABASE_URL', 'SUPABASE_URL');
  const serviceKey = optionalEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');
  const anonKey = optionalEnv('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
  const apiKey = serviceKey ?? anonKey;
  if (!apiKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY');
  }

  console.log('Loading market search indexes...');
  const [stocks, etfs, funds] = await Promise.all([
    readSearchIndex('stocks-search.json'),
    readSearchIndex('etf-search.json'),
    readSearchIndex('mutual-funds-search.json'),
  ]);

  const rows = [
    ...stockRows(stocks, 'stock'),
    ...stockRows(etfs, 'etf'),
    ...fundRows(funds),
  ];

  console.log(`Uploading ${rows.length} assets to social_market_assets...`);
  const count = serviceKey
    ? await upsertViaTable(url, serviceKey, rows)
    : await upsertViaRpc(url, apiKey, rows);
  console.log(`Done. ${count} assets synced.`);

  const verifyClient = createClient(url, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { count: verifyCount, error: verifyError } = await verifyClient
    .from('social_market_assets')
    .select('*', { count: 'exact', head: true });
  if (verifyError) throw verifyError;
  console.log(`Verified ${verifyCount ?? 0} rows in social_market_assets.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
