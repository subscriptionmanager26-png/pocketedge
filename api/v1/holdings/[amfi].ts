export const config = {
  runtime: 'edge',
};

import {
  holdingsPortfolioUrl,
  jsonResponse,
  loadAmfiCatalog,
  normalizeAmfi,
  normalizeAsOf,
  resolveLatestAsOf,
  HOLDINGS_CORS,
} from '../../_lib/fundHoldingsCdn.js';
import { trackOpenFinApiRequest } from '../../_lib/openfinApiUsage.js';

/**
 * GET /api/v1/holdings/:amfi
 * GET /api/v1/holdings/:amfi?as_of=2026-07-15
 *
 * Resolves AMFI share-class → shared portfolio book (GitHub raw, commit-pinned).
 * Omit as_of for latest; pass YYYY-MM-DD (or YYYY-MM → month-end) for history.
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

    const portfolioId = row.portfolio_id ? String(row.portfolio_id) : '';
    if (!row.has_holdings || !portfolioId) {
      return jsonResponse(
        {
          error: 'No Data Found',
          amfi_code: amfi,
          as_of: asOf || null,
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

    const availableAsOf = Array.isArray(row.available_as_of)
      ? row.available_as_of.map(String)
      : undefined;

    const effectiveAsOf = asOf || resolveLatestAsOf(row);
    if (!effectiveAsOf) {
      return jsonResponse(
        {
          error: 'No Data Found',
          amfi_code: amfi,
          as_of: null,
          portfolio_id: portfolioId,
          detail: 'Catalog has no latest_as_of or available_as_of for this scheme.',
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

    const portfolioUrl = await holdingsPortfolioUrl(portfolioId, effectiveAsOf);
    const portfolioRes = await fetch(portfolioUrl, {
      headers: { Accept: 'application/json' },
    });
    if (!portfolioRes.ok) {
      return jsonResponse(
        {
          error: asOf
            ? 'No holdings for this as_of date'
            : 'Could not load holdings',
          amfi_code: amfi,
          portfolio_id: portfolioId,
          as_of: effectiveAsOf,
          requested_as_of: asOf || null,
          available_as_of: availableAsOf,
        },
        portfolioRes.status === 404 ? 404 : 502,
        { 'Cache-Control': 'public, max-age=60' },
      );
    }

    const portfolio = await portfolioRes.json();
    const body = {
      ...portfolio,
      amfi_code: amfi,
      as_of: asOf || portfolio?.meta?.as_of || effectiveAsOf || null,
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
      available_as_of: availableAsOf,
      source: {
        catalog_amfi: amfi,
        portfolio_id: portfolioId,
        portfolio_url: portfolioUrl,
        as_of: effectiveAsOf,
        requested_as_of: asOf || null,
      },
    };

    trackOpenFinApiRequest({
      endpoint: 'holdings',
      method: 'GET',
      status: 200,
      amfi,
    });
    return jsonResponse(body, 200, {
      'Cache-Control':
        'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
    });
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
