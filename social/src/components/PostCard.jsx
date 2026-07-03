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
    <article className="border-b border-pe-border px-4 py-4">
      <div className="flex gap-3">
        <Avatar person={person} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-1.5">
                <span className="truncate text-sm font-semibold text-pe-text">{person.name}</span>
                <span className="truncate text-sm text-pe-text-muted">@{person.handle}</span>
                <span className="text-pe-text-muted">·</span>
                <span className="text-sm text-pe-text-muted">{timeAgo(post.createdAt)}</span>
              </div>
              <div className="mt-0.5 flex gap-2 text-[11px] text-pe-text-muted">
                <span>XIRR {formatPct(person.xirr, { signed: false })}</span>
                <span>·</span>
                <span>{formatCount(person.followers)} followers</span>
              </div>
            </div>
          </div>

          {post.via && (
            <p className="mt-2 text-[11px] text-pe-text-muted">
              via <span className="font-medium text-pe-text-secondary">{post.via.label}</span>
              <span className="text-pe-text-muted"> · {post.via.reason}</span>
            </p>
          )}

          <div className="mt-2">
            <TickerText text={post.body} authorId={post.authorId} />
          </div>

          {post.trade && <TradePill trade={post.trade} />}

          {post.image && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-pe-border">
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

          <div className="mt-3 flex items-center gap-5 text-pe-text-muted">
            <button
              type="button"
              onClick={() => setLiked((v) => !v)}
              className={`inline-flex items-center gap-1.5 text-xs transition hover:text-pe-negative ${liked ? 'text-pe-negative' : ''}`}
            >
              <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
              {formatCount(likes)}
            </button>
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs transition hover:text-pe-text"
            >
              <MessageCircle className="h-4 w-4" />
              {post.comments.length}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs transition hover:text-pe-text"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          {showComments && post.comments.length > 0 && (
            <div className="mt-2 divide-y divide-pe-border border-t border-pe-border">
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
