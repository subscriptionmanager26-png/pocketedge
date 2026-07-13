import { useEffect, useMemo, useState } from 'react';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import Avatar from './Avatar';
import { SignalDisplay, signalLabelFromRating } from './SignalPicker';
import { formatTicker } from '../lib/tickers';
import { STOCKS } from '../data/mockData';
import { getFund } from '../data/fundData';
import {
  getUserVote,
  incrementReviewShare,
  subscribeReviews,
  toggleReviewLike,
} from '../lib/reviewStore';
import { isFollowing, toggleFollow } from '../lib/socialGraphStore';
import { formatCount, timeAgo } from '../lib/format';
import {
  getAppCurrentUserId,
  getPersonSync,
  resolvePeople,
} from '../lib/socialIdentity';

export default function ReviewCard({
  review,
  locked = false,
  onAddComment,
  onOpenProfile,
  onGraphChange,
  onReviewChange,
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [reviewTick, setReviewTick] = useState(0);
  const [enrichTick, setEnrichTick] = useState(0);
  const [following, setFollowing] = useState(() => isFollowing(review.authorId));
  const me = getAppCurrentUserId();

  useEffect(() => subscribeReviews(() => setReviewTick((n) => n + 1)), []);
  void reviewTick;

  const authorKey = useMemo(() => {
    const ids = new Set();
    if (review?.authorId) ids.add(String(review.authorId));
    for (const comment of review?.comments ?? []) {
      if (comment?.authorId) ids.add(String(comment.authorId));
    }
    return [...ids].sort().join(',');
  }, [review?.authorId, review?.comments]);

  useEffect(() => {
    if (!authorKey) return undefined;
    let cancelled = false;
    resolvePeople(authorKey.split(','))
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setEnrichTick((n) => n + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [authorKey]);
  void enrichTick;

  const person = getPersonSync(review.authorId) ?? {
    id: review.authorId,
    name: 'Member',
    handle: 'member',
    avatar: 'M',
  };
  const fund = review.fundId ? getFund(review.fundId) : null;
  const stock = review.stockTicker ? STOCKS[review.stockTicker] : null;
  const assetLabel = stock
    ? `${formatTicker(review.stockTicker)} · ${stock.name}`
    : fund?.name;
  const liked = getUserVote(review.id) === 'agree';
  const likeCount = review.agreeCount ?? 0;

  const handleLike = () => {
    if (locked) return;
    toggleReviewLike(review.id);
    onReviewChange?.();
  };

  const handleFollow = () => {
    const next = toggleFollow(review.authorId);
    setFollowing(next);
    onGraphChange?.();
  };

  const handleShare = async () => {
    if (locked) return;
    const url = review.stockTicker
      ? `${window.location.origin}?stock=${review.stockTicker}&review=${review.id}`
      : `${window.location.origin}?fund=${review.fundId}&review=${review.id}`;
    const signal = signalLabelFromRating(review.rating) ?? `${review.rating}★`;
    const text = `${person.name} is ${signal.toLowerCase()} on ${assetLabel ?? 'an investment'}${review.body ? `: ${review.body}` : ''}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Investor review on PocketEdge', text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
      }
      await incrementReviewShare(review.id);
      onReviewChange?.();
    } catch {
      /* user cancelled */
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || locked) return;
    await onAddComment?.(review.id, commentText.trim());
    setCommentText('');
    setShowComments(true);
  };

  return (
    <article className={`border-b border-pe-border px-4 py-5 ${locked ? 'relative' : ''}`}>
      {locked && (
        <div className="pointer-events-none absolute inset-0 z-10 bg-pe-canvas/70 backdrop-blur-[2px]" />
      )}

      <div className="flex gap-3">
        <Avatar person={person} onClick={() => onOpenProfile?.(review.authorId)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <button
                type="button"
                onClick={() => onOpenProfile?.(review.authorId)}
                className="text-[15px] font-semibold text-pe-text hover:underline"
              >
                {person.name}
              </button>
              <span className="text-sm text-pe-text-muted">@{person.handle}</span>
              <span className="text-pe-text-muted">·</span>
              <span className="text-sm text-pe-text-muted">{timeAgo(review.createdAt)}</span>
            </div>
            {review.authorId !== me && (
              <button
                type="button"
                onClick={handleFollow}
                className={`shrink-0 rounded-md px-3 py-1 text-xs font-bold ${
                  following
                    ? 'border border-pe-border-strong text-pe-text'
                    : 'bg-pe-accent text-white'
                }`}
              >
                {following ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          <div className="mt-2">
            <SignalDisplay rating={review.rating} />
          </div>

          {review.body ? (
            <p className="mt-2 text-[15px] leading-relaxed text-pe-ink">
              &ldquo;{review.body}&rdquo;
            </p>
          ) : null}

          {assetLabel && (
            <p className="mt-1.5 text-xs font-semibold text-pe-link">{assetLabel}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-4 text-pe-text-secondary">
            <button
              type="button"
              onClick={handleLike}
              aria-pressed={liked}
              className={`inline-flex items-center gap-1.5 text-sm transition ${
                liked ? 'text-pe-accent' : 'hover:text-pe-accent'
              }`}
            >
              <Heart className={`h-4 w-4 ${liked ? 'fill-current text-pe-accent' : ''}`} />
              {formatCount(likeCount)}
            </button>
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-pe-text"
            >
              <MessageCircle className="h-4 w-4" />
              {(review.comments ?? []).length || 'Comment'}
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-pe-text"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>

          {showComments && (
            <div className="mt-4 border-t border-pe-border pt-3">
              {(review.comments ?? []).length === 0 ? (
                <p className="text-sm text-pe-text-muted">No replies yet — leave a reply.</p>
              ) : (
                <ul className="space-y-3">
                  {(review.comments ?? []).map((c) => {
                    const author = getPersonSync(c.authorId) ?? {
                      id: c.authorId,
                      name: 'Member',
                      handle: 'member',
                      avatar: 'M',
                    };
                    const parent = c.parentId
                      ? (review.comments ?? []).find((x) => x.id === c.parentId)
                      : null;
                    const parentAuthor = parent
                      ? getPersonSync(parent.authorId) ?? { name: 'Member' }
                      : null;
                    return (
                      <li key={c.id} className={c.parentId ? 'ml-4 border-l-2 border-pe-border pl-3' : ''}>
                        {parent && (
                          <p className="mb-1 text-xs text-pe-text-muted">
                            Replying to {parentAuthor.name}
                          </p>
                        )}
                        <p className="text-sm font-semibold text-pe-text">{author.name}</p>
                        <p className="text-sm leading-relaxed text-pe-text-secondary">{c.body}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!locked && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                    placeholder="Add a reply…"
                    className="min-w-0 flex-1 rounded-lg border border-pe-border bg-pe-surface px-3 py-2 text-sm outline-none focus:border-pe-accent"
                  />
                  <button
                    type="button"
                    onClick={submitComment}
                    disabled={!commentText.trim()}
                    className="rounded-md bg-pe-accent px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
                  >
                    Reply
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
