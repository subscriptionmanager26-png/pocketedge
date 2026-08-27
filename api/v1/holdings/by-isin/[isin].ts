export const config = {
  runtime: 'edge',
};

import {
  HOLDINGS_CORS,
  jsonResponse,
  lookupCatalogByIsin,
  normalizeAsOf,
  normalizeFundIsin,
} from '../../../_lib/fundHoldingsCdn.js';
import { trackOpenFinApiRequest } from '../../../_lib/openfinApiUsage.js';
import { holdingsBookResponse, serveHoldingsBook } from '../../../_lib/serveHoldingsBook.js';

/**
 * GET /api/v1/holdings/by-isin/:isin
 * GET /api/v1/holdings/by-isin/:isin?as_of=2026-07-31
 *
 * Same portfolio book as /holdings/{amfi}, keyed by mutual fund scheme ISIN (INF…).
 */
export default async function handler(
  request: Request,
  context: { params?: { isin?: string } },
) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: HOLDINGS_CORS });
  }
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const rawIsin =
    context?.params?.isin ||
    url.pathname.split('/').filter(Boolean).pop() ||
    '';
  const isin = normalizeFundIsin(decodeURIComponent(rawIsin));
  if (!isin) {
    return jsonResponse(
      {
        error: 'Enter a valid mutual fund ISIN',
        detail: 'Scheme ISIN must match INF + 9 alphanumeric characters',
      },
      400,
    );
  }

  const asOfRaw =
    url.searchParams.get('as_of') ||
    url.searchParams.get('asOf') ||
    url.searchParams.get('date') ||
    '';
  const asOf = normalizeAsOf(asOfRaw);
  if (asOfRaw && !asOf) {
    return jsonResponse(
      {
        error: 'Invalid as_of',
        detail: 'Use YYYY-MM-DD or YYYY-MM',
        as_of: asOfRaw,
      },
      400,
    );
  }

  try {
    const hit = await lookupCatalogByIsin(isin);
    if (!hit) {
      return jsonResponse({ error: 'Unknown scheme ISIN', isin }, 404, {
        'Cache-Control': 'public, max-age=60',
      });
    }

    const result = await serveHoldingsBook(hit.amfi, hit.row, asOf || null, {
      lookup: 'isin',
      isin,
    });
    trackOpenFinApiRequest({
      endpoint: 'holdings-by-isin',
      method: 'GET',
      status: result.ok ? 200 : result.status,
      amfi: hit.amfi,
    });
    return holdingsBookResponse(result);
  } catch (err) {
    trackOpenFinApiRequest({
      endpoint: 'holdings-by-isin',
      method: 'GET',
      status: 502,
    });
    return jsonResponse(
      {
        error: 'Could not load holdings',
        isin,
        as_of: asOf || null,
        detail: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
}
