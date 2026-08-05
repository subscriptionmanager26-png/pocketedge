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

export const BRIEF_SECTION_ORDER = [
  { key: 'executiveSummary', label: 'Executive summary' },
  { key: 'products', label: 'Products' },
  { key: 'customers', label: 'Customers' },
  { key: 'businessModel', label: 'Business model' },
  { key: 'moats', label: 'Moats' },
  { key: 'growth', label: 'Growth' },
  { key: 'risks', label: 'Risks' },
] as const;

type SearchPayload = { items?: Array<Record<string, unknown>> };

export type MarketSearchFile =
  | 'stocks-search.json'
  | 'etf-search.json'
  | 'mutual-funds-search.json'
  | 'indices-search.json'
  | 'commodities-search.json';

export async function fetchMarketSearchItem(
  origin: string,
  file: MarketSearchFile,
  matcher: (row: Record<string, unknown>) => boolean
) {
  try {
    const res = await fetch(`${origin}/data/markets/${file}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as SearchPayload | Array<Record<string, unknown>>;
    const items = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.items)
        ? payload.items
        : [];
    return items.find(matcher) ?? null;
  } catch {
    return null;
  }
}

export type CompanyBriefPayload = {
  symbol?: string;
  name?: string;
  legalName?: string;
  kicker?: string;
  tagline?: string;
  website?: string;
  sections?: Record<string, { prose?: string; tags?: string[] } | undefined>;
};

export async function fetchCompanyBrief(
  origin: string,
  symbol: string
): Promise<CompanyBriefPayload | null> {
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
    const payload = (await res.json()) as Record<string, CompanyBriefPayload>;
    return payload?.[key] ?? null;
  } catch {
    return null;
  }
}

export function briefSectionsFromPayload(brief: CompanyBriefPayload | null) {
  if (!brief?.sections) return [] as Array<{ heading: string; prose: string }>;
  return BRIEF_SECTION_ORDER.map(({ key, label }) => {
    const prose = String(brief.sections?.[key]?.prose ?? '').trim();
    if (!prose) return null;
    return { heading: label, prose };
  }).filter(Boolean) as Array<{ heading: string; prose: string }>;
}

export async function fetchBriefBlurb(origin: string, symbol: string) {
  const brief = await fetchCompanyBrief(origin, symbol);
  if (!brief) return null;
  const prose =
    brief?.sections?.executiveSummary?.prose || brief?.tagline || brief?.kicker || '';
  const text = String(prose).trim();
  if (!text) return null;
  return text.length > 400 ? `${text.slice(0, 397).trim()}…` : text;
}

export type FundSeoLite = {
  aum?: string | null;
  expenseRatio?: string | null;
  cagr?: Record<string, string> | null;
  holdings?: Array<{ name?: string; weightage?: string; sector?: string }> | null;
};

export async function fetchFundSeoLite(
  origin: string,
  schemeCode: string
): Promise<FundSeoLite | null> {
  const code = String(schemeCode || '').trim();
  if (!code) return null;
  try {
    const res = await fetch(`${origin}/data/screener/fund-seo-lite.json`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { funds?: Record<string, FundSeoLite> };
    return payload?.funds?.[code] ?? null;
  } catch {
    return null;
  }
}

export type SeoBreadcrumb = { name: string; url: string };

export type SeoSection = { heading: string; prose: string };

export function renderAssetSeoHtml({
  title,
  description,
  canonical,
  image,
  h1,
  paragraphs = [],
  sections = [],
  lists = [],
  links = [],
  noindex = false,
  jsonLd = null,
}: {
  title: string;
  description: string;
  canonical: string;
  image: string;
  h1: string;
  paragraphs?: string[];
  sections?: SeoSection[];
  lists?: Array<{ heading: string; items: string[] }>;
  links?: Array<{ href: string; label: string }>;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>> | null;
}) {
  const bodyParas = paragraphs
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('\n    ');

  const bodySections = sections
    .filter((s) => s?.heading && s?.prose)
    .map(
      (s) =>
        `<section>\n      <h2>${escapeHtml(s.heading)}</h2>\n      <p>${escapeHtml(s.prose)}</p>\n    </section>`
    )
    .join('\n    ');

  const bodyLists = lists
    .filter((l) => l?.heading && Array.isArray(l.items) && l.items.length)
    .map((l) => {
      const items = l.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n        ');
      return `<section>\n      <h2>${escapeHtml(l.heading)}</h2>\n      <ul>\n        ${items}\n      </ul>\n    </section>`;
    })
    .join('\n    ');

  const bodyLinks = links
    .map(
      (l) =>
        `<p><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a></p>`
    )
    .join('\n    ');

  const ld = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(
        /</g,
        '\\u003c'
      )}</script>`
    : '';

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
    ${ld}
  </head>
  <body>
    <main>
      <h1>${escapeHtml(h1)}</h1>
      ${bodyParas}
      ${bodySections}
      ${bodyLists}
      ${bodyLinks}
    </main>
  </body>
</html>`;
}

export function buildBreadcrumbJsonLd(items: SeoBreadcrumb[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildWebPageJsonLd({
  title,
  description,
  canonical,
  breadcrumbs,
  mainEntity,
}: {
  title: string;
  description: string;
  canonical: string;
  breadcrumbs: SeoBreadcrumb[];
  mainEntity?: Record<string, unknown> | null;
}) {
  const graph: Array<Record<string, unknown>> = [
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: title,
      description,
      isPartOf: {
        '@type': 'WebSite',
        name: 'PocketEdge',
        url: 'https://www.pocketedge.in/',
      },
      ...(mainEntity ? { mainEntity } : {}),
    },
    buildBreadcrumbJsonLd(breadcrumbs),
  ];
  if (mainEntity) graph.push(mainEntity);
  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}
