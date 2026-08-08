import { createClient } from '@supabase/supabase-js';
import { supabaseServerConfig } from './supabaseServer.js';
import {
  escapeHtml,
  fetchMarketSearchItem,
  siteOrigin,
} from './seoAssetServer.js';

const SITE_ORIGIN = 'https://www.pocketedge.in';
const DEFAULT_IMAGE = `${SITE_ORIGIN}/og-image.jpg?v=20260723`;
const TICKER_PREFIX_RE = /^[@$]([A-Za-z0-9._-]+)\s*:?\s*(.*)$/;

export function getSupabaseForPublicPost() {
  const { url, anonKey, serviceRoleKey } = supabaseServerConfig();
  if (!url) return null;
  const key = serviceRoleKey || anonKey;
  if (!key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function fetchPublicSocialPost(postId: string) {
  const client = getSupabaseForPublicPost();
  if (!client) return null;
  const { data, error } = await client.rpc('get_public_social_post', {
    p_post_id: postId,
  });
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

/** Mirror of client parseNewsSocialContent — keep light for edge SEO. */
export function parseNewsContentForSeo(post: Record<string, unknown>) {
  const via = (post?.via ?? null) as Record<string, unknown> | null;
  const assetType = String(via?.type ?? 'Stock')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '') || 'stock';

  const raw = String(post?.body ?? '');
  const lines = raw.split('\n');

  let symbol = String(via?.ticker ?? '')
    .trim()
    .toUpperCase() || null;
  let title = '';
  let bodyStart = 0;

  let i = 0;
  while (i < lines.length && !lines[i].trim()) i += 1;

  if (i < lines.length) {
    const first = lines[i].trim();
    const match = first.match(TICKER_PREFIX_RE);
    if (match) {
      if (!symbol) symbol = match[1].toUpperCase();
      const remainder = String(match[2] ?? '').trim();
      if (remainder) {
        title = remainder;
        bodyStart = i + 1;
      } else {
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j += 1;
        if (j < lines.length && !/^[•\-*]/.test(lines[j].trim())) {
          title = lines[j].trim();
          bodyStart = j + 1;
        } else {
          bodyStart = i + 1;
        }
      }
    } else if (!/^[•\-*]/.test(first)) {
      title = first;
      bodyStart = i + 1;
    } else {
      bodyStart = i;
    }
  }

  while (bodyStart < lines.length && !lines[bodyStart].trim()) bodyStart += 1;
  const text = lines.slice(bodyStart).join('\n').replace(/^\n+|\n+$/g, '');

  return {
    symbol,
    title,
    text,
    assetType: assetType === 'etf' ? 'etf' : 'stock',
  };
}

export function truncateSeoPreview(text: unknown, max = 180) {
  const flat = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!flat) return '';
  if (flat.length <= max) return flat;
  const slice = flat.slice(0, max - 1);
  const boundary = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf('•'));
  const cut = boundary > max * 0.5 ? slice.slice(0, boundary) : slice;
  return `${cut.trim()}…`;
}

function storageObjectKey(assetKey: string) {
  return String(assetKey ?? '')
    .trim()
    .replace(/&/g, '_')
    .replace(/\s+/g, '_');
}

/** Absolute company logo URL via same-origin asset-logos rewrite. */
export function companyLogoAbsoluteUrl(
  origin: string,
  symbol: string | null,
  assetType = 'stock'
) {
  const key = storageObjectKey(symbol ?? '');
  if (!key) return null;
  const type =
    String(assetType ?? 'stock')
      .trim()
      .toLowerCase() || 'stock';
  const folder =
    type === 'index' || type === 'commodity' || type === 'etf' ? 'stock' : type;
  if (folder === 'fund') return null;
  return `${origin}/asset-logos/${folder}/${encodeURIComponent(key)}/icon-256.png?v=5`;
}

export function absoluteMediaUrl(origin: string, url: unknown) {
  const raw = String(url ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return `${origin}${raw}`;
  return null;
}

export async function resolveCompanyName(
  origin: string,
  symbol: string | null,
  assetType: string
) {
  if (!symbol) return null;
  const primaryFile =
    assetType === 'etf' ? ('etf-search.json' as const) : ('stocks-search.json' as const);
  const altFile =
    assetType === 'etf' ? ('stocks-search.json' as const) : ('etf-search.json' as const);
  const match = (row: Record<string, unknown>) =>
    String(row.symbol ?? row.id ?? '').toUpperCase() === symbol;
  const row =
    (await fetchMarketSearchItem(origin, primaryFile, match)) ??
    (await fetchMarketSearchItem(origin, altFile, match));
  return row?.name ? String(row.name) : null;
}

export function buildNewsPostSeoHtml({
  title,
  description,
  canonical,
  image,
  twitterCard = 'summary_large_image',
  h1,
  bodyText,
  imageWidth = 1200,
  imageHeight = 630,
}: {
  title: string;
  description: string;
  canonical: string;
  image: string;
  twitterCard?: 'summary' | 'summary_large_image';
  h1: string;
  bodyText?: string;
  imageWidth?: number;
  imageHeight?: number;
}) {
  const preview = bodyText
    ? `<p>${escapeHtml(bodyText)}</p>`
    : `<p>${escapeHtml(description)}</p>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="PocketEdge" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(image)}" />
    <meta property="og:image:width" content="${escapeHtml(imageWidth)}" />
    <meta property="og:image:height" content="${escapeHtml(imageHeight)}" />
    <meta property="og:image:alt" content="${escapeHtml(title)}" />
    <meta name="twitter:card" content="${escapeHtml(twitterCard)}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
  </head>
  <body>
    <main>
      <h1>${escapeHtml(h1)}</h1>
      ${preview}
      <p><a href="${escapeHtml(canonical)}">Open on PocketEdge</a></p>
    </main>
  </body>
</html>`;
}

export { siteOrigin, DEFAULT_IMAGE, SITE_ORIGIN };
