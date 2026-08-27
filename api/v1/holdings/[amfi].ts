export const config = {
  runtime: 'edge',
};

import {
  HOLDINGS_CORS,
  jsonResponse,
  loadAmfiCatalog,
  normalizeAmfi,
  normalizeAsOf,
} from '../../_lib/fundHoldingsCdn.js';
import { trackOpenFinApiRequest } from '../../_lib/openfinApiUsage.js';
import { holdingsBookResponse, serveHoldingsBook } from '../../_lib/serveHoldingsBook.js';

/**
 * GET /api/v1/holdings/:amfi
 * GET /api/v1/holdings/:amfi?as_of=2026-07-15
 */
export default async function handler(
  request: Request,
  context: { params?: { amfi?: string } },
) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: HOLDINGS_CORS });
  }
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const amfi = normalizeAmfi(
    context?.params?.amfi || url.pathname.split('/').filter(Boolean).pop() || '',
  );
  if (!amfi) {
    return jsonResponse({ error: 'Enter a valid AMFI scheme code' }, 400);
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
    const catalog = await loadAmfiCatalog();
    const row = catalog[amfi];
    if (!row) {
      return jsonResponse({ error: 'Unknown AMFI code', amfi_code: amfi }, 404, {
        'Cache-Control': 'public, max-age=60',
      });
    }

    const result = await serveHoldingsBook(amfi, row, asOf || null, { lookup: 'amfi' });
    if (result.ok) {
      trackOpenFinApiRequest({
        endpoint: 'holdings',
        method: 'GET',
        status: 200,
        amfi,
      });
    } else {
      trackOpenFinApiRequest({
        endpoint: 'holdings',
        method: 'GET',
        status: result.status,
        amfi,
      });
    }
    return holdingsBookResponse(result);
  } catch (err) {
    trackOpenFinApiRequest({
      endpoint: 'holdings',
      method: 'GET',
      status: 502,
      amfi,
    });
    return jsonResponse(
      {
        error: 'Could not load holdings',
        amfi_code: amfi,
        as_of: asOf || null,
        detail: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
}
