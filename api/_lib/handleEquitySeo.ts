import {
  briefSectionsFromPayload,
  buildWebPageJsonLd,
  fetchCompanyBrief,
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

  const brief = assetKind === 'stock' ? await fetchCompanyBrief(origin, symbol) : null;
  const sections = briefSectionsFromPayload(brief);
  const blurb =
    brief?.sections?.executiveSummary?.prose ||
    brief?.tagline ||
    brief?.kicker ||
    null;
  const blurbText = blurb ? String(blurb).trim() : '';

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

  const categoryLine = [row?.category, row?.sector, row?.industry]
    .filter(Boolean)
    .map(String)
    .join(' · ');

  const title = `${name} (${symbol})${assetKind === 'etf' ? ' ETF' : ''} · PocketEdge`;
  const description = blurbText
    ? `${blurbText.slice(0, 155)}${blurbText.length > 155 ? '…' : ''}`
    : `${name} (${symbol}) — ${
        assetKind === 'etf' ? 'ETF' : 'stock'
      } quotes and company overview on PocketEdge.`;

  const paragraphs = [
    `${name} (${symbol})${assetKind === 'etf' ? ' ETF' : ''} on PocketEdge.`,
    categoryLine ? `Category: ${categoryLine}.` : null,
    priceLine,
    assetKind === 'stock' && !sections.length && blurbText ? blurbText : null,
    assetKind === 'etf'
      ? `Track ${symbol} ETF price and community discussion on PocketEdge.`
      : null,
  ].filter(Boolean) as string[];

  const mainEntity =
    assetKind === 'etf'
      ? {
          '@type': 'InvestmentFund',
          '@id': `${canonical}#fund`,
          name,
          tickerSymbol: symbol,
          url: canonical,
        }
      : {
          '@type': 'Corporation',
          '@id': `${canonical}#org`,
          name,
          tickerSymbol: symbol,
          url: canonical,
        };

  const html = renderAssetSeoHtml({
    title,
    description,
    canonical,
    image,
    h1: name,
    paragraphs,
    sections: assetKind === 'stock' ? sections.slice(0, 4) : [],
    links: [
      { href: canonical, label: `Open ${symbol} on PocketEdge` },
      ...(assetKind === 'stock'
        ? [
            {
              href: `${origin}/business-model/${encodeURIComponent(symbol)}`,
              label: 'Business model brief',
            },
          ]
        : [{ href: `${origin}/etf-tracker`, label: 'ETF iNAV tracker' }]),
      { href: `${origin}/`, label: 'PocketEdge home' },
    ],
    jsonLd: buildWebPageJsonLd({
      title,
      description,
      canonical,
      breadcrumbs: [
        { name: 'Home', url: `${origin}/` },
        {
          name: assetKind === 'etf' ? 'ETFs' : 'Stocks',
          url: `${origin}/ideas`,
        },
        { name: symbol, url: canonical },
      ],
      mainEntity,
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
