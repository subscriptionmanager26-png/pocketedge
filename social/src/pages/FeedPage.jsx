import { useMemo } from 'react';
import { isDevMockMode } from '../lib/appMode';
import PostCard from '../components/PostCard';
import { POSTS } from '../data/mockData';
import { getFollowedTopicSlugs, getFollowingIds } from '../lib/socialGraphStore';

export default function FeedPage({
  posts,
  feedMode = 'forYou',
  graphTick,
  onOpenProfile,
  onOpenPost,
}) {
  const followingIds = useMemo(() => getFollowingIds(), [graphTick]);
  const followedTopics = useMemo(() => getFollowedTopicSlugs(), [graphTick]);

  const feedPosts = useMemo(() => {
    const list = posts ?? (isDevMockMode() ? POSTS : []);
    if (feedMode === 'following') {
      return list.filter(
        (p) =>
          followingIds.has(p.authorId) ||
          p.topics?.some((t) => followedTopics.has(t))
      );
    }
    return list;
  }, [feedMode, posts, followingIds, followedTopics]);

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
          onOpenProfile={onOpenProfile}
          onOpenPost={onOpenPost}
        />
      ))}
    </div>
  );
}
