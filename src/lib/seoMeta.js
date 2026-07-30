/** Client-side document meta / OG helpers for public routes. */

const SITE_ORIGIN = 'https://www.pocketedge.in';
const DEFAULT_IMAGE = `${SITE_ORIGIN}/og-image.jpg?v=20260723`;
const DEFAULT_TITLE = 'PocketEdge — See what real investors own and say';
const DEFAULT_DESCRIPTION =
  'Browse Indian stocks, mutual funds, and ETFs. Read company business models and portfolio insights before you invest.';

function ensureMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
  }
  return el;
}

function setNamedMeta(name, content) {
  const el = ensureMeta(`meta[name="${name}"]`, { name });
  el.setAttribute('content', content);
}

function setPropertyMeta(property, content) {
  const el = ensureMeta(`meta[property="${property}"]`, { property });
  el.setAttribute('content', content);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setRobots(noindex) {
  if (noindex) {
    setNamedMeta('robots', 'noindex,follow');
  } else {
    const el = document.head.querySelector('meta[name="robots"]');
    if (el) el.remove();
  }
}

/**
 * Apply page SEO tags. Safe to call from useEffect; returns a restore fn.
 * @param {{ title?: string, description?: string, path?: string, image?: string, noindex?: boolean }} opts
 */
export function setSeoMeta({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  image = DEFAULT_IMAGE,
  noindex = false,
} = {}) {
  const urlPath = path.startsWith('/') ? path : `/${path}`;
  const canonical = `${SITE_ORIGIN}${urlPath === '/' ? '/' : urlPath}`;
  const fullTitle = title.includes('PocketEdge') ? title : `${title} · PocketEdge`;

  document.title = fullTitle;
  setNamedMeta('description', description);
  setCanonical(canonical);
  setRobots(noindex);

  setPropertyMeta('og:type', 'website');
  setPropertyMeta('og:site_name', 'PocketEdge');
  setPropertyMeta('og:title', fullTitle);
  setPropertyMeta('og:description', description);
  setPropertyMeta('og:url', canonical);
  setPropertyMeta('og:image', image);
  setPropertyMeta('og:image:secure_url', image);

  setNamedMeta('twitter:card', 'summary_large_image');
  setNamedMeta('twitter:title', fullTitle);
  setNamedMeta('twitter:description', description);
  setNamedMeta('twitter:image', image);

  return () => {
    document.title = DEFAULT_TITLE;
    setNamedMeta('description', DEFAULT_DESCRIPTION);
    setCanonical(`${SITE_ORIGIN}/`);
    setRobots(false);
    setPropertyMeta('og:title', DEFAULT_TITLE);
    setPropertyMeta('og:description', DEFAULT_DESCRIPTION);
    setPropertyMeta('og:url', `${SITE_ORIGIN}/`);
    setPropertyMeta('og:image', DEFAULT_IMAGE);
    setNamedMeta('twitter:title', DEFAULT_TITLE);
    setNamedMeta('twitter:description', DEFAULT_DESCRIPTION);
    setNamedMeta('twitter:image', DEFAULT_IMAGE);
  };
}

export { SITE_ORIGIN, DEFAULT_TITLE, DEFAULT_DESCRIPTION, DEFAULT_IMAGE };
