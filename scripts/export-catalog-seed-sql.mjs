#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, '../src/app/catalogSeedData.js');
const mod = await import(pathToFileURL(seedPath).href);

const OWNER = process.env.CATALOG_OWNER_ID || 'b5db5a37-926e-4c9a-bee7-80430d98d35f';
const esc = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const json = (o) => `${esc(JSON.stringify(o))}::jsonb`;

for (const b of mod.CATALOG_SEED_BASKETS) {
  console.log(`-- ${b.catalogSlug}`);
  console.log(`INSERT INTO baskets (id, creator_id, current_version, is_deleted, catalog_slug, metadata, created_at, updated_at)
VALUES (${esc(b.id)}, ${esc(OWNER)}, 1, false, ${esc(b.catalogSlug)}, ${json(b.metadata)}, now(), now())
ON CONFLICT (id) DO UPDATE SET catalog_slug=EXCLUDED.catalog_slug, metadata=EXCLUDED.metadata, creator_id=EXCLUDED.creator_id, updated_at=now();`);
  console.log(`INSERT INTO basket_versions (basket_id, version_number, name, short_description, description, image_url, image_gradient, weighting_type, rebalance_frequency, constituents)
VALUES (${esc(b.id)}, 1, ${esc(b.name)}, ${esc(b.shortDescription)}, ${esc(b.description)}, ${esc(b.imageUrl)}, ${esc(b.imageGradient)}, ${esc(b.weightingType)}, ${esc(b.rebalanceFrequency)}, ${json(b.constituents)})
ON CONFLICT (basket_id, version_number) DO UPDATE SET name=EXCLUDED.name, short_description=EXCLUDED.short_description, description=EXCLUDED.description, image_url=EXCLUDED.image_url, image_gradient=EXCLUDED.image_gradient, weighting_type=EXCLUDED.weighting_type, rebalance_frequency=EXCLUDED.rebalance_frequency, constituents=EXCLUDED.constituents;`);
  console.log(`SELECT initialize_basket_nav('${b.id}'::uuid);`);
}
