/** Shared helpers for public asset SEO HTML (bots / social crawlers). */

export function siteOrigin(request: Request) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  if (host) return `${proto}://${host}`;
  return 'https://www.pocketedge.in';
}

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Social + search crawlers that should receive server HTML. */
export function isSeoBot(userAgent: string | null) {
  const ua = String(userAgent ?? '').toLowerCase();
  return (
    ua.includes('googlebot') ||
    ua.includes('bingbot') ||
    ua.includes('duckduckbot') ||
    ua.includes('yandex') ||
    ua.includes('baiduspider') ||
    ua.includes('facebookexternalhit') ||
    ua.includes('twitterbot') ||
    ua.includes('linkedinbot') ||
    ua.includes('slackbot') ||
    ua.includes('whatsapp') ||
    ua.includes('telegrambot') ||
    ua.includes('discordbot') ||
    ua.includes('applebot')
  );
}

export function isSelectiveFundName(name: string) {
  const hay = String(name ?? '').toLowerCase();
  const isDirect = /\bdirect\b/.test(hay);
  const isGrowth = /\bgrowth\b/.test(hay) && !/\bidcw\b|\bdividend\b/.test(hay);
  return isDirect && isGrowth;
}

type SearchPayload = { items?: Array<Record<string, unknown>> };

export async function fetchMarketSearchItem(
  origin: string,
  file: 'stocks-search.json' | 'etf-search.json' | 'mutual-funds-search.json',
  matcher: (row: Record<string, unknown>) => boolean
) {
  try {
    const res = await fetch(`${origin}/data/markets/${file}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as SearchPayload;
    const items = Array.isArray(payload.items) ? payload.items : [];
    return items.find(matcher) ?? null;
  } catch {
    return null;
  }
}

export async function fetchBriefBlurb(origin: string, symbol: string) {
  const key = String(symbol || '')
    .trim()
    .toUpperCase();
  if (!key) return null;
  const ch = key.charAt(0);
  const shard = /[A-Z]/.test(ch) ? ch : '0';
  try {
    const res = await fetch(`${origin}/data/company-briefs/shards/${shard}.json`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as Record<string, any>;
    const brief = payload?.[key];
    if (!brief) return null;
    const prose =
      brief?.sections?.executiveSummary?.prose || brief?.tagline || brief?.kicker || '';
    const text = String(prose).trim();
    if (!text) return null;
    return text.length > 400 ? `${text.slice(0, 397).trim()}…` : text;
  } catch {
    return null;
  }
}

export function renderAssetSeoHtml({
  title,
  description,
  canonical,
  image,
  h1,
  paragraphs,
  links,
  noindex = false,
}: {
  title: string;
  description: string;
  canonical: string;
  image: string;
  h1: string;
  paragraphs: string[];
  links: Array<{ href: string; label: string }>;
  noindex?: boolean;
}) {
  const bodyParas = paragraphs
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('\n    ');
  const bodyLinks = links
    .map(
      (l) =>
        `<p><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a></p>`
    )
    .join('\n    ');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    ${noindex ? '<meta name="robots" content="noindex,follow" />' : ''}
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="PocketEdge" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
  </head>
  <body>
    <main>
      <h1>${escapeHtml(h1)}</h1>
      ${bodyParas}
      ${bodyLinks}
    </main>
  </body>
</html>`;
}
