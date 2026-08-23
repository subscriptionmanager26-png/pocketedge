export const config = {
  runtime: 'edge',
};

import {
  HOLDINGS_CORS,
  jsonResponse,
  loadHoldingsFilings,
} from '../_lib/fundHoldingsCdn.js';

/**
 * GET /api/v1/filings
 * Lists published holdings as-of dates (monthly + fortnightly).
 */
export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: HOLDINGS_CORS });
  }
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const data = await loadHoldingsFilings();
    return jsonResponse(
      {
        generated_at: data.generated_at ?? null,
        filings: data.filings,
      },
      200,
      {
        'Cache-Control':
          'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      },
    );
  } catch (err) {
    return jsonResponse(
      {
        error: 'Could not load filings',
        detail: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
}
