import { useEffect, useState } from 'react';
import Avatar from './Avatar';
import NewsList from './NewsList';
import { getPersonSync, resolvePeople } from '../lib/socialIdentity';
import {
  PREVIEW_DISCUSSIONS,
  PREVIEW_HOLDERS,
  PREVIEW_NEWS,
  PREVIEW_REVIEWS,
} from '../data/blurPlaceholders';

export const INVESTMENT_TABS = [
  { id: 'insights', label: 'Insights' },
  { id: 'discussions', label: 'Posts' },
  { id: 'holders', label: 'Holders' },
  { id: 'news', label: 'News' },
];

/** Stocks only — Corporate Actions sits after News. */
export const STOCK_INVESTMENT_TABS = [
  ...INVESTMENT_TABS,
  { id: 'corporate_actions', label: 'Corporate Actions' },
];

export const REVIEW_LOCK = {
  title: 'Unlock community signals',
  detail: 'Community is built on sharing. Share a signal on a stock/ETF/MF to unlock community benefits.',
  ctaLabel: 'Share a signal',
};

export const TRACK_STOCK_LOCK = {
  title: 'Unlock holder disclosures',
  detail: 'Add this stock to your holdings or watchlist to view who else owns it.',
};

export const TRACK_STOCK_NEWS_LOCK = {
  title: 'Unlock stock news',
  detail: 'Add this stock to your holdings or watchlist to read curated updates.',
};

export const TRACK_FUND_LOCK = {
  title: 'Unlock fund community data',
  detail: 'Add this fund to your holdings or watchlist to view holders, news, and posts.',
};

export const TRACK_MARKET_LOCK = {
  title: 'Unlock market community data',
  detail: 'Share one review during signup to read posts, holders, and news across market assets.',
};

export const TRACK_MARKET_NEWS_LOCK = {
  title: 'Unlock market news',
  detail: 'Complete onboarding to read curated updates for this market asset.',
};

/** Locked: message banner first, then shared preview content blurred underneath. */
export function BlurredSection({ locked, lock, onCta, preview, children }) {
  if (!locked) return children;

  const ctaLabel = lock.ctaLabel;

  return (
    <div className="overflow-hidden">
      <div className="border-b border-pe-accent-border bg-pe-accent-wash px-4 py-4">
        <div className="mx-auto max-w-sm text-center">
          <p className="text-[15px] font-semibold text-pe-text">{lock.title}</p>
          <p className="mt-2 text-sm text-pe-text-secondary">{lock.detail}</p>
          {ctaLabel && onCta && (
            <button
              type="button"
              onClick={onCta}
              className="mt-3 rounded-md bg-pe-accent px-4 py-2 text-sm font-bold text-white hover:bg-pe-accent-pressed"
            >
              {ctaLabel}
            </button>
          )}
        </div>
      </div>
      <div className="relative min-h-[18rem] overflow-hidden">
        <div aria-hidden className="pointer-events-none select-none blur-[4px] opacity-80">
          {preview}
        </div>
        <div className="absolute inset-0 bg-pe-canvas/36 backdrop-blur-sm" />
      </div>
    </div>
  );
}

export function ReviewsBlurPreview({ onOpenProfile }) {
  void onOpenProfile;
  return (
    <div className="divide-y divide-pe-border px-4 py-2">
      {PREVIEW_REVIEWS.map((review) => (
        <div key={review.id} className="py-4">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-full bg-pe-surface" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="h-3 w-28 rounded bg-pe-surface" />
              <div className="mt-1.5 h-2.5 w-20 rounded bg-pe-surface/80" />
            </div>
          </div>
          <p className="mt-3 line-clamp-3 text-[15px] leading-relaxed text-pe-text-secondary">
            {review.body}
          </p>
        </div>
      ))}
    </div>
  );
}

export function DiscussionsBlurPreview({ onOpenProfile }) {
  void onOpenProfile;
  return (
    <div className="divide-y divide-pe-border px-4 py-2">
      {PREVIEW_DISCUSSIONS.map((post) => (
        <div key={post.id} className="py-4">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-full bg-pe-surface" aria-hidden />
            <div className="h-3 w-24 rounded bg-pe-surface" />
          </div>
          <p className="mt-3 line-clamp-3 text-[15px] leading-relaxed text-pe-text-secondary">
            {post.body}
          </p>
        </div>
      ))}
    </div>
  );
}

export function HoldersBlurPreview({ onOpenProfile }) {
  void onOpenProfile;
  return (
    <div className="divide-y divide-pe-border">
      {PREVIEW_HOLDERS.map((row, index) => (
        <div key={`blur-holder-${index}`} className="flex items-center gap-3 px-4 py-3.5">
          <span className="h-9 w-9 rounded-full bg-pe-surface" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="h-3.5 w-32 rounded bg-pe-surface" />
            <div className="mt-1.5 h-2.5 w-24 rounded bg-pe-surface/80" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NewsBlurPreview() {
  return <NewsList items={PREVIEW_NEWS} />;
}

/** Discussions are posts — same row on stock and fund pages. */
export function DiscussionPostRow({ post, onOpenProfile, enrichmentTick = 0 }) {
  void enrichmentTick;
  const author = getPersonSync(post.authorId) ?? {
    id: post.authorId,
    name: 'Member',
    handle: 'member',
    avatar: 'M',
  };
  return (
    <div className="border-b border-pe-border py-4">
      <button
        type="button"
        onClick={() => onOpenProfile?.(post.authorId)}
        className="flex items-center gap-2 text-left"
      >
        <Avatar person={author} size="sm" />
        <div>
          <p className="text-sm font-semibold text-pe-text">{author.name}</p>
          <p className="text-xs text-pe-text-muted">@{author.handle}</p>
        </div>
      </button>
      <p className="mt-2 line-clamp-4 text-[15px] leading-relaxed text-pe-text">{post.body}</p>
      <p className="mt-2 text-xs font-semibold text-pe-accent">
        {(post.comments ?? []).length} {(post.comments ?? []).length === 1 ? 'reply' : 'replies'}
        {(post.likes ?? 0) > 0 && ` · ${post.likes} likes`}
      </p>
    </div>
  );
}

export function DiscussionsList({ posts, onOpenProfile, emptyMessage }) {
  const [enrichTick, setEnrichTick] = useState(0);

  useEffect(() => {
    const ids = [...new Set((posts ?? []).map((p) => p?.authorId).filter(Boolean).map(String))];
    if (!ids.length) return undefined;
    let cancelled = false;
    resolvePeople(ids)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setEnrichTick((n) => n + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [posts]);

  if (!posts.length) {
    return (
      <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">{emptyMessage}</p>
    );
  }
  return (
    <div className="px-4 py-2">
      {posts.map((post) => (
        <DiscussionPostRow
          key={post.id}
          post={post}
          onOpenProfile={onOpenProfile}
          enrichmentTick={enrichTick}
        />
      ))}
    </div>
  );
}
