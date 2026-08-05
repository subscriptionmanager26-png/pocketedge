import {
  buildWebPageJsonLd,
  fetchFundSeoLite,
  fetchMarketSearchItem,
  isSelectiveFundName,
  renderAssetSeoHtml,
  siteOrigin,
} from '../../_lib/seoAssetServer.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(
  request: Request,
  context: { params?: { schemeCode?: string } }
) {
  const url = new URL(request.url);
  const schemeCode = String(
    context?.params?.schemeCode || url.pathname.split('/').filter(Boolean).pop() || ''
  ).trim();
  if (!schemeCode) {
    return new Response('Missing scheme code', { status: 400 });
  }

  const origin = siteOrigin(request);
  const row = await fetchMarketSearchItem(
    origin,
    'mutual-funds-search.json',
    (item) => String(item.schemeCode ?? item.id ?? '') === schemeCode
  );

  const name = String(row?.name ?? `Fund ${schemeCode}`);
  const category = [row?.category, row?.subCategory, row?.amc].filter(Boolean).join(' · ');
  const nav = row?.nav;
  const indexable = isSelectiveFundName(name);
  const canonical = `${origin}/fund/${encodeURIComponent(schemeCode)}`;
  const image = `${origin}/og-image.jpg?v=20260723`;
  const title = `${name} · PocketEdge`;
  const description = category
    ? `${name} — ${category}. Mutual fund NAV, returns, and holdings on PocketEdge.`
    : `${name} mutual fund details on PocketEdge.`;

  const lite = indexable ? await fetchFundSeoLite(origin, schemeCode) : null;

  const navLine =
    nav != null && Number.isFinite(Number(nav))
      ? `Latest NAV: ₹${Number(nav).toLocaleString('en-IN', { maximumFractionDigits: 4 })}.`
      : null;

  const metricBits: string[] = [];
  if (lite?.aum) metricBits.push(`AUM: ₹${lite.aum} Cr`);
  if (lite?.expenseRatio) metricBits.push(`Expense ratio: ${lite.expenseRatio}%`);
  const cagr = lite?.cagr ?? {};
  if (cagr['1y']) metricBits.push(`1Y CAGR: ${cagr['1y']}%`);
  if (cagr['3y']) metricBits.push(`3Y CAGR: ${cagr['3y']}%`);
  if (cagr['5y']) metricBits.push(`5Y CAGR: ${cagr['5y']}%`);
  const metricsLine = metricBits.length ? `${metricBits.join(' · ')}.` : null;

  const holdingItems = (lite?.holdings ?? [])
    .slice(0, 10)
    .map((h) => {
      const n = String(h?.name ?? '').trim();
      if (!n) return null;
      const w = h?.weightage != null ? `${h.weightage}%` : null;
      return w ? `${n} (${w})` : n;
    })
    .filter(Boolean) as string[];

  const html = renderAssetSeoHtml({
    title,
    description,
    canonical,
    image,
    h1: name,
    paragraphs: [
      `${name} on PocketEdge.`,
      category ? `Category: ${category}.` : null,
      navLine,
      metricsLine,
      'Browse NAV, returns, and top holdings. Sign in to join discussions.',
    ].filter(Boolean) as string[],
    lists: holdingItems.length
      ? [{ heading: 'Top holdings', items: holdingItems }]
      : [],
    links: [
      { href: canonical, label: `Open fund ${schemeCode}` },
      { href: `${origin}/resources/mf-screener`, label: 'MF screener' },
      { href: `${origin}/`, label: 'PocketEdge home' },
    ],
    noindex: !indexable,
    jsonLd: buildWebPageJsonLd({
      title,
      description,
      canonical,
      breadcrumbs: [
        { name: 'Home', url: `${origin}/` },
        { name: 'Mutual funds', url: `${origin}/resources/mf-screener` },
        { name: name, url: canonical },
      ],
      mainEntity: {
        '@type': 'InvestmentFund',
        '@id': `${canonical}#fund`,
        name,
        identifier: schemeCode,
        url: canonical,
      },
    }),
  });

  return new Response(html, {
    status: row ? 200 : 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
    },
  });
}
