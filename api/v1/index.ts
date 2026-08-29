export const config = {
  runtime: 'edge',
};

import { HOLDINGS_CORS, jsonResponse } from '../_lib/fundHoldingsCdn.js';
import { trackOpenFinApiRequest } from '../_lib/openfinApiUsage.js';

/** GET /api/v1 — holdings API discovery. */
export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: HOLDINGS_CORS });
  }
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const origin = new URL(request.url).origin;
  trackOpenFinApiRequest({ endpoint: 'discovery', method: 'GET', status: 200 });
  return jsonResponse(
    {
      name: 'PocketEdge fund holdings API',
      version: 'v1',
      source: 'GitHub fund-holdings-data (raw, commit-pinned)',
      endpoints: {
        holdings: `${origin}/api/v1/holdings/{amfi}`,
        holdings_by_isin: `${origin}/api/v1/holdings/by-isin/{isin}`,
        holdings_asof: `${origin}/api/v1/holdings/{amfi}?as_of=YYYY-MM-DD`,
        filings: `${origin}/api/v1/filings`,
        catalog: `${origin}/api/v1/catalog`,
        portfolio: `${origin}/api/v1/portfolios/{portfolio_id}`,
        meta: `${origin}/api/v1/meta`,
        stats: `${origin}/api/v1/stats`,
      },
      notes: [
        'Sibling share-classes share one portfolio book (portfolio_id).',
        'GET /api/v1/holdings/:amfi resolves catalog.latest_as_of → portfolios/asof/{date}/{portfolio_id}.json.',
        'Omit ?as_of to use the newest date from catalog (not portfolios/latest/).',
        'GET /api/v1/filings lists published as-of dates and cadences.',
      ],
    },
    200,
    { 'Cache-Control': 'public, max-age=3600' },
  );
}
