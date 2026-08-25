import {
  holdingsPortfolioUrlForRow,
  jsonResponse,
  mergeSchemeFromCatalog,
  type CatalogRow,
} from './fundHoldingsCdn.js';

export type HoldingsBookResult =
  | { ok: true; status: 200; body: Record<string, unknown> }
  | { ok: false; status: number; body: Record<string, unknown> };

/** Load portfolio book for a catalog row (shared by AMFI and ISIN routes). */
export async function serveHoldingsBook(
  amfi: string,
  row: CatalogRow,
  asOf: string | null,
  source: { lookup: 'amfi' | 'isin'; isin?: string | null },
): Promise<HoldingsBookResult> {
  const portfolioId = row.portfolio_id ? String(row.portfolio_id) : '';
  if (!row.has_holdings || !portfolioId) {
    return {
      ok: false,
      status: 404,
      body: {
        error: 'No Data Found',
        amfi_code: amfi,
        isin: source.isin ?? row.isin ?? null,
        as_of: asOf || null,
        scheme: {
          name: row.name ?? null,
          amc_name: row.amc_name ?? null,
          parent_name: row.parent_name ?? null,
        },
      },
    };
  }

  const availableAsOf = Array.isArray(row.available_as_of)
    ? row.available_as_of.map(String)
    : undefined;

  const portfolioUrl = await holdingsPortfolioUrlForRow(row, portfolioId, asOf);
  const portfolioRes = await fetch(portfolioUrl, {
    headers: { Accept: 'application/json' },
  });
  if (!portfolioRes.ok) {
    return {
      ok: false,
      status: portfolioRes.status === 404 ? 404 : 502,
      body: {
        error: asOf ? 'No holdings for this as_of date' : 'Could not load holdings',
        amfi_code: amfi,
        isin: source.isin ?? row.isin ?? null,
        portfolio_id: portfolioId,
        as_of: asOf || null,
        available_as_of: availableAsOf,
      },
    };
  }

  const portfolio = await portfolioRes.json();
  const scheme = mergeSchemeFromCatalog(
    amfi,
    row,
    portfolio?.scheme && typeof portfolio.scheme === 'object' ? portfolio.scheme : null,
  );

  return {
    ok: true,
    status: 200,
    body: {
      ...portfolio,
      amfi_code: amfi,
      isin: source.isin ?? scheme.isin ?? row.isin ?? null,
      as_of: asOf || portfolio?.meta?.as_of || portfolio?.as_of || null,
      scheme,
      portfolio_id: portfolioId,
      available_as_of: availableAsOf,
      source: {
        lookup: source.lookup,
        catalog_amfi: amfi,
        isin: source.isin ?? row.isin ?? null,
        portfolio_id: portfolioId,
        portfolio_url: portfolioUrl,
        as_of: asOf || null,
      },
    },
  };
}

export function holdingsBookResponse(result: HoldingsBookResult) {
  const extra =
    result.status === 200
      ? {
          'Cache-Control':
            'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        }
      : result.status === 404
        ? { 'Cache-Control': 'public, max-age=300' }
        : { 'Cache-Control': 'public, max-age=60' };
  return jsonResponse(result.body, result.status, extra);
}
