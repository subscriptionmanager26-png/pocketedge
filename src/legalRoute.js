export const LEGAL_SLUGS = ['terms', 'privacy', 'disclosures', 'risk-disclosure'];

export function isLegalRoute() {
  const slug = new URLSearchParams(window.location.search).get('legal');
  return LEGAL_SLUGS.includes(slug);
}

export function getLegalSlug() {
  const slug = new URLSearchParams(window.location.search).get('legal');
  return LEGAL_SLUGS.includes(slug) ? slug : 'terms';
}

export function getLegalUrl(slug) {
  const url = new URL(window.location.origin);
  url.searchParams.set('legal', slug);
  return `${url.pathname}?${url.searchParams.toString()}`;
}
