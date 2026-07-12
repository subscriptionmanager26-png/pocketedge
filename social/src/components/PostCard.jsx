import { useEffect, useState } from 'react';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import Avatar from './Avatar';
import CommentRow from './CommentRow';
import DisclosureStrip from './DisclosureStrip';
import TickerText from './TickerText';
import TradePill from './TradePill';
import { PortfolioSharePreview } from './ComposeModal';
import { getPersonSync } from '../lib/socialIdentity';
import { formatCount, timeAgo } from '../lib/format';
import { extractTickers } from '../lib/tickers';

/** Feed cards truncate long bodies; full text + comments only on the open post. */
const FEED_PREVIEW_CHARS = 200;

function previewBody(body) {
  const text = body.replace(/\n+/g, ' ').trim();
  if (text.length <= FEED_PREVIEW_CHARS) {
    return { text: body, truncated: false };
  }
  const slice = text.slice(0, FEED_PREVIEW_CHARS);
  const cut = slice.lastIndexOf(' ');
  return {
    text: `${slice.slice(0, cut > 120 ? cut : FEED_PREVIEW_CHARS).trimEnd()}…`,
    truncated: true,
  };
}

export default function PostCard({
  post,
  variant = 'feed',
  onOpenProfile,
  onOpenPost,
  onToggleLike,
}) {
  const isDetail = variant === 'detail';
  const person = getPersonSync(post.authorId);
  const displayBody = isDetail ? post.body : previewBody(post.body).text;
  const truncated = !isDetail && previewBody(post.body).truncated;
  const tickers = extractTickers(post.body);
  if (post.trade?.ticker && !tickers.includes(post.trade.ticker)) {
    tickers.unshift(post.trade.ticker);
  }
  for (const ticker of post.portfolioShare?.tickers ?? []) {
    if (!tickers.includes(ticker)) tickers.push(ticker);
  }
  const [liked, setLiked] = useState(post.liked ?? false);
  const [likes, setLikes] = useState(post.likes ?? 0);
  const [activeTicker, setActiveTicker] = useState(null);
  const commentCount = post.comments?.length ?? post.commentCount ?? 0;

  useEffect(() => {
    setLiked(post.liked ?? false);
    setLikes(post.likes ?? 0);
  }, [post.id, post.liked, post.likes]);

  const openAuthor = () => onOpenProfile?.(post.authorId);
  const openPost = () => onOpenPost?.(post.id);
  const stopBubble = (event) => event.stopPropagation();

  return (
    <article className="border-b border-pe-border px-4 py-5 md:py-6">
      {post.via && post.via.kind !== 'person' && (
        <p className="mb-2 text-[13px] text-pe-text-muted">
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
              <span className="shrink-0 text-[13px] leading-5 text-pe-text-muted">
                · {timeAgo(post.createdAt)}
              </span>
            </div>
            <button
              type="button"
              onClick={(event) => {
                stopBubble(event);
                openAuthor();
              }}
              className="mt-0.5 block truncate text-[13px] leading-5 text-pe-text-muted hover:text-pe-text hover:underline"
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
              text={displayBody}
              authorId={post.authorId}
              activeTicker={activeTicker}
              onActiveTickerChange={setActiveTicker}
            />
            {truncated && (
              <span className="mt-1 inline-block text-[14px] font-semibold text-pe-link">
                See more
              </span>
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

          {post.image && (
            <button
              type="button"
              onClick={(event) => {
                stopBubble(event);
                if (!isDetail) openPost();
              }}
              className={`mt-3.5 block w-full overflow-hidden rounded-lg text-left ${isDetail ? '' : 'cursor-pointer'}`}
            >
              <img
                src={post.image}
                alt=""
                className="aspect-[16/10] w-full object-cover"
                loading="lazy"
              />
            </button>
          )}

          {tickers.length > 0 && (
            <div onClick={stopBubble} onKeyDown={stopBubble} role="presentation">
              <DisclosureStrip
                tickers={tickers}
                authorId={post.authorId}
                activeTicker={activeTicker}
                onActiveTickerChange={setActiveTicker}
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
          <p className="py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
            Comments · {commentCount}
          </p>
          {commentCount === 0 ? (
            <p className="pb-4 text-sm text-pe-text-secondary">No comments yet.</p>
          ) : (
            post.comments.map((c) => (
              <CommentRow key={c.id} comment={c} onOpenProfile={onOpenProfile} />
            ))
          )}
        </div>
      )}
    </article>
  );
}
