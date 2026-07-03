import { useState } from 'react';
import ComposeModal from './components/ComposeModal';
import Shell from './components/Shell';
import FeedPage from './pages/FeedPage';
import MarketsPage from './pages/MarketsPage';
import PortfolioPage from './pages/PortfolioPage';
import ProfilePage from './pages/ProfilePage';
import SearchPage from './pages/SearchPage';
import { CURRENT_USER, POSTS } from './data/mockData';

export default function App() {
  const [tab, setTab] = useState('feed');
  const [feedMode, setFeedMode] = useState('forYou');
  const [composeOpen, setComposeOpen] = useState(false);
  const [posts, setPosts] = useState(POSTS);

  const handlePost = (body) => {
    const post = {
      id: `p_local_${Date.now()}`,
      authorId: CURRENT_USER.id,
      type: 'text',
      body,
      image: null,
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: [],
      via: { kind: 'person', label: `@${CURRENT_USER.handle}`, reason: 'you posted' },
      topics: [],
    };
    setPosts((prev) => [post, ...prev]);
    setTab('feed');
  };

  const toggleFeedMode = () => {
    setFeedMode((mode) => (mode === 'forYou' ? 'following' : 'forYou'));
    setTab('feed');
  };

  return (
    <>
      <Shell
        tab={tab}
        feedMode={feedMode}
        onTabChange={setTab}
        onFeedModeToggle={toggleFeedMode}
        onProfile={() => setTab('profile')}
        onCompose={() => setComposeOpen(true)}
      >
        {tab === 'feed' && <FeedPage posts={posts} feedMode={feedMode} />}
        {tab === 'search' && <SearchPage />}
        {tab === 'portfolio' && <PortfolioPage />}
        {tab === 'markets' && <MarketsPage />}
        {tab === 'profile' && (
          <ProfilePage onBack={() => setTab('feed')} posts={posts} />
        )}
      </Shell>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onPost={handlePost}
      />
    </>
  );
}
