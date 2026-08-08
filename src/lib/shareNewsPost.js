import { postPath } from './routes';
import { isNewsSocialPost, parseNewsSocialContent } from './newsPostBody';
import { isPostHogEnabled } from './posthog';
import posthog from 'posthog-js';

const SITE_ORIGIN = 'https://www.pocketedge.in';
const PREVIEW_CHARS = 180;

/**
 * Absolute URL for a news (or any) social post.
 * Prefer production origin when already on pocketedge hosts.
 */
export function absoluteNewsPostUrl(postId, origin) {
  const path = postPath(postId);
  if (!path || path === '/feed') return SITE_ORIGIN;

  try {
    const raw =
      origin ??
      (typeof window !== 'undefined' ? window.location.origin : SITE_ORIGIN);
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'pocketedge.in') return `${SITE_ORIGIN}${path}`;
    // Dev / preview stay on current origin so share links are reachable.
    if (host === 'localhost' || host.endsWith('.vercel.app')) {
      return `${u.origin.replace(/\/$/, '')}${path}`;
    }
  } catch {
    /* fall through */
  }
  return `${SITE_ORIGIN}${path}`;
}

function truncatePreview(text, max = PREVIEW_CHARS) {
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

/**
 * Caption for system share (no logo). Omits empty parts.
 */
export function buildNewsShareCaption({
  companyName,
  symbol,
  title,
  text,
} = {}) {
  const lines = [];
  const name = String(companyName ?? '').trim();
  const ticker = String(symbol ?? '')
    .trim()
    .toUpperCase();
  const headline = String(title ?? '').trim();
  const preview = truncatePreview(text);

  if (name) lines.push(name);
  if (ticker) lines.push(`@${ticker}`);
  if (headline) {
    if (lines.length) lines.push('');
    lines.push(headline);
  }
  if (preview) {
    if (lines.length) lines.push('');
    lines.push(preview);
  }
  return lines.join('\n').trim();
}

export function buildNewsShareTitle({ companyName, symbol, title } = {}) {
  const name = String(companyName ?? '').trim();
  const ticker = String(symbol ?? '')
    .trim()
    .toUpperCase();
  const headline = String(title ?? '').trim();
  const head = [name, ticker ? `(@${ticker})` : ''].filter(Boolean).join(' ');
  if (head && headline) return `${head} — ${headline}`;
  return head || headline || 'News on PocketEdge';
}

function track(event, props) {
  if (!isPostHogEnabled) return;
  try {
    posthog.capture(event, props);
  } catch {
    /* analytics must never break share */
  }
}

export async function copyNewsPostLink(postId) {
  const url = absoluteNewsPostUrl(postId);
  await navigator.clipboard.writeText(url);
  track('news_post_link_copied', { post_id: String(postId ?? '') });
  return url;
}

/**
 * Native share with caption + URL; falls back to copying the link.
 * @returns {'shared'|'copied'|'cancelled'}
 */
export async function shareNewsPost({ post, companyName } = {}) {
  const postId = post?.id;
  if (!postId) throw new Error('Missing post id');

  const parts = isNewsSocialPost(post)
    ? parseNewsSocialContent(post)
    : { symbol: null, title: '', text: String(post?.body ?? '') };

  const displayName =
    companyName ||
    post?.companyName ||
    parts.symbol ||
    'PocketEdge News';
  const url = absoluteNewsPostUrl(postId);
  const caption = buildNewsShareCaption({
    companyName: displayName,
    symbol: parts.symbol,
    title: parts.title,
    text: parts.text,
  });
  const title = buildNewsShareTitle({
    companyName: displayName,
    symbol: parts.symbol,
    title: parts.title,
  });

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const payloads = [
        { title, text: caption, url },
        { text: caption, url },
        { title, url },
        { url },
      ];
      for (const payload of payloads) {
        try {
          if (navigator.canShare && !navigator.canShare(payload)) continue;
        } catch {
          /* canShare may throw for some payloads */
        }
        await navigator.share(payload);
        track('news_post_shared', {
          post_id: String(postId),
          method: 'native',
        });
        return 'shared';
      }
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      /* fall through to clipboard */
    }
  }

  await copyNewsPostLink(postId);
  track('news_post_shared', { post_id: String(postId), method: 'clipboard' });
  return 'copied';
}

export { truncatePreview };
