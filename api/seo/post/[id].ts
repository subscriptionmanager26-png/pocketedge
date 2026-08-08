import {
  buildNewsPostSeoHtml,
  companyLogoAbsoluteUrl,
  DEFAULT_IMAGE,
  fetchPublicSocialPost,
  parseNewsContentForSeo,
  resolveCompanyName,
  siteOrigin,
  truncateSeoPreview,
  absoluteMediaUrl,
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

  const headline = parts.title || truncateSeoPreview(parts.text, 80) || 'Market news';
  const titleHead = parts.symbol
    ? `${companyName} (@${parts.symbol})`
    : companyName;
  const title = `${titleHead} — ${headline}`;
  const description =
    truncateSeoPreview(parts.text || parts.title, 180) ||
    `${titleHead} on PocketEdge`;

  const postImage = absoluteMediaUrl(
    origin,
    row.image_url ?? row.image ?? null
  );
  const logoImage = companyLogoAbsoluteUrl(
    origin,
    parts.symbol,
    parts.assetType
  );
  const image = postImage || logoImage || DEFAULT_IMAGE;
  const twitterCard = postImage ? 'summary_large_image' : 'summary';

  const canonical = `${origin}/post/${encodeURIComponent(id)}`;
  const html = buildNewsPostSeoHtml({
    title,
    description,
    canonical,
    image,
    twitterCard,
    h1: titleHead,
    bodyText: [parts.title, parts.text].filter(Boolean).join('\n\n'),
  });

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
