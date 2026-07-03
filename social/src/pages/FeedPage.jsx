import { useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import PostCard from '../components/PostCard';
import {
  FOLLOWING_IDS,
  POSTS,
  TOPICS,
} from '../data/mockData';

const FEED_TABS = [
  { id: 'home', label: 'Home' },
  { id: 'following', label: 'Following' },
  { id: 'topics', label: 'Topics' },
];

export default function FeedPage({ posts }) {
  const [tab, setTab] = useState('home');
  const [followedTopics, setFollowedTopics] = useState(
    () => new Set(TOPICS.filter((t) => t.followed).map((t) => t.slug))
  );
  const [topicFilter, setTopicFilter] = useState(null);

  const feedPosts = useMemo(() => {
    const list = posts ?? POSTS;
    if (tab === 'home') return list;
    if (tab === 'following') {
      return list.filter(
        (p) =>
          FOLLOWING_IDS.has(p.authorId) ||
          p.topics?.some((t) => followedTopics.has(t))
      );
    }
    if (topicFilter) {
      return list.filter((p) => p.topics?.includes(topicFilter));
    }
    return list.filter((p) => p.topics?.some((t) => followedTopics.has(t)));
  }, [tab, posts, followedTopics, topicFilter]);

  const toggleTopic = (slug) => {
    setFollowedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  return (
    <div>
      <div className="sticky top-[57px] z-30 border-b border-pe-border bg-pe-canvas/95 backdrop-blur-xl">
        <div className="flex">
          {FEED_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative flex-1 py-3 text-sm font-medium transition ${
                tab === t.id ? 'text-pe-text' : 'text-pe-text-muted hover:text-pe-text-secondary'
              }`}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute inset-x-8 bottom-0 h-0.5 rounded-full bg-white" />
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === 'topics' && (
        <div className="border-b border-pe-border px-4 py-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-pe-text-muted">
            Your topics
          </p>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((topic) => {
              const active = followedTopics.has(topic.slug);
              const filtered = topicFilter === topic.slug;
              return (
                <div key={topic.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setTopicFilter(filtered ? null : topic.slug)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      filtered
                        ? 'border-white bg-white text-black'
                        : active
                          ? 'border-white/30 bg-white/10 text-pe-text'
                          : 'border-pe-border text-pe-text-secondary'
                    }`}
                  >
                    #{topic.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleTopic(topic.slug)}
                    className="rounded-full border border-pe-border p-1 text-pe-text-muted hover:text-pe-text"
                    aria-label={active ? `Unfollow ${topic.name}` : `Follow ${topic.name}`}
                  >
                    {active ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {feedPosts.length === 0 ? (
        <div className="px-6 py-16 text-center text-sm text-pe-text-muted">
          Nothing here yet. Follow people or topics to fill this feed.
        </div>
      ) : (
        feedPosts.map((post) => <PostCard key={post.id} post={post} />)
      )}
    </div>
  );
}
