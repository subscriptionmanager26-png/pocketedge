import {
  fetchBriefBlurb,
  fetchMarketSearchItem,
  renderAssetSeoHtml,
  siteOrigin,
} from './seoAssetServer.js';

export async function handleEquitySeoRequest(
  request: Request,
  context: { params?: { symbol?: string } },
  forcedKind: 'stock' | 'etf' | null = null
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
  const pathKind =
    forcedKind ??
    (url.pathname.includes('/seo/etf/') || url.pathname.includes('/etf/') ? 'etf' : 'stock');

  const primaryFile = pathKind === 'etf' ? 'etf-search.json' : 'stocks-search.json';
  const altFile = pathKind === 'etf' ? 'stocks-search.json' : 'etf-search.json';

  const match = (row: Record<string, unknown>) =>
    String(row.symbol ?? row.id ?? '').toUpperCase() === symbol;

  const row =
    (await fetchMarketSearchItem(origin, primaryFile, match)) ??
    (await fetchMarketSearchItem(origin, altFile, match));

  const name = String(row?.name ?? symbol);
  const price = row?.price ?? row?.ltp ?? null;
  const changePct = row?.changePct;
  const assetKind =
    pathKind === 'etf' || row?.assetType === 'etf' ? 'etf' : 'stock';
  const path =
    assetKind === 'etf'
      ? `/etf/${encodeURIComponent(symbol)}`
      : `/stock/${encodeURIComponent(symbol)}`;
  const canonical = `${origin}${path}`;
  const image = `${origin}/og-image.jpg?v=20260723`;

  const blurb = assetKind === 'stock' ? await fetchBriefBlurb(origin, symbol) : null;

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

  const title = `${name} (${symbol})${assetKind === 'etf' ? ' ETF' : ''} · PocketEdge`;
  const description = blurb
    ? `${blurb.slice(0, 155)}${blurb.length > 155 ? '…' : ''}`
    : `${name} (${symbol}) — ${
        assetKind === 'etf' ? 'ETF' : 'stock'
      } quotes, insights, and news on PocketEdge.`;

  const html = renderAssetSeoHtml({
    title,
    description,
    canonical,
    image,
    h1: name,
    paragraphs: [
      `${name} (${symbol}) on PocketEdge.`,
      priceLine,
      blurb,
      assetKind === 'stock'
        ? `Read AI insights, news, and the company business model for ${symbol}.`
        : `Track ${symbol} ETF price and community discussion on PocketEdge.`,
    ].filter(Boolean) as string[],
    links: [
      { href: canonical, label: `Open ${symbol} on PocketEdge` },
      { href: `${origin}/markets`, label: 'Browse Markets' },
      ...(assetKind === 'stock'
        ? [
            {
              href: `${origin}/business-model/${encodeURIComponent(symbol)}`,
              label: 'Business model brief',
            },
          ]
        : []),
    ],
  });

  return new Response(html, {
    status: row ? 200 : 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
    },
  });
}
