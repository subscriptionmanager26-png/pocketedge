/** Public fund holdings on GitHub raw, pinned by commit SHA (raw @main lags on large files). */

export const HOLDINGS_REPO_OWNER = 'kushagra-agarwal-a';
export const HOLDINGS_REPO_NAME = 'fund-holdings-data';
export const HOLDINGS_BRANCH = 'main';

export const HOLDINGS_CDN_BASE = `https://raw.githubusercontent.com/${HOLDINGS_REPO_OWNER}/${HOLDINGS_REPO_NAME}/${HOLDINGS_BRANCH}`;

export const HOLDINGS_META_URL = `${HOLDINGS_CDN_BASE}/meta.json`;
/** @deprecated Prefer resolveHoldingsBase() — branch tip may lag. */
export const HOLDINGS_CATALOG_URL = `${HOLDINGS_CDN_BASE}/catalog/amfi-lookup.json`;
export const HOLDINGS_FILINGS_URL = `${HOLDINGS_CDN_BASE}/catalog/filings.json`;

export const HOLDINGS_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...HOLDINGS_CORS,
      ...extraHeaders,
    },
  });
}

export function normalizeAmfi(raw: string) {
  const code = String(raw || '').trim();
  if (!/^\d{4,8}$/.test(code)) return '';
  return code;
}

/** Accept YYYY-MM-DD, or YYYY-MM → month-end. */
export function normalizeAsOf(raw: string | null | undefined): string {
  const s = String(raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${s}-${String(last).padStart(2, '0')}`;
  }
  return '';
}

type CatalogRow = {
  amfi_code?: string;
  portfolio_id?: string | null;
  portfolio_url?: string | null;
  has_holdings?: boolean;
  name?: string;
  amc_name?: string;
  parent_name?: string;
  parent_amfi?: string;
  nav?: string | number | null;
  nav_date?: string | null;
  isin?: string | null;
  category?: string | null;
  available_as_of?: string[];
  [key: string]: unknown;
};

type HoldingsMeta = {
  commit?: string;
  raw_base?: string;
  generated_at?: string;
  [key: string]: unknown;
};

export type HoldingsFiling = {
  as_of: string;
  cadence?: string;
  portfolio_count?: number;
  [key: string]: unknown;
};

let pinMemory: { at: number; base: string; commit: string | null } | null =
  null;
let catalogMemory: { at: number; data: Record<string, CatalogRow> } | null =
  null;
let filingsMemory: { at: number; data: { filings: HoldingsFiling[] } } | null =
  null;
const PIN_TTL_MS = 5 * 60 * 1000;
const CATALOG_TTL_MS = 5 * 60 * 1000;

function rawBaseForCommit(commit: string) {
  return `https://raw.githubusercontent.com/${HOLDINGS_REPO_OWNER}/${HOLDINGS_REPO_NAME}/${commit}`;
}

function isCommitSha(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{7,40}$/i.test(value);
}

async function resolveTipCommit(): Promise<string | null> {
  const url = `https://api.github.com/repos/${HOLDINGS_REPO_OWNER}/${HOLDINGS_REPO_NAME}/commits/${HOLDINGS_BRANCH}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'PocketEdgeHoldings/1.0',
      'Cache-Control': 'no-cache',
    },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { sha?: string };
  return isCommitSha(body.sha) ? body.sha : null;
}

async function resolveMetaCommit(): Promise<string | null> {
  const res = await fetch(HOLDINGS_META_URL, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) return null;
  const meta = (await res.json()) as HoldingsMeta;
  if (isCommitSha(meta.commit)) return meta.commit;
  if (typeof meta.raw_base === 'string') {
    const m = meta.raw_base.match(/\/([0-9a-f]{7,40})\/?$/i);
    if (m) return m[1];
  }
  return null;
}

export async function resolveHoldingsBase(): Promise<{
  base: string;
  commit: string | null;
}> {
  const now = Date.now();
  if (pinMemory && now - pinMemory.at < PIN_TTL_MS) {
    return { base: pinMemory.base, commit: pinMemory.commit };
  }

  let commit: string | null = null;
  try {
    commit = await resolveTipCommit();
  } catch {
    commit = null;
  }
  if (!commit) {
    try {
      commit = await resolveMetaCommit();
    } catch {
      commit = null;
    }
  }

  const base = commit ? rawBaseForCommit(commit) : HOLDINGS_CDN_BASE;
  pinMemory = { at: now, base, commit };
  return { base, commit };
}

export async function holdingsPortfolioUrl(
  portfolioId: string,
  asOf?: string | null,
) {
  const { base } = await resolveHoldingsBase();
  const id = encodeURIComponent(portfolioId);
  const day = normalizeAsOf(asOf || '');
  if (day) {
    return `${base}/portfolios/asof/${day}/${id}.json`;
  }
  return `${base}/portfolios/latest/${id}.json`;
}

export async function loadAmfiCatalog(): Promise<Record<string, CatalogRow>> {
  const now = Date.now();
  if (catalogMemory && now - catalogMemory.at < CATALOG_TTL_MS) {
    return catalogMemory.data;
  }

  const { base } = await resolveHoldingsBase();
  const catalogUrl = `${base}/catalog/amfi-lookup.json`;

  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(catalogUrl);
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit?.ok) {
      const data = (await hit.json()) as Record<string, CatalogRow>;
      catalogMemory = { at: now, data };
      return data;
    }
  }

  const res = await fetch(catalogUrl, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) {
    throw new Error(`catalog fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as Record<string, CatalogRow>;
  catalogMemory = { at: now, data };
  if (cache) {
    const toStore = new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    });
    await cache.put(cacheKey, toStore).catch(() => {});
  }
  return data;
}

export async function loadHoldingsFilings(): Promise<{
  filings: HoldingsFiling[];
  generated_at?: string;
}> {
  const now = Date.now();
  if (filingsMemory && now - filingsMemory.at < CATALOG_TTL_MS) {
    return filingsMemory.data;
  }
  const { base } = await resolveHoldingsBase();
  const url = `${base}/catalog/filings.json`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) {
    throw new Error(`filings fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    filings?: HoldingsFiling[];
    generated_at?: string;
  };
  const normalized = {
    generated_at: data.generated_at,
    filings: Array.isArray(data.filings) ? data.filings : [],
  };
  filingsMemory = { at: now, data: normalized };
  return normalized;
}
