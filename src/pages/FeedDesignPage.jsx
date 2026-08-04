import { useCallback, useEffect, useMemo, useState } from 'react';
import FeedFilters from '../components/feed-v1/FeedFilters';
import ThesisComposer from '../components/feed-v1/ThesisComposer';
import FeedPostCard from '../components/feed-v1/FeedPostCard';
import GuestSignInCta from '../components/GuestSignInCta';
import PostCard from '../components/PostCard';
import { FeedSkeleton } from '../components/PageSkeletons';
import { GUEST_FEED_HOOK_POSTS } from '../data/guestFeedHooks';
import { isDevMockMode } from '../lib/appMode';
import { getFollowedTopicSlugs, getFollowingIds } from '../lib/socialGraphStore';
import { getAppCurrentUser, rememberPerson } from '../lib/socialIdentity';
import { timeAgo } from '../lib/format';
import { usePostEnrichment } from '../lib/usePostEnrichment';

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
 * Feed — Design Language v1 chrome with production posts.
 * Top bar lives in Shell. Guest mode shows blurred teasers + CTA only.
 */
export default function FeedDesignPage({
  posts: postsProp,
  feedMode = 'forYou',
  onFeedModeChange,
  graphTick = 0,
  loading = false,
  guestMode = false,
  onOpenProfile,
  onOpenPost,
  onOpenStock,
  onToggleLike,
  onCompose,
}) {
  const [filter, setFilter] = useState(feedMode);
  const [mockPosts, setMockPosts] = useState(null);
  const followingIds = useMemo(() => getFollowingIds(), [graphTick]);
  const followedTopics = useMemo(() => getFollowedTopicSlugs(), [graphTick]);
  const currentUser = getAppCurrentUser();

  useEffect(() => {
    setFilter(feedMode);
  }, [feedMode]);

  useEffect(() => {
    if (guestMode || !isDevMockMode() || postsProp != null) return undefined;
    let cancelled = false;
    import('../data/mockData')
      .then((mod) => {
        if (!cancelled) setMockPosts(mod.POSTS);
      })
      .catch(() => {
        if (!cancelled) setMockPosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [postsProp, guestMode]);

  const handleFilterChange = useCallback(
    (id) => {
      setFilter(id);
      if (id === 'forYou' || id === 'following') {
        onFeedModeChange?.(id);
      }
    },
    [onFeedModeChange]
  );

  const feedPosts = useMemo(() => {
    if (guestMode) return [];
    const list = postsProp ?? mockPosts ?? [];
    if (filter === 'following' || feedMode === 'following') {
      return list.filter(
        (p) =>
          followingIds.has(p.authorId) ||
          p.topics?.some((t) => followedTopics.has(t))
      );
    }
    return list;
  }, [
    filter,
    feedMode,
    postsProp,
    mockPosts,
    followingIds,
    followedTopics,
    guestMode,
  ]);

  const enrichmentTick = usePostEnrichment(feedPosts);
  const awaitingMock =
    !guestMode && isDevMockMode() && postsProp == null && mockPosts == null;

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

  if ((loading || awaitingMock) && feedPosts.length === 0) {
    return (
      <div className="min-h-full bg-white">
        <FeedFilters active={filter} onChange={handleFilterChange} />
        <ThesisComposer onCompose={onCompose} currentUser={currentUser} />
        <FeedSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-white">
      <div className="pb-10">
        <FeedFilters active={filter} onChange={handleFilterChange} />
        <ThesisComposer onCompose={onCompose} currentUser={currentUser} />

        <div className="mt-1 flex flex-col gap-0 md:mt-5 md:gap-5">
          {feedPosts.length === 0 ? (
            <div className="px-4 py-20 text-center">
              <p className="text-xl font-bold text-pe-text">Nothing here yet</p>
              <p className="mt-2 text-sm leading-relaxed text-pe-text-secondary">
                {filter === 'following' || feedMode === 'following'
                  ? 'Follow people or topics to fill your Following feed.'
                  : 'Posts from the community will show up here.'}
              </p>
            </div>
          ) : (
            feedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                variant="feed"
                enrichmentTick={enrichmentTick}
                onOpenProfile={onOpenProfile}
                onOpenPost={onOpenPost}
                onOpenStock={onOpenStock}
                onToggleLike={onToggleLike}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
