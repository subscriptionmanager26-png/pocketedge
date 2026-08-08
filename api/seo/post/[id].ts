import {
  buildNewsPostSeoHtml,
  fetchPublicSocialPost,
  parseNewsContentForSeo,
  resolveCompanyName,
  siteOrigin,
  truncateSeoPreview,
} from '../../_lib/newsPostSeo.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(
  request: Request,
  context: { params?: { id?: string } }
) {
  const url = new URL(request.url);
  const postId =
    context?.params?.id ||
    url.pathname.split('/').filter(Boolean).pop() ||
    '';
  const id = String(postId ?? '').trim();
  if (!id || id === 'post') {
    return new Response('Missing post id', { status: 400 });
  }

  const origin = siteOrigin(request);
  const row = await fetchPublicSocialPost(id);
  if (!row) {
    return new Response('Post not found', { status: 404 });
  }

  const parts = parseNewsContentForSeo(row);
  const companyName =
    (await resolveCompanyName(origin, parts.symbol, parts.assetType)) ||
    parts.symbol ||
    'PocketEdge News';

  // Unfurl title = company + symbol; description = longer post excerpt for mobile cards.
  const title = parts.symbol
    ? `${companyName} (@${parts.symbol})`
    : companyName;
  const fullText = [parts.title, parts.text].filter(Boolean).join(' ');
  const description =
    truncateSeoPreview(fullText, 200) || `${title} on PocketEdge`;

  // Same card size as parent/site OG (1200×630 summary_large_image).
  const image = `${origin}/api/og/news-post?id=${encodeURIComponent(id)}`;

  const canonical = `${origin}/post/${encodeURIComponent(id)}`;
  const html = buildNewsPostSeoHtml({
    title,
    description,
    canonical,
    image,
    twitterCard: 'summary_large_image',
    imageWidth: 1200,
    imageHeight: 630,
    h1: title,
    bodyText: truncateSeoPreview(fullText, 400) || description,
  });

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
