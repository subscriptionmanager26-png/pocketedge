import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFundSizeFromHtml, formatAumFromMillions } from './justetf-aum.mjs';
import { fetchJustEtfProfileHtml } from './justetf-profile.mjs';
import { extractJustEtfIndexFromHtml } from './ucits-tracked-index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(__dirname, '../../data/justetf-profile-cache.json');

function loadCache() {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
}

export function parseJustEtfProfileHtml(html, isin) {
  if (!html) return null;

  const aumParsed = extractFundSizeFromHtml(html);
  const trackedIndex = extractJustEtfIndexFromHtml(html);
  const aumFields = aumParsed ? { ...formatAumFromMillions(aumParsed.millions, aumParsed.currency), aumSource: 'justetf', aumSymbol: isin } : null;

  if (!aumFields && !trackedIndex) return null;

  return {
    aum: aumFields?.aum ?? null,
    aumFmt: aumFields?.aumFmt ?? null,
    aumCurrency: aumFields?.aumCurrency ?? null,
    aumMillions: aumFields?.aumMillions ?? null,
    aumSource: aumFields?.aumSource ?? null,
    aumSymbol: aumFields?.aumSymbol ?? null,
    trackedIndex: trackedIndex || null,
    trackedIndexSource: trackedIndex ? 'justetf' : null,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchJustEtfProfileData(isin, { delayMs = 1000, retries = 4, useCache = true } = {}) {
  if (!isin) return null;

  const cache = useCache ? loadCache() : {};
  if (useCache && cache[isin]) return cache[isin];

  const html = await fetchJustEtfProfileHtml(isin, { delayMs, retries });
  const parsed = parseJustEtfProfileHtml(html, isin);
  if (!parsed) return null;

  if (useCache) {
    cache[isin] = parsed;
    saveCache(cache);
  }

  return parsed;
}

export { CACHE_PATH };
