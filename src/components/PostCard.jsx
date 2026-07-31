import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import Avatar from './Avatar';
import CommentRow from './CommentRow';
import DisclosureStrip from './DisclosureStrip';
import PostImage from './PostImage';
import TickerText from './TickerText';
import TradePill from './TradePill';
import { PortfolioSharePreview } from './ComposeModal';
import { getPersonSync } from '../lib/socialIdentity';
import { formatCount, timeAgo } from '../lib/format';
import { extractTickers, sameTicker } from '../lib/tickers';
import { clampPostBody, createTextMeasurer, fontFromStyle } from '../lib/clampPostBody';

/** Feed cards show at most this many lines; full text is on the open post. */
const FEED_PREVIEW_LINES = 4;
const SEE_MORE_LABEL = 'See more';
const ELLIPSIS = '…';
const MAX_SHRINK_STEPS = 8;

function dropTrailingWord(text) {
  const trimmed = text.replace(/\s+$/u, '');
  const boundary = Math.max(trimmed.lastIndexOf(' '), trimmed.lastIndexOf('\n'));
  if (boundary <= 0) {
    // No word boundary left — trim a few characters so bold mentions can still fit.
    if (trimmed.length <= 1) return null;
    return trimmed.slice(0, -1);
  }
  const next = trimmed.slice(0, boundary).replace(/\s+$/u, '');
  return next && next !== text ? next : null;
}

/**
 * Clamp a post body to `maxLines`, leaving room for the inline "… See more".
 * Canvas metrics use the body font, so bold mentions/titles can still render a
 * hair wider — a post-paint pass shrinks until the height fits.
 */
function useClampedBody(body, { maxLines, enabled }) {
  const containerRef = useRef(null);
  const shrinkStepsRef = useRef(0);
  const [clamped, setClamped] = useState(() => ({ text: body, truncated: false }));

  useLayoutEffect(() => {
    if (!enabled) {
      shrinkStepsRef.current = 0;
      setClamped((prev) =>
        prev.text === body && !prev.truncated ? prev : { text: body, truncated: false }
      );
      return undefined;
    }

    const el = containerRef.current;
    if (!el) return undefined;

    // Height changes also notify the observer; only a width change needs a redo.
    let lastWidth = -1;

    const recompute = () => {
      const width = el.clientWidth;
      if (!(width > 0) || width === lastWidth) return;
      lastWidth = width;

      const style = getComputedStyle(el);
      const measure = createTextMeasurer(fontFromStyle(style));
      const measureStrong = createTextMeasurer(fontFromStyle(style, '600'));
      if (!measure || !measureStrong) {
        setClamped({ text: body, truncated: false });
        return;
      }

      const suffixWidth = measure(`${ELLIPSIS} `) + measureStrong(SEE_MORE_LABEL);
      const next = clampPostBody(body, { maxLines, width, measure, suffixWidth });
      shrinkStepsRef.current = 0;
      setClamped((prev) =>
        prev.text === next.text && prev.truncated === next.truncated ? prev : next
      );
    };

    recompute();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(recompute) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [body, maxLines, enabled]);

  useLayoutEffect(() => {
    if (!enabled || !clamped.truncated) return;
    const el = containerRef.current;
    if (!el || shrinkStepsRef.current >= MAX_SHRINK_STEPS) return;

    const style = getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.55;
    if (!(lineHeight > 0) || el.scrollHeight <= lineHeight * maxLines + 1) return;

    const next = dropTrailingWord(clamped.text);
    if (next == null || next === clamped.text) return;
    shrinkStepsRef.current += 1;
    setClamped({ text: next, truncated: true });
  }, [clamped, enabled, maxLines]);

  return [containerRef, clamped];
}

export default function PostCard({
  post,
  variant = 'feed',
  enrichmentTick = 0,
  onOpenProfile,
  onOpenPost,
  onOpenStock,
  onToggleLike,
}) {
  const isDetail = variant === 'detail';
  void enrichmentTick;
  const person = getPersonSync(post.authorId);
  const isNewsPost = post.via?.source === 'mn_news_ai_summaries';
  const tickers = extractTickers(post.body);
  if (post.trade?.ticker && !tickers.some((t) => sameTicker(t, post.trade.ticker))) {
    tickers.unshift(post.trade.ticker);
  }
  for (const ticker of post.portfolioShare?.tickers ?? []) {
    if (!tickers.some((t) => sameTicker(t, ticker))) tickers.push(ticker);
  }
  const [liked, setLiked] = useState(post.liked ?? false);
  const [likes, setLikes] = useState(post.likes ?? 0);
  // Position popup for bottom disclosure tags only; @mentions open the security page.
  const [tickerPopup, setTickerPopup] = useState(null);
  const commentCount = Math.max(
    Array.isArray(post.comments) ? post.comments.length : 0,
    Number(post.commentCount) || 0
  );
  const bodyText = String(post.body ?? '');
  const [bodyRef, clampedBody] = useClampedBody(bodyText, {
    maxLines: FEED_PREVIEW_LINES,
    enabled: !isDetail,
  });

  useEffect(() => {
    setLiked(post.liked ?? false);
    setLikes(post.likes ?? 0);
  }, [post.id, post.liked, post.likes]);

  useEffect(() => {
    setTickerPopup(null);
  }, [post.id]);

  const openAuthor = () => onOpenProfile?.(post.authorId);
  const openPost = () => onOpenPost?.(post.id);
  const stopBubble = (event) => event.stopPropagation();
  const openTicker = (ticker, source) => setTickerPopup({ ticker, source });
  const closeTicker = () => setTickerPopup(null);

  return (
    <article className="border-b border-pe-border px-4 py-5 md:py-6">
      {post.via && post.via.kind !== 'person' && (
        <p className="mb-2 text-[12px] text-pe-text-muted">
          <span className="font-semibold text-pe-text">{post.via.label}</span>
          <span>
            {' '}
            · {post.via.reason}
          </span>
        </p>
      )}

      <div className="flex gap-3">
        <Avatar
          person={person}
          onClick={(event) => {
            event?.stopPropagation?.();
            openAuthor();
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <div className="flex min-w-0 items-baseline gap-x-1.5">
              <button
                type="button"
                onClick={(event) => {
                  stopBubble(event);
                  openAuthor();
                }}
                className="truncate text-[15px] font-semibold leading-5 text-pe-text hover:underline"
              >
                {person.name}
              </button>
              <span className="shrink-0 text-[12px] leading-5 text-pe-text-muted">
                · {timeAgo(post.createdAt)}
              </span>
            </div>
            <button
              type="button"
              onClick={(event) => {
                stopBubble(event);
                openAuthor();
              }}
              className="mt-0.5 block truncate text-[12px] leading-5 text-pe-text-muted hover:text-pe-text hover:underline"
            >
              @{person.handle}
            </button>
          </div>

          <div
            className={`mt-3 ${!isDetail ? 'cursor-pointer' : ''}`}
            onClick={!isDetail ? openPost : undefined}
            onKeyDown={
              !isDetail
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openPost();
                    }
                  }
                : undefined
            }
            role={!isDetail ? 'button' : undefined}
            tabIndex={!isDetail ? 0 : undefined}
          >
            <TickerText
              containerRef={bodyRef}
              text={isDetail ? bodyText : clampedBody.text}
              authorId={post.authorId}
              boldContentLine={isNewsPost ? 1 : null}
              onOpenStock={onOpenStock}
              trailing={
                !isDetail && clampedBody.truncated ? (
                  <>
                    {`${ELLIPSIS} `}
                    <button
                      type="button"
                      onClick={(event) => {
                        stopBubble(event);
                        openPost();
                      }}
                      className="inline font-semibold text-pe-link hover:underline"
                    >
                      {SEE_MORE_LABEL}
                    </button>
                  </>
                ) : null
              }
            />
          </div>

          {post.trade && (
            <div onClick={stopBubble} onKeyDown={stopBubble} role="presentation">
              <TradePill trade={post.trade} />
            </div>
          )}

          {post.portfolioShare && (
            <div
              className="mt-3.5"
              onClick={stopBubble}
              onKeyDown={stopBubble}
              role="presentation"
            >
              <PortfolioSharePreview share={post.portfolioShare} />
            </div>
          )}

          {post.image && (
            <PostImage
              src={post.image}
              isDetail={isDetail}
              onOpenPost={openPost}
            />
          )}

          {tickers.length > 0 && (
            <div onClick={stopBubble} onKeyDown={stopBubble} role="presentation">
              <DisclosureStrip
                tickers={tickers}
                authorId={post.authorId}
                activeTicker={tickerPopup?.ticker ?? null}
                activeSource={tickerPopup?.source}
                onOpenTicker={openTicker}
                onCloseTicker={closeTicker}
              />
            </div>
          )}

          <div
            className="mt-4 flex items-center gap-6 text-pe-text-secondary"
            onClick={stopBubble}
            onKeyDown={stopBubble}
            role="presentation"
          >
            <button
              type="button"
              onClick={() => {
                if (onToggleLike) {
                  onToggleLike(post.id);
                  return;
                }
                setLiked((v) => !v);
                setLikes((n) => Math.max(0, n + (liked ? -1 : 1)));
              }}
              className={`inline-flex items-center gap-1.5 text-sm transition hover:text-pe-accent ${liked ? 'text-pe-accent' : ''}`}
            >
              <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
              {formatCount(likes)}
            </button>
            <button
              type="button"
              onClick={(event) => {
                stopBubble(event);
                if (!isDetail) openPost();
              }}
              className={`inline-flex items-center gap-1.5 text-sm transition ${
                isDetail ? 'text-pe-text' : 'hover:text-pe-text'
              }`}
              aria-label={isDetail ? `${commentCount} comments` : 'Open post to view comments'}
            >
              <MessageCircle className="h-4 w-4" />
              {commentCount}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-sm transition hover:text-pe-text"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {isDetail && (
        <div className="mt-5 border-t border-pe-border pt-1">
          <p className="py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
            Comments · {commentCount}
          </p>
          {!(post.comments?.length) ? (
            <p className="pb-4 text-sm text-pe-text-secondary">No comments yet.</p>
          ) : (
            post.comments.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                enrichmentTick={enrichmentTick}
                onOpenProfile={onOpenProfile}
                onOpenStock={onOpenStock}
              />
            ))
          )}
        </div>
      )}
    </article>
  );
}
