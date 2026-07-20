import {
  buildSnapshotFromPortfolio,
  fetchPublicPortfolioShareData,
  isSocialBot,
  ogImageUrl,
  profilePortfolioUrl,
  shareLandingUrl,
  siteOrigin,
} from '../../_lib/portfolioShareServer';

export default async function handler(request, { params }) {
  const portfolioId = params?.id;
  if (!portfolioId) {
    return new Response('Missing portfolio id', { status: 400 });
  }

  const url = new URL(request.url);
  const sort = url.searchParams.get('sort') === 'performance' ? 'performance' : 'allocation';
  const origin = siteOrigin(request);
  const payload = await fetchPublicPortfolioShareData(portfolioId);

  if (!payload) {
    return new Response('Portfolio not found', { status: 404 });
  }

  const snapshot = buildSnapshotFromPortfolio(payload.portfolio, { sort });
  const shareUrl = shareLandingUrl(origin, portfolioId, sort);
  const appUrl = profilePortfolioUrl(origin, payload.ownerHandle, portfolioId);
  const imageUrl = ogImageUrl(origin, portfolioId, sort);
  const title = `${snapshot.name} · PocketEdge`;
  const description = `Check out this portfolio on PocketEdge: ${shareUrl}`;
  const userAgent = request.headers.get('user-agent');

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="PocketEdge" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(shareUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:width" content="1080" />
    <meta property="og:image:height" content="1350" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    ${isSocialBot(userAgent) ? '' : `<meta http-equiv="refresh" content="0;url=${escapeHtml(appUrl)}" />`}
  </head>
  <body>
    <p>Redirecting to <a href="${escapeHtml(appUrl)}">${escapeHtml(snapshot.name)}</a>…</p>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
