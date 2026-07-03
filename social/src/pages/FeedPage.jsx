import { useMemo } from 'react';
import PostCard from '../components/PostCard';
import { FOLLOWING_IDS, POSTS, TOPICS } from '../data/mockData';

export default function FeedPage({ posts, feedMode = 'forYou' }) {
  const followedTopics = useMemo(
    () => new Set(TOPICS.filter((t) => t.followed).map((t) => t.slug)),
    []
  );

  const feedPosts = useMemo(() => {
    const list = posts ?? POSTS;
    if (feedMode === 'following') {
      return list.filter(
        (p) =>
          FOLLOWING_IDS.has(p.authorId) ||
          p.topics?.some((t) => followedTopics.has(t))
      );
    }
    return list;
  }, [feedMode, posts, followedTopics]);

  if (feedPosts.length === 0) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="text-base font-medium text-pe-text">Nothing here yet</p>
        <p className="mt-2 text-sm leading-relaxed text-pe-text-secondary">
          Follow people or topics to fill your Following feed.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-pe-border">
      {feedPosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
