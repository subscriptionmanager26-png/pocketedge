import {
  buildWebPageJsonLd,
  fetchMarketSearchItem,
  renderAssetSeoHtml,
  siteOrigin,
} from '../../_lib/seoAssetServer.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(
  request: Request,
  context: { params?: { commodityId?: string } }
) {
  const url = new URL(request.url);
  const commodityId = String(
    context?.params?.commodityId || url.pathname.split('/').filter(Boolean).pop() || ''
  ).trim();
  if (!commodityId) {
    return new Response('Missing commodity id', { status: 400 });
  }

  const origin = siteOrigin(request);
  const key = commodityId.toUpperCase();
  const row = await fetchMarketSearchItem(
    origin,
    'commodities-search.json',
    (item) =>
      String(item.id ?? item.symbol ?? '').toUpperCase() === key ||
      String(item.symbol ?? '').toUpperCase() === key
  );

  const name = String(row?.name ?? row?.symbol ?? commodityId);
  const symbol = String(row?.symbol ?? row?.id ?? commodityId);
  const price = row?.price ?? row?.ltp ?? null;
  const changePct = row?.changePct;
  const canonical = `${origin}/commodity/${encodeURIComponent(commodityId)}`;
  const image = `${origin}/og-image.jpg?v=20260723`;
  const title = `${name} · PocketEdge`;
  const description = `${name} commodity price and overview on PocketEdge.`;

  const priceLine =
    price != null && Number.isFinite(Number(price))
      ? `Latest price: ₹${Number(price).toLocaleString('en-IN', {
          maximumFractionDigits: 2,
        })}${
          changePct != null && Number.isFinite(Number(changePct))
            ? ` (${Number(changePct) >= 0 ? '+' : ''}${Number(changePct).toFixed(2)}%)`
            : ''
        }.`
      : null;

  const html = renderAssetSeoHtml({
    title,
    description,
    canonical,
    image,
    h1: name,
    paragraphs: [
      `${name} (${symbol}) on PocketEdge.`,
      priceLine,
      'Follow commodity prices and related discussion on PocketEdge.',
    ].filter(Boolean) as string[],
    links: [
      { href: canonical, label: `Open ${name}` },
      { href: `${origin}/gold-tracker`, label: 'Gold / SGB tracker' },
      { href: `${origin}/`, label: 'PocketEdge home' },
    ],
    jsonLd: buildWebPageJsonLd({
      title,
      description,
      canonical,
      breadcrumbs: [
        { name: 'Home', url: `${origin}/` },
        { name: 'Commodities', url: `${origin}/ideas` },
        { name: name, url: canonical },
      ],
      mainEntity: {
        '@type': 'Product',
        '@id': `${canonical}#commodity`,
        name,
        sku: symbol,
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
