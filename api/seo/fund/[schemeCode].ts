import {
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
    ? `${name} — ${category}. Mutual fund NAV and details on PocketEdge.`
    : `${name} mutual fund details on PocketEdge.`;

  const navLine =
    nav != null && Number.isFinite(Number(nav))
      ? `Latest NAV: ₹${Number(nav).toLocaleString('en-IN', { maximumFractionDigits: 4 })}.`
      : null;

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
      'Browse NAV, community posts, and holders. Sign in to join discussions.',
    ].filter(Boolean) as string[],
    links: [
      { href: canonical, label: `Open fund ${schemeCode}` },
      { href: `${origin}/markets`, label: 'Browse Markets' },
      { href: `${origin}/resources/mf-screener`, label: 'MF screener' },
    ],
    noindex: !indexable,
  });

  return new Response(html, {
    status: row ? 200 : 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
    },
  });
}
