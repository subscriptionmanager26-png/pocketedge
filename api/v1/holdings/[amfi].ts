export const config = {
  runtime: 'edge',
};

import {
  holdingsPortfolioUrl,
  jsonResponse,
  loadAmfiCatalog,
  normalizeAmfi,
  HOLDINGS_CORS,
} from '../../_lib/fundHoldingsCdn.js';

/**
 * GET /api/v1/holdings/:amfi
 * Resolves AMFI share-class → shared portfolio book (GitHub/jsDelivr).
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

  try {
    const catalog = await loadAmfiCatalog();
    const row = catalog[amfi];
    if (!row) {
      return jsonResponse({ error: 'Unknown AMFI code', amfi_code: amfi }, 404, {
        'Cache-Control': 'public, max-age=60',
      });
    }

    const portfolioId = row.portfolio_id ? String(row.portfolio_id) : '';
    if (!row.has_holdings || !portfolioId) {
      return jsonResponse(
        {
          error: 'No Data Found',
          amfi_code: amfi,
          scheme: {
            name: row.name ?? null,
            amc_name: row.amc_name ?? null,
            parent_name: row.parent_name ?? null,
          },
        },
        404,
        { 'Cache-Control': 'public, max-age=300' },
      );
    }

    const portfolioUrl = await holdingsPortfolioUrl(portfolioId);
    const portfolioRes = await fetch(portfolioUrl, {
      headers: { Accept: 'application/json' },
    });
    if (!portfolioRes.ok) {
      return jsonResponse(
        {
          error: 'Could not load holdings',
          amfi_code: amfi,
          portfolio_id: portfolioId,
        },
        portfolioRes.status === 404 ? 404 : 502,
      );
    }

    const portfolio = await portfolioRes.json();
    const body = {
      ...portfolio,
      // Overlay the requesting share-class from the catalog.
      amfi_code: amfi,
      scheme: {
        ...(portfolio?.scheme && typeof portfolio.scheme === 'object'
          ? portfolio.scheme
          : {}),
        amfi_code: amfi,
        name: row.name ?? portfolio?.scheme?.name ?? null,
        amc_name: row.amc_name ?? portfolio?.scheme?.amc_name ?? null,
        parent_name: row.parent_name ?? portfolio?.scheme?.parent_name ?? null,
        parent_amfi: row.parent_amfi ?? portfolio?.scheme?.parent_amfi ?? null,
        nav: row.nav ?? portfolio?.scheme?.nav ?? null,
        nav_date: row.nav_date ?? portfolio?.scheme?.nav_date ?? null,
        isin: row.isin ?? portfolio?.scheme?.isin ?? null,
        category: row.category ?? portfolio?.scheme?.category ?? null,
      },
      portfolio_id: portfolioId,
      source: {
        catalog_amfi: amfi,
        portfolio_id: portfolioId,
        portfolio_url: portfolioUrl,
      },
    };

    return jsonResponse(body, 200, {
      'Cache-Control':
        'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Could not load holdings',
        amfi_code: amfi,
        detail: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
}
