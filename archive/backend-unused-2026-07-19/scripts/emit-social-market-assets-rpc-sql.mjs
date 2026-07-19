#!/usr/bin/env node
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inDir = path.resolve(process.argv[2] ?? path.join(__dirname, '..', '.tmp', 'market-asset-json-batches'));
const outDir = path.resolve(process.argv[3] ?? path.join(__dirname, '..', '.tmp', 'market-asset-rpc-batches'));

async function main() {
  await mkdir(outDir, { recursive: true });
  const files = (await readdir(inDir)).filter((f) => f.endsWith('.json')).sort();
  for (const file of files) {
    const payload = await readFile(path.join(inDir, file), 'utf8');
    const sql = `select public.bulk_upsert_social_market_assets($json$${payload}$json$::jsonb) as upserted;`;
    const out = path.join(outDir, file.replace('.json', '.sql'));
    await writeFile(out, sql);
  }
  console.log(`Wrote ${files.length} RPC SQL files to ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
