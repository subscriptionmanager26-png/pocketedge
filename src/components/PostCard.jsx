import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Heart, Link2, MessageCircle, Share2 } from 'lucide-react';
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
import NewsLogoImage from './NewsLogoImage';
import AssetLogo from './AssetLogo';
import {
  isNewsSocialPost,
  parseNewsSocialContent,
  reshapeNewsFeedBody,
} from '../lib/newsPostBody';
import { copyNewsPostLink, shareNewsPost } from '../lib/shareNewsPost';

/** Feed cards show at most this many lines; full text is on the open post. */
const FEED_PREVIEW_LINES = 4;
const NEWS_PREVIEW_LINES = 5;
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
  companyName: companyNameProp = null,
  onOpenProfile,
  onOpenPost,
  onOpenStock,
  onToggleLike,
}) {
  const isDetail = variant === 'detail';
  const isNewsLayout = variant === 'news' || (isDetail && isNewsSocialPost(post));
  void enrichmentTick;
  const person = getPersonSync(post.authorId);
  const isNewsPost = isNewsSocialPost(post);
  const newsParts = isNewsLayout ? parseNewsSocialContent(post) : null;
  const rawBody = String(post.body ?? '');
  const bodyText = isNewsPost && !isNewsLayout ? reshapeNewsFeedBody(rawBody) : rawBody;
  const newsText = newsParts?.text || '';
  const clampSource = isNewsLayout ? newsText : bodyText;
  const tickers = extractTickers(isNewsLayout ? `${newsParts?.title ?? ''}\n${newsText}` : bodyText);
  if (newsParts?.symbol && !tickers.some((t) => sameTicker(t, newsParts.symbol))) {
    tickers.unshift(newsParts.symbol);
  }
  if (post.trade?.ticker && !tickers.some((t) => sameTicker(t, post.trade.ticker))) {
    tickers.unshift(post.trade.ticker);
  }
  for (const ticker of post.portfolioShare?.tickers ?? []) {
    if (!tickers.some((t) => sameTicker(t, ticker))) tickers.push(ticker);
  }
  const companyName =
    companyNameProp ||
    post.companyName ||
    (newsParts?.symbol ? newsParts.symbol : null);
  const [liked, setLiked] = useState(post.liked ?? false);
  const [likes, setLikes] = useState(post.likes ?? 0);
  const [tickerPopup, setTickerPopup] = useState(null);
  const commentCount = Math.max(
    Array.isArray(post.comments) ? post.comments.length : 0,
    Number(post.commentCount) || 0
  );
  const [bodyRef, clampedBody] = useClampedBody(clampSource, {
    maxLines: isNewsLayout ? NEWS_PREVIEW_LINES : FEED_PREVIEW_LINES,
    enabled: !isDetail && Boolean(clampSource),
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

  const [shareOpen, setShareOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const shareBtnRef = useRef(null);

  useEffect(() => {
    if (!linkCopied) return undefined;
    const timer = setTimeout(() => setLinkCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [linkCopied]);

  const handleShareVia = async (event) => {
    stopBubble(event);
    setShareOpen(false);
    try {
      const result = await shareNewsPost({ post, companyName });
      if (result === 'copied') setLinkCopied(true);
    } catch (err) {
      console.error('News share failed', err);
    }
  };

  const handleCopyLink = async (event) => {
    stopBubble(event);
    try {
      await copyNewsPostLink(post.id);
      setLinkCopied(true);
      setShareOpen(false);
    } catch (err) {
      console.error('Copy news link failed', err);
    }
  };

  return (
    <article className="fv-card fv-post-card mx-3 mb-4 rounded-[20px] bg-white px-4 pt-5 pb-2 shadow-[var(--fv-shadow)] md:mx-6 md:mb-5 md:px-6 md:pt-6 md:pb-2.5 md:transition md:duration-150 md:hover:shadow-[var(--fv-shadow-hover)]">
      {post.via && post.via.kind !== 'person' && !isNewsLayout && (
        <p className="mb-2 text-[12px] text-pe-text-muted">
          <span className="font-semibold text-pe-text">{post.via.label}</span>
          <span>
            {' '}
            · {post.via.reason}
          </span>
        </p>
      )}

      <div className="flex gap-3">
        {isNewsLayout ? (
          newsParts?.symbol ? (
            <button
              type="button"
              onClick={(event) => {
                event?.stopPropagation?.();
                onOpenStock?.(newsParts.symbol);
              }}
              className="shrink-0 self-start rounded-full"
              aria-label={companyName ? `Open ${companyName}` : `Open ${newsParts.symbol}`}
            >
              <AssetLogo
                assetType={newsParts.assetType}
                assetKey={newsParts.symbol}
                name={companyName || newsParts.symbol}
                size="sm"
              />
            </button>
          ) : null
        ) : (
          <Avatar
            person={person}
            onClick={(event) => {
              event?.stopPropagation?.();
              openAuthor();
            }}
          />
        )}
        <div className="min-w-0 flex-1">
          {isNewsLayout ? (
            <div className="min-w-0">
              <button
                type="button"
                onClick={(event) => {
                  stopBubble(event);
                  if (newsParts?.symbol) onOpenStock?.(newsParts.symbol);
                }}
                className="block truncate text-[15px] font-semibold leading-5 text-pe-text hover:underline"
              >
                {companyName}
              </button>
              {newsParts?.symbol ? (
                <div className="mt-0.5 flex min-w-0 items-baseline gap-x-1.5">
                  <button
                    type="button"
                    onClick={(event) => {
                      stopBubble(event);
                      onOpenStock?.(newsParts.symbol);
                    }}
                    className="truncate text-[12px] leading-5 text-pe-text-muted hover:text-pe-text hover:underline"
                  >
                    @{newsParts.symbol}
                  </button>
                  <span className="shrink-0 text-[12px] leading-5 text-pe-text-muted">
                    · {timeAgo(post.createdAt)}
                  </span>
                </div>
              ) : (
                <p className="mt-0.5 text-[12px] leading-5 text-pe-text-muted">
                  {timeAgo(post.createdAt)}
                </p>
              )}
            </div>
          ) : (
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
          )}

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
            {isNewsLayout ? (
              <>
                {newsParts?.title ? (
                  <h3 className="text-[16px] font-semibold leading-snug tracking-tight text-pe-text md:text-[17px]">
                    {newsParts.title}
                  </h3>
                ) : null}
                {newsText ? (
                  <div className={newsParts?.title ? 'mt-2' : ''}>
                    <TickerText
                      containerRef={bodyRef}
                      text={isDetail ? newsText : clampedBody.text}
                      authorId={post.authorId}
                      onOpenStock={onOpenStock}
                      className="text-[14px] leading-relaxed text-pe-text-secondary"
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
                              className="inline font-semibold text-pe-accent hover:underline"
                            >
                              {SEE_MORE_LABEL}
                            </button>
                          </>
                        ) : null
                      }
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <TickerText
                containerRef={bodyRef}
                text={isDetail ? bodyText : clampedBody.text}
                authorId={post.authorId}
                boldContentLine={isNewsPost ? 0 : null}
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
                        className="inline font-semibold text-pe-accent hover:underline"
                      >
                        {SEE_MORE_LABEL}
                      </button>
                    </>
                  ) : null
                }
              />
            )}
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

          {isNewsLayout && newsParts?.symbol ? (
            <div onClick={stopBubble} onKeyDown={stopBubble} role="presentation">
              <NewsLogoImage
                symbol={newsParts.symbol}
                companyName={companyName}
                assetType={newsParts.assetType}
                isDetail={isDetail}
                onOpenPost={openPost}
                onOpenStock={onOpenStock}
              />
            </div>
          ) : null}

          {post.image && !isNewsLayout ? (
            <PostImage
              src={post.image}
              isDetail={isDetail}
              onOpenPost={openPost}
            />
          ) : null}

          {tickers.length > 0 && !isNewsLayout ? (
            <div
              className="mt-3"
              onClick={stopBubble}
              onKeyDown={stopBubble}
              role="presentation"
            >
              <DisclosureStrip
                tickers={tickers}
                authorId={post.authorId}
                activeTicker={tickerPopup?.ticker ?? null}
                activeSource={tickerPopup?.source}
                onOpenTicker={openTicker}
                onCloseTicker={closeTicker}
              />
            </div>
          ) : null}

          <div
            className={`mt-2 grid w-full text-pe-text-secondary ${
              isNewsLayout ? 'grid-cols-2' : 'grid-cols-3'
            }`}
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
              className={`inline-flex h-8 items-center justify-start gap-1.5 rounded-lg text-[13px] font-medium transition hover:bg-black/[0.04] ${liked ? 'text-pe-accent' : ''}`}
            >
              <Heart className={`h-[18px] w-[18px] ${liked ? 'fill-current' : ''}`} strokeWidth={2} />
              {formatCount(likes)}
            </button>
            {isNewsLayout ? null : (
              <button
                type="button"
                onClick={(event) => {
                  stopBubble(event);
                  if (!isDetail) openPost();
                }}
                className={`inline-flex h-8 items-center justify-start gap-1.5 rounded-lg text-[13px] font-medium transition hover:bg-black/[0.04] ${
                  isDetail ? 'text-pe-text' : ''
                }`}
                aria-label={isDetail ? `${commentCount} comments` : 'Open post to view comments'}
              >
                <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2} />
                {formatCount(commentCount)}
              </button>
            )}
            <button
              ref={isNewsLayout ? shareBtnRef : undefined}
              type="button"
              aria-label="Share"
              aria-expanded={isNewsLayout ? shareOpen : undefined}
              onClick={(event) => {
                stopBubble(event);
                if (!isNewsLayout) return;
                setShareOpen((v) => !v);
              }}
              className={`inline-flex h-8 items-center justify-start gap-1.5 rounded-lg text-[13px] font-medium transition hover:bg-black/[0.04] ${
                linkCopied ? 'text-pe-accent' : ''
              }`}
            >
              {linkCopied ? (
                <>
                  <Check className="h-[18px] w-[18px]" strokeWidth={2} />
                  Copied
                </>
              ) : (
                <Share2 className="h-[18px] w-[18px]" strokeWidth={2} />
              )}
            </button>
          </div>
        </div>
      </div>

      {isNewsLayout && shareOpen ? (
        <NewsShareMenu
          anchorRef={shareBtnRef}
          onClose={() => setShareOpen(false)}
          onShareVia={handleShareVia}
          onCopyLink={handleCopyLink}
        />
      ) : null}

      {isDetail && !isNewsLayout && post.comments?.length ? (
        <div className="mt-3">
          {post.comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              enrichmentTick={enrichmentTick}
              onOpenProfile={onOpenProfile}
              onOpenStock={onOpenStock}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function NewsShareMenu({ anchorRef, onClose, onShareVia, onCopyLink }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);
  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    const sync = () => {
      const el = anchorRef?.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = 188;
      const left = Math.min(
        Math.max(12, rect.left),
        window.innerWidth - width - 12
      );
      const below = rect.bottom + 6;
      const estimatedHeight = canNativeShare ? 96 : 52;
      const top =
        below + estimatedHeight > window.innerHeight - 12
          ? Math.max(12, rect.top - estimatedHeight - 6)
          : below;
      setPos({ top, left, width });
    };
    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [anchorRef, canNativeShare]);

  useEffect(() => {
    const onDown = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      if (anchorRef?.current?.contains(event.target)) return;
      onClose?.();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [anchorRef, onClose]);

  if (!pos || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Share news"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
      className="fixed z-[90] overflow-hidden rounded-xl border border-pe-border bg-pe-canvas py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
    >
      {canNativeShare ? (
        <button
          type="button"
          role="menuitem"
          onClick={onShareVia}
          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium text-pe-text hover:bg-pe-surface"
        >
          <Share2 className="h-4 w-4 text-pe-text-muted" strokeWidth={2} />
          Share via…
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        onClick={onCopyLink}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium text-pe-text hover:bg-pe-surface"
      >
        <Link2 className="h-4 w-4 text-pe-text-muted" strokeWidth={2} />
        Copy link
      </button>
    </div>,
    document.body
  );
}

