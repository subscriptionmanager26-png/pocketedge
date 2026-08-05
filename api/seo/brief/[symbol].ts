import {
  briefSectionsFromPayload,
  buildWebPageJsonLd,
  fetchCompanyBrief,
  renderAssetSeoHtml,
  siteOrigin,
} from '../../_lib/seoAssetServer.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(
  request: Request,
  context: { params?: { symbol?: string } }
) {
  const url = new URL(request.url);
  const symbolRaw =
    context?.params?.symbol ||
    url.pathname.split('/').filter(Boolean).pop() ||
    '';
  const symbol = String(symbolRaw).trim().toUpperCase();
  if (!symbol) {
    return new Response('Missing symbol', { status: 400 });
  }

  const origin = siteOrigin(request);
  const brief = await fetchCompanyBrief(origin, symbol);
  const name = String(brief?.legalName || brief?.name || symbol);
  const canonical = `${origin}/business-model/${encodeURIComponent(symbol)}`;
  const image = `${origin}/og-image.jpg?v=20260723`;
  const kicker = String(brief?.kicker || '').trim();
  const tagline = String(brief?.tagline || '').trim();
  const sections = briefSectionsFromPayload(brief);
  const description = kicker
    ? `${kicker.slice(0, 155)}${kicker.length > 155 ? '…' : ''}`
    : `What ${symbol} does and how the business works — company brief on PocketEdge.`;
  const title = `${name} business model · PocketEdge`;

  const paragraphs = [
    kicker || null,
    tagline && tagline !== kicker ? tagline : null,
    !sections.length
      ? `Company business model brief for ${name} (${symbol}) on PocketEdge.`
      : null,
  ].filter(Boolean) as string[];

  const orgEntity = {
    '@type': 'Corporation',
    '@id': `${canonical}#org`,
    name,
    tickerSymbol: symbol,
    url: brief?.website || canonical,
  };

  const html = renderAssetSeoHtml({
    title,
    description,
    canonical,
    image,
    h1: `${name} (${symbol})`,
    paragraphs,
    sections,
    links: [
      { href: canonical, label: `Open ${symbol} business model` },
      {
        href: `${origin}/stock/${encodeURIComponent(symbol)}`,
        label: `${symbol} stock page`,
      },
      { href: `${origin}/business-model`, label: 'All business model briefs' },
      { href: `${origin}/`, label: 'PocketEdge home' },
    ],
    jsonLd: buildWebPageJsonLd({
      title,
      description,
      canonical,
      breadcrumbs: [
        { name: 'Home', url: `${origin}/` },
        { name: 'Business model', url: `${origin}/business-model` },
        { name: symbol, url: canonical },
      ],
      mainEntity: orgEntity,
    }),
  });

  return new Response(html, {
    status: brief ? 200 : 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
