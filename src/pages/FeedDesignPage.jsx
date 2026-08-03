import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import FeedFilters from '../components/feed-v1/FeedFilters';
import ThesisComposer from '../components/feed-v1/ThesisComposer';
import FeedPostCard from '../components/feed-v1/FeedPostCard';
import GuestSignInCta from '../components/GuestSignInCta';
import { FEED_DESIGN_POSTS } from '../data/feedDesignMock';
import { GUEST_FEED_HOOK_POSTS } from '../data/guestFeedHooks';
import { rememberPerson } from '../lib/socialIdentity';
import { timeAgo } from '../lib/format';

/** Authors already followed in the prototype seed. */
const INITIAL_FOLLOWING = new Set(['u_neeraj', 'u_ananya']);

function guestHookToFeedPost(hook) {
  return {
    id: hook.id,
    kind: 'thesis',
    createdAt: timeAgo(hook.createdAt) || '2h',
    author: {
      id: hook.authorId,
      name: hook.authorName,
      handle: hook.authorHandle,
      avatar: hook.authorAvatar,
    },
    title: null,
    body: hook.body,
    image: null,
    tickers: [],
    likes: hook.likes,
    comments: hook.commentCount,
    saved: false,
  };
}

const GUEST_FEED_POSTS = GUEST_FEED_HOOK_POSTS.map((hook) => {
  rememberPerson({
    id: hook.authorId,
    name: hook.authorName,
    handle: hook.authorHandle,
    avatar: hook.authorAvatar,
  });
  return guestHookToFeedPost(hook);
});

/**
 * Feed — Design Language v1.
 * Top bar + right rail live in Shell. Guest mode shows blurred teasers + CTA.
 */
export default function FeedDesignPage({
  feedMode = 'forYou',
  onFeedModeChange,
  guestMode = false,
}) {
  const [filter, setFilter] = useState(feedMode);
  const [followingIds, setFollowingIds] = useState(() => new Set(INITIAL_FOLLOWING));

  useEffect(() => {
    setFilter(feedMode);
  }, [feedMode]);

  const handleFilterChange = useCallback(
    (id) => {
      setFilter(id);
      if (id === 'forYou' || id === 'following') {
        onFeedModeChange?.(id);
      }
    },
    [onFeedModeChange]
  );

  const handleFollow = useCallback((userId) => {
    if (!userId) return;
    setFollowingIds((prev) => {
      const next = new Set(prev);
      next.add(userId);
      return next;
    });
  }, []);

  const posts = useMemo(() => {
    if (filter === 'following') {
      return FEED_DESIGN_POSTS.filter(
        (p) => p.kind !== 'news' && followingIds.has(p.author?.id)
      );
    }
    return FEED_DESIGN_POSTS;
  }, [filter, followingIds]);

  if (guestMode) {
    return (
      <div className="min-h-full bg-white">
        <div className="pb-10">
          <div className="mt-0 flex flex-col gap-0 md:mt-5 md:gap-5">
            {GUEST_FEED_POSTS.map((post) => (
              <div
                key={post.id}
                className="pointer-events-none select-none blur-[5px]"
                aria-hidden
              >
                <FeedPostCard post={post} followingIds={new Set()} />
              </div>
            ))}
          </div>

          <GuestSignInCta
            variant="hero"
            title="Investing ideas, unlocked"
            description="See full theses, follow top investors, and build your edge — free on PocketEdge."
            action="read full posts and follow investors"
            showExploreHint
            benefits={[
              'Real theses from active investors',
              'Follow people, not just tickers',
              'Daily AI insights on your watchlist',
            ]}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-white">
      <div className="pb-10">
        <FeedFilters active={filter} onChange={handleFilterChange} />
        <ThesisComposer />

        <div className="mt-0 flex flex-col gap-0 md:mt-5 md:gap-5">
          {posts.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              followingIds={followingIds}
              onFollow={handleFollow}
            />
          ))}
          {!posts.length ? (
            <p className="px-4 py-12 text-center text-sm text-[var(--fv-text-secondary)]">
              No posts in Following yet — follow investors to fill this feed.
            </p>
          ) : null}
        </div>

        <div className="mx-3 mt-6 flex flex-col items-center gap-2 px-4 py-6 text-center md:mx-6 md:mt-8 md:py-8">
          <Loader2
            className="h-5 w-5 animate-spin text-[var(--fv-accent)] md:h-6 md:w-6"
            strokeWidth={2}
            aria-hidden
          />
          <p className="fv-meta max-w-sm text-[13px] leading-relaxed md:text-[14px]">
            You&apos;re all caught up. Check back later for more updates from the community.
          </p>
        </div>
      </div>
    </div>
  );
}
