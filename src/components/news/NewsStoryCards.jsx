import { useState } from 'react';
import { parseNewsSocialContent } from '../../lib/newsPostBody';
import { formatPct, pnlClass, timeAgo } from '../../lib/format';
import {
  LOGO_VARIANT_DETAIL,
  assetLogoInitial,
  resolveAssetLogoUrl,
} from '../../lib/assetLogo';

function formatAllocation(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toFixed(1)}%`;
}

function StoryLogo({ story, className = '' }) {
  const src = resolveAssetLogoUrl({
    logoIconUrl: story.logoIconUrl,
    assetType: story.assetType || 'stock',
    assetKey: story.symbol,
    variant: LOGO_VARIANT_DETAIL,
  });
  const [failed, setFailed] = useState(false);
  const initial = assetLogoInitial(story.symbol || story.headline);

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#f2f2f3] ${className}`}
      aria-hidden
    >
      {src && !failed && story.symbol ? (
        <img
          src={src}
          alt=""
          className="max-h-[72%] max-w-[72%] object-contain"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-[18px] font-semibold text-pe-text-secondary">{initial}</span>
      )}
    </span>
  );
}

export function newsPostToStory(
  post,
  {
    companyName = null,
    allocationPct = null,
    changePct = null,
    logoIconUrl = null,
    assetType = null,
    showMetrics = false,
  } = {}
) {
  const parsed = parseNewsSocialContent(post);
  const headline =
    parsed.title ||
    post.title ||
    String(parsed.text || post.body || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 110);
  const summary = String(parsed.text || '')
    .replace(/^[•\-*]\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  const symbol = parsed.symbol;
  return {
    id: post.id,
    headline: headline || 'Market update',
    summary,
    source: 'PocketEdge News',
    publishedAt: post.createdAt,
    symbol,
    assetType: assetType || parsed.assetType || 'stock',
    logoIconUrl,
    companyName: companyName || symbol,
    allocationPct: showMetrics ? allocationPct : null,
    changePct: showMetrics ? changePct : null,
    showMetrics,
  };
}

export function NewsStoryCard({ story, variant = 'featured', onOpen }) {
  const time = story.publishedAt ? timeAgo(story.publishedAt) : '';
  const open = () => onOpen?.(story.id);
  const thumbClass =
    variant === 'compact'
      ? 'h-[4.5rem] w-24 sm:w-28'
      : 'h-[4.5rem] w-24 sm:h-[5.5rem] sm:w-[8.5rem]';

  if (variant === 'compact') {
    return (
      <button type="button" onClick={open} className="flex w-full gap-3 py-4 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold leading-snug text-pe-text">
            {story.headline}
          </span>
          <span className="mt-1.5 block text-[12px] text-pe-text-muted">
            {story.source}
            {time ? ` · ${time}` : ''}
          </span>
        </span>
        <StoryLogo key={story.symbol || story.id} story={story} className={thumbClass} />
      </button>
    );
  }

  return (
    <button type="button" onClick={open} className="block w-full py-5 text-left">
      <div className="flex gap-4">
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold leading-snug text-pe-text">
            {story.headline}
          </span>
          <span className="mt-1.5 block text-[12px] text-pe-text-muted">
            {story.source}
            {time ? ` · ${time}` : ''}
          </span>
          {story.summary ? (
            <span className="mt-2 block text-[14px] leading-relaxed text-pe-text-secondary">
              {story.summary}
            </span>
          ) : null}
        </span>
        <StoryLogo key={story.symbol || story.id} story={story} className={thumbClass} />
      </div>
      {story.showMetrics ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-pe-accent/10 px-3.5 py-2.5">
            <span className="block text-[11px] font-medium leading-4 text-pe-text-muted">
              Your Allocation
            </span>
            <span className="mt-0.5 block text-[14px] font-semibold tabular-nums text-pe-text">
              {formatAllocation(story.allocationPct)}
            </span>
          </div>
          <div className="rounded-lg bg-pe-accent/10 px-3.5 py-2.5">
            <span className="block text-[11px] font-medium leading-4 text-pe-text-muted">
              Today's Change in stock price
            </span>
            <span
              className={`mt-0.5 block text-[14px] font-semibold tabular-nums ${pnlClass(Number(story.changePct))}`}
            >
              {story.changePct == null || Number.isNaN(Number(story.changePct))
                ? '—'
                : formatPct(story.changePct)}
            </span>
          </div>
        </div>
      ) : null}
    </button>
  );
}
