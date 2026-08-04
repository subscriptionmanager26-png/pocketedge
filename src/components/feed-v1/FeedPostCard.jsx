import { BadgeCheck, Heart, MessageCircle, Share2 } from 'lucide-react';

function formatPct(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return null;
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function Sparkline({ up = true }) {
  const stroke = up ? 'var(--fv-positive)' : 'var(--fv-negative)';
  return (
    <svg width="56" height="24" viewBox="0 0 64 28" fill="none" aria-hidden className="hidden shrink-0 sm:block">
      <path
        d={
          up
            ? 'M1 22 C10 20, 14 18, 20 14 S32 6, 40 10 S52 18, 63 4'
            : 'M1 6 C12 8, 16 14, 24 16 S40 12, 48 18 S56 24, 63 22'
        }
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function StockPill({ chip }) {
  const pct = formatPct(chip.changePct);
  const neg = Number(chip.changePct) < 0;
  return (
    <span className={`fv-stock-pill ${neg ? 'is-neg' : ''}`}>
      <span>${chip.symbol}</span>
      {pct ? <span className="tabular-nums">{pct}</span> : null}
    </span>
  );
}

/**
 * Mobile-first post card: one-line identity, tight vertical rhythm,
 * full-bleed-feeling content, quiet actions.
 */
export default function FeedPostCard({ post, followingIds, onFollow }) {
  const author = post.author;
  const isNews = post.kind === 'news';
  const verified = Boolean(author?.verified || author?.rating != null);
  const authorId = author?.id;
  const isFollowing = Boolean(authorId && followingIds?.has(authorId));
  const showFollow = Boolean(onFollow) && !isNews && authorId && !isFollowing;
  const tickers = post.tickers ?? [];
  const visibleTickers = tickers.slice(0, 2);
  const extraTickers = Math.max(0, tickers.length - 2);

  return (
    <article className="fv-card fv-post-card mx-3 mb-4 rounded-[20px] px-4 pt-4 pb-1.5 shadow-[var(--fv-shadow)] md:mx-6 md:mb-5 md:px-6 md:pt-6 md:pb-2">
      {/* Identity — single visual row on mobile */}
      <header className="flex items-center gap-2.5 md:gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--fv-accent)]/12 text-[12px] font-semibold text-[var(--fv-accent)] md:h-11 md:w-11 md:text-[15px]">
          {author?.avatar || (author?.name || '?').slice(0, 1)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1">
            <h3 className="truncate text-[14px] font-semibold leading-tight text-[var(--fv-text)] md:text-[15px]">
              {author?.name}
            </h3>
            {verified && !isNews ? (
              <BadgeCheck
                className="h-3.5 w-3.5 shrink-0 text-[#3b82f6] md:h-4 md:w-4"
                strokeWidth={2.25}
                aria-label="Verified"
              />
            ) : null}
            {isNews ? (
              <span className="ml-0.5 shrink-0 rounded-full border border-[var(--fv-accent)]/70 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.04em] text-[var(--fv-accent)] md:px-2 md:text-[11px]">
                News
              </span>
            ) : null}
          </div>
          <p className="truncate text-[12px] leading-tight text-[var(--fv-text-muted)]">
            <span className="md:inline">@{author?.handle}</span>
            <span className="mx-1 opacity-50">·</span>
            <span>{post.createdAt}</span>
          </p>
        </div>

        {showFollow ? (
          <button
            type="button"
            onClick={() => onFollow?.(authorId)}
            className="shrink-0 rounded-full px-2.5 py-1 text-[13px] font-semibold text-[var(--fv-accent)] transition active:bg-[var(--fv-accent)]/10 md:bg-[var(--fv-accent)] md:px-3.5 md:py-1.5 md:text-[13px] md:text-white md:hover:bg-[var(--fv-accent-pressed)]"
          >
            Follow
          </button>
        ) : null}
      </header>

      {/* Body — full width under header, tight to identity */}
      <div className="mt-2.5 md:mt-3.5">
        {post.title ? (
          <h2 className="mb-1 text-[15px] font-semibold leading-snug tracking-tight text-[var(--fv-text)] md:mb-1.5 md:text-[18px]">
            {post.title}
          </h2>
        ) : null}
        <p className="text-[15px] font-normal leading-[1.45] text-[var(--fv-text)] md:text-[16px] md:leading-[1.6] line-clamp-4">
          {post.body}
        </p>
        {post.body?.length > 140 ? (
          <button
            type="button"
            className="mt-0.5 text-[13px] font-semibold text-[var(--fv-accent)] md:mt-1 md:text-[14px]"
          >
            Show more
          </button>
        ) : null}
      </div>

      {/* Media */}
      {post.linkPreview ? (
        <div className="mt-2.5 overflow-hidden md:mt-4 md:rounded-[var(--fv-radius-image)] md:shadow-[var(--fv-shadow)]">
          {post.linkPreview.image ? (
            <img
              src={post.linkPreview.image}
              alt=""
              className="max-h-[160px] w-full object-cover md:max-h-[200px]"
              loading="lazy"
            />
          ) : null}
          <div className="border-y border-[var(--fv-border)] bg-white px-4 py-2.5 md:border-0 md:px-3.5 md:py-3">
            <p className="text-[11px] text-[var(--fv-text-muted)] md:text-[12px]">
              {post.linkPreview.source}
            </p>
            <p className="mt-0.5 text-[13px] font-semibold leading-snug text-[var(--fv-text)] md:text-[15px]">
              {post.linkPreview.title}
            </p>
          </div>
        </div>
      ) : post.image ? (
        <div className="mt-2.5 overflow-hidden md:mt-4 md:rounded-[var(--fv-radius-image)] md:shadow-[var(--fv-shadow)]">
          <img
            src={post.image}
            alt=""
            className="max-h-[160px] w-full object-cover md:max-h-[220px]"
            loading="lazy"
          />
        </div>
      ) : null}

      {/* Index strip — compact on mobile, no sparklines */}
      {post.marketCards?.length ? (
        <div className="mt-2.5 flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] md:mt-4 md:grid md:grid-cols-3 md:gap-2 md:overflow-visible [&::-webkit-scrollbar]:hidden">
          {post.marketCards.map((card) => {
            const up = Number(card.changePct) >= 0;
            return (
              <div
                key={card.name}
                className="flex min-w-[108px] flex-1 items-center justify-between gap-2 rounded-xl bg-[#1a1a1a] px-2.5 py-2 text-white md:min-w-0 md:flex-col md:items-stretch md:rounded-[16px] md:px-2.5 md:py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-medium text-white/65">{card.name}</p>
                  <p className="mt-0.5 text-[13px] font-semibold tabular-nums">{card.value}</p>
                </div>
                <div className="flex items-center gap-1.5 md:mt-1 md:w-full md:justify-between">
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${
                      up ? 'text-[var(--fv-positive)]' : 'text-[var(--fv-negative)]'
                    }`}
                  >
                    {formatPct(card.changePct)}
                  </span>
                  <Sparkline up={up} />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Tickers — max 2 on mobile */}
      {visibleTickers.length ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 md:mt-4 md:gap-2">
          {visibleTickers.map((chip) => (
            <StockPill key={`${post.id}-${chip.symbol}`} chip={chip} />
          ))}
          {extraTickers > 0 ? (
            <span className="text-[12px] font-medium text-[var(--fv-text-muted)]">
              +{extraTickers}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Actions — flush to card bottom, no divider */}
      {/* Actions — 3 equal columns; icon+label left-aligned in each (Like lines up with name) */}
      <div className="mt-2 flex items-center gap-2.5 md:gap-3">
        <span className="invisible h-8 w-8 shrink-0 md:h-11 md:w-11" aria-hidden />
        <div className="grid min-w-0 flex-1 grid-cols-3">
          <button
            type="button"
            className="inline-flex h-8 items-center justify-start gap-1.5 rounded-lg text-[13px] font-medium text-[var(--fv-text-secondary)] active:bg-black/[0.04]"
          >
            <Heart className="h-[18px] w-[18px]" strokeWidth={2} />
            <span className="tabular-nums">{post.likes}</span>
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center justify-start gap-1.5 rounded-lg text-[13px] font-medium text-[var(--fv-text-secondary)] active:bg-black/[0.04]"
          >
            <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2} />
            <span className="tabular-nums">{post.comments}</span>
          </button>
          <button
            type="button"
            aria-label="Share"
            className="inline-flex h-8 items-center justify-start gap-1.5 rounded-lg text-[13px] font-medium text-[var(--fv-text-secondary)] active:bg-black/[0.04]"
          >
            <Share2 className="h-[18px] w-[18px]" strokeWidth={2} />
            <span className="hidden md:inline">Share</span>
          </button>
        </div>
      </div>

      {/* Mobile list separator instead of card chrome */}
      <div className="border-b border-[var(--fv-border)] md:hidden" aria-hidden />
    </article>
  );
}
