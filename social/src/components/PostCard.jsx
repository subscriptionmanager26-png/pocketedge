import { useState } from 'react';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import Avatar from './Avatar';
import CommentRow from './CommentRow';
import DisclosureStrip from './DisclosureStrip';
import TickerText from './TickerText';
import TradePill from './TradePill';
import { getPerson } from '../data/mockData';
import { formatCount, formatPct, timeAgo } from '../lib/format';
import { extractTickers } from '../lib/tickers';

export default function PostCard({ post }) {
  const person = getPerson(post.authorId);
  const tickers = extractTickers(post.body);
  if (post.trade?.ticker && !tickers.includes(post.trade.ticker)) {
    tickers.unshift(post.trade.ticker);
  }
  const [liked, setLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const likes = post.likes + (liked ? 1 : 0);

  return (
    <article className="px-4 py-5 md:px-6">
      <div className="flex gap-3.5">
        <Avatar person={person} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[15px] font-semibold text-pe-text">{person.name}</span>
            <span className="text-sm text-pe-text-secondary">@{person.handle}</span>
            <span className="text-pe-text-muted">·</span>
            <span className="text-sm text-pe-text-muted">{timeAgo(post.createdAt)}</span>
          </div>

          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-pe-text-secondary">
            <span className="font-medium text-pe-positive">
              XIRR {formatPct(person.xirr, { signed: false })}
            </span>
            <span className="text-pe-text-muted">·</span>
            <span>{formatCount(person.followers)} followers</span>
          </div>

          {post.via && (
            <p className="mt-2.5 inline-flex max-w-full items-center rounded-md bg-pe-surface px-2 py-1 text-xs text-pe-text-secondary">
              via <span className="mx-1 font-semibold text-pe-text">{post.via.label}</span>
              <span className="text-pe-text-muted">· {post.via.reason}</span>
            </p>
          )}

          <div className="mt-3">
            <TickerText text={post.body} authorId={post.authorId} />
          </div>

          {post.trade && <TradePill trade={post.trade} />}

          {post.image && (
            <div className="mt-3.5 overflow-hidden rounded-2xl border border-pe-border">
              <img
                src={post.image}
                alt=""
                className="aspect-[16/10] w-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          {tickers.length > 0 && (
            <DisclosureStrip tickers={tickers} authorId={post.authorId} />
          )}

          <div className="mt-4 flex items-center gap-6 text-pe-text-secondary">
            <button
              type="button"
              onClick={() => setLiked((v) => !v)}
              className={`inline-flex items-center gap-1.5 text-sm transition hover:text-pe-negative ${liked ? 'text-pe-negative' : ''}`}
            >
              <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
              {formatCount(likes)}
            </button>
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm transition hover:text-pe-text"
            >
              <MessageCircle className="h-4 w-4" />
              {post.comments.length}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-sm transition hover:text-pe-text"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          {showComments && post.comments.length > 0 && (
            <div className="mt-4 space-y-1 rounded-xl border border-pe-border bg-pe-surface/70 px-3">
              {post.comments.map((c) => (
                <CommentRow key={c.id} comment={c} />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
