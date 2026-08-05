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
  context: { params?: { indexId?: string } }
) {
  const url = new URL(request.url);
  const indexId = String(
    context?.params?.indexId || url.pathname.split('/').filter(Boolean).pop() || ''
  ).trim();
  if (!indexId) {
    return new Response('Missing index id', { status: 400 });
  }

  const origin = siteOrigin(request);
  const key = indexId.toUpperCase();
  const row = await fetchMarketSearchItem(
    origin,
    'indices-search.json',
    (item) =>
      String(item.id ?? item.symbol ?? '').toUpperCase() === key ||
      String(item.symbol ?? '').toUpperCase() === key
  );

  const name = String(row?.name ?? row?.symbol ?? indexId);
  const symbol = String(row?.symbol ?? row?.id ?? indexId);
  const price = row?.price ?? row?.ltp ?? row?.value ?? null;
  const changePct = row?.changePct;
  const canonical = `${origin}/index/${encodeURIComponent(indexId)}`;
  const image = `${origin}/og-image.jpg?v=20260723`;
  const title = `${name} index · PocketEdge`;
  const description = `${name} index level and overview on PocketEdge.`;

  const priceLine =
    price != null && Number.isFinite(Number(price))
      ? `Latest level: ${Number(price).toLocaleString('en-IN', {
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
      'Follow index levels and related market discussion on PocketEdge.',
    ].filter(Boolean) as string[],
    links: [
      { href: canonical, label: `Open ${name}` },
      { href: `${origin}/ideas`, label: 'Explore ideas' },
      { href: `${origin}/`, label: 'PocketEdge home' },
    ],
    jsonLd: buildWebPageJsonLd({
      title,
      description,
      canonical,
      breadcrumbs: [
        { name: 'Home', url: `${origin}/` },
        { name: 'Indices', url: `${origin}/ideas` },
        { name: name, url: canonical },
      ],
      mainEntity: {
        '@type': 'Thing',
        '@id': `${canonical}#index`,
        name,
        alternateName: symbol,
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
