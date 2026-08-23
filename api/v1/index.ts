export const config = {
  runtime: 'edge',
};

import { HOLDINGS_CORS, jsonResponse } from '../_lib/fundHoldingsCdn.js';

/** GET /api/v1 — holdings API discovery. */
export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: HOLDINGS_CORS });
  }
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const origin = new URL(request.url).origin;
  return jsonResponse(
    {
      name: 'PocketEdge fund holdings API',
      version: 'v1',
      source: 'GitHub fund-holdings-data via jsDelivr',
      endpoints: {
        holdings: `${origin}/api/v1/holdings/{amfi}`,
        catalog: `${origin}/api/v1/catalog`,
        portfolio: `${origin}/api/v1/portfolios/{portfolio_id}`,
        meta: `${origin}/api/v1/meta`,
      },
      notes: [
        'Sibling share-classes share one portfolio book (portfolio_id).',
        'GET /api/v1/holdings/:amfi resolves catalog → portfolio and overlays scheme metadata.',
        'Catalog and portfolio routes proxy the public CDN under pocketedge.in.',
      ],
    },
    200,
    { 'Cache-Control': 'public, max-age=3600' },
  );
}
