/** Public fund holdings store (GitHub → jsDelivr). Zero paid object store. */

export const HOLDINGS_CDN_BASE =
  'https://cdn.jsdelivr.net/gh/kushagra-agarwal-a/fund-holdings-data@main';

export const HOLDINGS_CATALOG_URL = `${HOLDINGS_CDN_BASE}/catalog/amfi-lookup.json`;
export const HOLDINGS_META_URL = `${HOLDINGS_CDN_BASE}/meta.json`;

export function holdingsPortfolioUrl(portfolioId: string) {
  return `${HOLDINGS_CDN_BASE}/portfolios/latest/${encodeURIComponent(portfolioId)}.json`;
}

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
  [key: string]: unknown;
};

let catalogMemory: { at: number; data: Record<string, CatalogRow> } | null = null;
const CATALOG_TTL_MS = 5 * 60 * 1000;

export async function loadAmfiCatalog(): Promise<Record<string, CatalogRow>> {
  const now = Date.now();
  if (catalogMemory && now - catalogMemory.at < CATALOG_TTL_MS) {
    return catalogMemory.data;
  }

  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(HOLDINGS_CATALOG_URL);
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit?.ok) {
      const data = (await hit.json()) as Record<string, CatalogRow>;
      catalogMemory = { at: now, data };
      return data;
    }
  }

  const res = await fetch(HOLDINGS_CATALOG_URL, {
    headers: { Accept: 'application/json' },
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
