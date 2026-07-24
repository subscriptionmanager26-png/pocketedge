#!/usr/bin/env node
/**
 * Build Company Brief JSON from Screener enriched scrape + industry taxonomy.
 *
 * Inputs (override with env):
 *   SCREENER_ENRICHED_CSV  default: ~/Downloads/screener_listed_companies_enriched.csv
 *   SCREENER_INDUSTRY_CSV  default: …/screener_industry_pipeline/meta/scrape_state.csv
 *
 * Outputs:
 *   public/data/company-briefs/index.json
 *   public/data/company-briefs/shards/{A-Z,0}.json
 */
import { createReadStream, createWriteStream, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = join(ROOT, 'public/data/company-briefs');
const SHARD_DIR = join(OUT_DIR, 'shards');

const ENRICHED =
  process.env.SCREENER_ENRICHED_CSV ||
  join(homedir(), 'Downloads/screener_listed_companies_enriched.csv');
const INDUSTRY =
  process.env.SCREENER_INDUSTRY_CSV ||
  join(homedir(), 'Downloads/screener_industry_pipeline/meta/scrape_state.csv');

const PRODUCT_HEADERS = /^(product|products|services|service|offerings?|portfolio|verticals?|divisions?|segments?|categories|applications)/i;
const OVERVIEW_HEADERS = /^(business overview|busienss overview|business profile|company overview|business model|history|parentage|promoter)/i;
const MOAT_HEADERS = /^(market (position|leadership)|competitive|moat|advantage)/i;
const MIX_HEADERS = /^(revenue|business segment|mix|breakup)/i;

function cleanText(value) {
  return String(value ?? '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentence(text, max = 180) {
  const raw = cleanText(text);
  if (!raw) return '';
  const m = raw.match(/^(.+?[.!?])(\s|$)/);
  const sentence = (m ? m[1] : raw).trim();
  if (sentence.length <= max) return sentence;
  return `${sentence.slice(0, max - 1).trim()}…`;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function readCsv(path) {
  const stream = createReadStream(path, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let headers = null;
  const rows = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    if (!headers) {
      headers = cols.map((h) => h.trim());
      continue;
    }
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function parseKeyPointBlocks(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return [];

  const parts = text
    .split(/\s*\|\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  const blocks = [];
  let current = null;

  const pushCurrent = () => {
    if (!current) return;
    const body = cleanText(current.bodyParts.join(' '));
    if (current.title || body) {
      blocks.push({ title: current.title || 'Key points', body });
    }
    current = null;
  };

  for (const part of parts) {
    const headerMatch = part.match(/^([A-Za-z][A-Za-z0-9 /&%'()+.-]{1,48}):\s*(.*)$/);
    if (headerMatch) {
      const title = headerMatch[1].trim();
      const rest = (headerMatch[2] || '').trim();
      // "BFSI : 31.9%" / mix lines are content, not section headers
      if (/^[\d.,]+\s*%/.test(rest) || /^₹/.test(rest) || /^\d/.test(rest)) {
        if (!current) current = { title: '', bodyParts: [] };
        current.bodyParts.push(part);
        continue;
      }
      pushCurrent();
      current = {
        title,
        bodyParts: rest ? [rest] : [],
      };
      continue;
    }
    // Titles without trailing colon, e.g. "Revenue Breakup Q3FY26"
    if (
      !part.includes(':') &&
      part.length <= 64 &&
      /^(revenue|business|product|products|services?|market|company|digital|history|parentage|promoter|operational)/i.test(
        part
      )
    ) {
      pushCurrent();
      current = { title: part.trim(), bodyParts: [] };
      continue;
    }
    if (!current) {
      current = { title: '', bodyParts: [part] };
    } else {
      current.bodyParts.push(part);
    }
  }
  pushCurrent();

  // Drop empty title-only stubs like "Business Segments"
  return blocks.filter((b) => b.body && b.body.length >= 24);
}

function splitIntoRows(body, limit = 6) {
  const cleaned = cleanText(body);
  if (!cleaned) return [];

  // Prefer "Label : value" style (revenue mix)
  const labeled = [...cleaned.matchAll(/([A-Za-z][^:]{1,48})\s*:\s*([^:]+?)(?=(?:\s+[A-Za-z][^:]{1,48}\s*:)|$)/g)];
  if (labeled.length >= 2) {
    return labeled.slice(0, limit).map((m) => ({
      title: cleanText(m[1]),
      body: cleanText(m[2]),
    }));
  }

  const sentences = cleaned
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  if (sentences.length >= 2) {
    return sentences.slice(0, limit).map((s) => ({ title: null, body: s }));
  }

  return [{ title: null, body: cleaned }];
}

function classifyBlocks(blocks) {
  const products = [];
  const moats = [];
  const mix = [];
  const overview = [];
  const other = [];

  for (const block of blocks) {
    const title = block.title || '';
    if (PRODUCT_HEADERS.test(title)) products.push(block);
    else if (MOAT_HEADERS.test(title)) moats.push(block);
    else if (MIX_HEADERS.test(title)) mix.push(block);
    else if (OVERVIEW_HEADERS.test(title)) overview.push(block);
    else other.push(block);
  }
  return { products, moats, mix, overview, other };
}

function rowsFromBlocks(blocks, limit = 6) {
  const rows = [];
  for (const block of blocks) {
    const pieces = splitIntoRows(block.body, limit);
    for (const piece of pieces) {
      rows.push({
        title: piece.title || (blocks.length > 1 ? block.title : null),
        body: piece.body,
      });
      if (rows.length >= limit) return rows;
    }
  }
  return rows;
}

function shardKey(symbol) {
  const ch = String(symbol || '').charAt(0).toUpperCase();
  return /[A-Z]/.test(ch) ? ch : '0';
}

function logoUrl(symbol) {
  const key = String(symbol || '')
    .trim()
    .replace(/&/g, '_')
    .replace(/\s+/g, '_');
  return `/asset-logos/stock/${encodeURIComponent(key)}/icon-256.png?v=3`;
}

function buildBrief(row, industryRow) {
  const symbol = String(row.nse_symbol || row.symbol || '')
    .trim()
    .toUpperCase();
  if (!symbol) return null;

  const name = cleanText(row.name) || symbol;
  const about = cleanText(row.about);
  const website = cleanText(row.website) || null;
  const industry = cleanText(industryRow?.industry || '');
  const broadSector = cleanText(industryRow?.broad_sector || '');
  const sector = cleanText(industryRow?.sector || '');
  const broadIndustry = cleanText(industryRow?.broad_industry || '');

  const blocks = parseKeyPointBlocks(row.key_points);
  const classified = classifyBlocks(blocks);

  const overviewExtra = classified.overview.map((b) => b.body).filter(Boolean).join(' ');
  const prose = about || overviewExtra;
  if (!prose && !blocks.length) return null;

  const productRows = rowsFromBlocks(classified.products, 6);
  const overviewRows =
    about && overviewExtra
      ? rowsFromBlocks(classified.overview, 6)
      : about
        ? []
        : rowsFromBlocks(classified.overview, 6);
  const otherRows = rowsFromBlocks(classified.other, 6);

  // Prefer dedicated product rows; else surface overview/other as "What they do"
  const whatTheyDo = productRows.length
    ? productRows
    : [...overviewRows, ...otherRows].slice(0, 6);

  const mixRows = rowsFromBlocks(classified.mix, 8);
  const moatRows = rowsFromBlocks(classified.moats, 6).map((r) => ({ ...r, tone: 'good' }));

  // When about is empty but overview filled prose, avoid duplicating the same block as rows
  const detailRows =
    !about && overviewExtra && !productRows.length && !otherRows.length ? [] : whatTheyDo;

  const facts = [];
  if (industry) facts.push({ label: 'Industry', value: industry });
  if (broadSector && broadSector !== industry) facts.push({ label: 'Sector', value: broadSector });
  if (website) {
    try {
      const host = new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace(
        /^www\./,
        ''
      );
      if (host) facts.push({ label: 'Website', value: host });
    } catch {
      /* skip bad urls */
    }
  }

  const kicker = [broadSector || sector, industry || broadIndustry].filter(Boolean).join(' · ');
  const tagline = firstSentence(about || overviewExtra || whatTheyDo[0]?.body || '');

  const sections = {
    executiveSummary: prose
      ? {
          prose,
          tags: [industry, broadSector].filter(Boolean).slice(0, 3),
        }
      : null,
    products: detailRows.length
      ? {
          title: productRows.length ? 'Products / Services' : 'What they do',
          rows: detailRows,
        }
      : null,
    customers: null,
    businessModel: mixRows.length
      ? {
          title: 'Revenue mix',
          steps: [],
          rows: mixRows,
        }
      : null,
    moats: moatRows.length ? moatRows : null,
    growth: null,
    risks: null,
  };

  return {
    symbol,
    name: name.replace(/\s+Limited$/i, '').replace(/\s+Ltd\.?$/i, '').trim() || name,
    legalName: name,
    kicker: kicker || 'Listed company',
    tagline,
    logoUrl: logoUrl(symbol),
    website,
    facts,
    sections,
    footer: {
      title: 'Know what you own',
      subtitle: 'Plain-language company primers for everyday investors.',
    },
    source: 'screener',
  };
}

async function main() {
  console.log('Reading', ENRICHED);
  const enriched = await readCsv(ENRICHED);
  console.log('Reading', INDUSTRY);
  const industries = await readCsv(INDUSTRY);

  const industryByKey = new Map();
  for (const row of industries) {
    const key = String(row.asset_key || row.screener_symbol || '')
      .trim()
      .toUpperCase();
    if (!key || row.status === 'missing' || row.status === 'error') continue;
    if (!row.industry && !row.broad_sector) continue;
    industryByKey.set(key, row);
  }

  const shards = new Map();
  const index = [];
  let built = 0;
  let skipped = 0;

  for (const row of enriched) {
    const symbol = String(row.nse_symbol || row.symbol || '')
      .trim()
      .toUpperCase();
    const industryRow =
      industryByKey.get(symbol) ||
      industryByKey.get(String(row.symbol || '').trim().toUpperCase()) ||
      null;
    const brief = buildBrief(row, industryRow);
    if (!brief) {
      skipped += 1;
      continue;
    }
    const sk = shardKey(brief.symbol);
    if (!shards.has(sk)) shards.set(sk, {});
    shards.get(sk)[brief.symbol] = brief;
    index.push({
      symbol: brief.symbol,
      name: brief.name,
      legalName: brief.legalName,
      industry: brief.facts.find((f) => f.label === 'Industry')?.value || '',
      kicker: brief.kicker,
    });
    built += 1;
  }

  index.sort((a, b) => a.symbol.localeCompare(b.symbol));

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(SHARD_DIR, { recursive: true });

  writeFileSync(
    join(OUT_DIR, 'index.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), count: index.length, items: index })
  );

  for (const [key, map] of [...shards.entries()].sort()) {
    writeFileSync(join(SHARD_DIR, `${key}.json`), JSON.stringify(map));
  }

  console.log(`Built ${built} briefs (${skipped} skipped) → ${OUT_DIR}`);
  console.log(`Shards: ${shards.size}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
