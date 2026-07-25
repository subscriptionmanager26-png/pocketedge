import { useEffect, useMemo, useState } from 'react';
import { isDevMockMode } from '../lib/appMode';
import PostCard from '../components/PostCard';
import { FeedSkeleton } from '../components/PageSkeletons';
import { getFollowedTopicSlugs, getFollowingIds } from '../lib/socialGraphStore';
import { usePostEnrichment } from '../lib/usePostEnrichment';

export default function FeedPage({
  posts,
  feedMode = 'forYou',
  graphTick,
  loading = false,
  onOpenProfile,
  onOpenPost,
  onOpenStock,
  onToggleLike,
}) {
  const followingIds = useMemo(() => getFollowingIds(), [graphTick]);
  const followedTopics = useMemo(() => getFollowedTopicSlugs(), [graphTick]);
  const [mockPosts, setMockPosts] = useState(null);

  useEffect(() => {
    if (!isDevMockMode() || posts != null) return undefined;
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
  }, [posts]);

  const feedPosts = useMemo(() => {
    const list = posts ?? mockPosts ?? [];
    if (feedMode === 'following') {
      return list.filter(
        (p) =>
          followingIds.has(p.authorId) ||
          p.topics?.some((t) => followedTopics.has(t))
      );
    }
    return list;
  }, [feedMode, posts, mockPosts, followingIds, followedTopics]);

  const enrichmentTick = usePostEnrichment(feedPosts);
  const awaitingMock = isDevMockMode() && posts == null && mockPosts == null;

  if ((loading || awaitingMock) && feedPosts.length === 0) {
    return <FeedSkeleton />;
  }

  if (feedPosts.length === 0) {
    return (
      <div className="px-4 py-20 text-center">
        <p className="text-xl font-bold text-pe-text">Nothing here yet</p>
        <p className="mt-2 text-sm leading-relaxed text-pe-text-secondary">
          Follow people or topics to fill your Following feed.
        </p>
      </div>
    );
  }

  return (
    <div>
      {feedPosts.map((post) => (
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
      ))}
    </div>
  );
}
