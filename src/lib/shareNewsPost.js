import { postPath } from './routes';
import { isPostHogEnabled } from './posthog';
import posthog from 'posthog-js';

const SITE_ORIGIN = 'https://www.pocketedge.in';
/** OG description / preview length for unfurl cards. */
export const NEWS_OG_PREVIEW_CHARS = 140;

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

export function truncatePreview(text, max = NEWS_OG_PREVIEW_CHARS) {
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

/** OG / document title: company name + symbol only. */
export function buildNewsShareTitle({ companyName, symbol } = {}) {
  const name = String(companyName ?? '').trim();
  const ticker = String(symbol ?? '')
    .trim()
    .toUpperCase();
  if (name && ticker) return `${name} (@${ticker})`;
  if (name) return name;
  if (ticker) return `@${ticker}`;
  return 'News on PocketEdge';
}

/**
 * Post body for OG description: title + text, capped at 140 chars.
 */
export function buildNewsOgDescription({ title, text } = {}) {
  const combined = [String(title ?? '').trim(), String(text ?? '').trim()]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return truncatePreview(combined, NEWS_OG_PREVIEW_CHARS);
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
 * Native share — URL only (no caption). Falls back to copying the link.
 * @returns {'shared'|'copied'|'cancelled'}
 */
export async function shareNewsPost({ post } = {}) {
  const postId = post?.id;
  if (!postId) throw new Error('Missing post id');

  const url = absoluteNewsPostUrl(postId);

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      // URL only — platforms unfurl the OG card. Avoid title/text so message stays just the link.
      const payloads = [{ url }, { text: url }];
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
