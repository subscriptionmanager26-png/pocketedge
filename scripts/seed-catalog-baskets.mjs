#!/usr/bin/env node
/**
 * Seed catalog demo baskets as live DB rows under the primary creator.
 * Idempotent — safe to re-run (upserts by basket id).
 *
 * Usage:
 *   node --env-file=.env scripts/seed-catalog-baskets.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { getSupabaseAdminConfig } from './lib/supabase-admin.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OWNER_ID = process.env.CATALOG_OWNER_ID || 'b5db5a37-926e-4c9a-bee7-80430d98d35f';

async function loadSeedBaskets() {
  const seedPath = join(__dirname, '../src/app/catalogSeedData.js');
  const mod = await import(pathToFileURL(seedPath).href);
  return mod.CATALOG_SEED_BASKETS;
}

async function upsertBasket(config, basket) {
  const { url, key } = config;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };

  const basketRow = {
    id: basket.id,
    creator_id: OWNER_ID,
    current_version: 1,
    is_deleted: false,
    catalog_slug: basket.catalogSlug,
    metadata: basket.metadata,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const basketRes = await fetch(`${url}/rest/v1/baskets?on_conflict=id`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(basketRow),
  });
  if (!basketRes.ok) {
    throw new Error(`baskets upsert failed: ${await basketRes.text()}`);
  }

  const versionRes = await fetch(
    `${url}/rest/v1/basket_versions?on_conflict=basket_id,version_number`,
    {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        basket_id: basket.id,
        version_number: 1,
        name: basket.name,
        short_description: basket.shortDescription,
        description: basket.description,
        image_url: basket.imageUrl,
        image_gradient: basket.imageGradient,
        weighting_type: basket.weightingType,
        rebalance_frequency: basket.rebalanceFrequency,
        constituents: basket.constituents,
      }),
    }
  );
  if (!versionRes.ok) {
    throw new Error(`basket_versions upsert failed: ${await versionRes.text()}`);
  }

  const navRes = await fetch(`${url}/rest/v1/rpc/initialize_basket_nav`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_basket_id: basket.id }),
  });
  if (!navRes.ok) {
    const text = await navRes.text();
    if (!text.includes('duplicate') && !text.includes('already exists')) {
      console.warn(`initialize_basket_nav(${basket.catalogSlug}):`, text);
    }
  }
}

async function main() {
  const config = getSupabaseAdminConfig({ requireServiceRole: true });
  const baskets = await loadSeedBaskets();

  console.log(`Seeding ${baskets.length} catalog baskets for creator ${OWNER_ID}…`);

  for (const basket of baskets) {
    await upsertBasket(config, basket);
    console.log(`  ✓ ${basket.catalogSlug} → ${basket.id}`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
