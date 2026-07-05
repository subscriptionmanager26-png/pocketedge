import { useEffect, useMemo, useState } from 'react';
import ComposeModal from './components/ComposeModal';
import Shell from './components/Shell';
import ActivityPage from './pages/ActivityPage';
import FeedPage from './pages/FeedPage';
import MarketsPage from './pages/MarketsPage';
import PortfolioPage from './pages/PortfolioPage';
import PostDetailPage from './pages/PostDetailPage';
import ProfilePage from './pages/ProfilePage';
import SearchPage from './pages/SearchPage';
import { getActivityFeed } from './lib/activityFeed';
import {
  getUnreadActivityCount,
  markActivityRead,
  markAllActivityRead,
  subscribeActivity,
} from './lib/activityStore';
import { CURRENT_USER, POSTS, getPerson } from './data/mockData';

export default function App() {
  const [tab, setTab] = useState('feed');
  const [feedMode, setFeedMode] = useState('forYou');
  const [composeOpen, setComposeOpen] = useState(false);
  const [posts, setPosts] = useState(POSTS);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [profileMode, setProfileMode] = useState('own');
  const [profileUserId, setProfileUserId] = useState(CURRENT_USER.id);
  const [profileReturnTab, setProfileReturnTab] = useState('feed');
  const [profilePortfolioId, setProfilePortfolioId] = useState(null);
  const [activityTick, setActivityTick] = useState(0);

  useEffect(() => subscribeActivity(() => setActivityTick((n) => n + 1)), []);

  const activityItems = useMemo(() => getActivityFeed(), [activityTick, posts]);
  const activityUnread = getUnreadActivityCount(activityItems);

  useEffect(() => {
    if (tab === 'activity') markAllActivityRead(activityItems);
  }, [tab, activityItems]);

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
    setSelectedPostId(null);
    setTab('feed');
  };

  const setFeedModeAndStay = (mode) => {
    setFeedMode(mode);
    setSelectedPostId(null);
    setTab('feed');
  };

  const openStock = (ticker) => {
    setSelectedTicker(ticker);
    setSelectedPostId(null);
    setTab('markets');
  };

  const openPost = (postId) => {
    setSelectedPostId(postId);
    setTab('feed');
  };

  const openProfile = (userId) => {
    if (!userId) return;
    setSelectedPostId(null);
    setProfilePortfolioId(null);
    if (userId === CURRENT_USER.id) {
      setProfileUserId(CURRENT_USER.id);
      setProfileMode('own');
      setProfileReturnTab(tab === 'profile' ? profileReturnTab : tab);
      setTab('profile');
      return;
    }
    setProfileReturnTab(tab === 'profile' ? profileReturnTab : tab);
    setProfileUserId(userId);
    setProfileMode('public');
    setTab('profile');
  };

  const handleTabChange = (next) => {
    setTab(next);
    setSelectedPostId(null);
    setProfilePortfolioId(null);
    if (next !== 'markets') setSelectedTicker(null);
    if (next === 'profile') {
      setProfileMode('own');
      setProfileUserId(CURRENT_USER.id);
      setProfileReturnTab(next);
    }
  };

  const pageTitleOverride =
    selectedPostId && tab === 'feed'
      ? 'Post'
      : tab === 'activity'
        ? 'Activity'
        : tab === 'profile' && profileMode === 'public'
          ? getPerson(profileUserId).name
          : undefined;

  const mobileBack = useMemo(() => {
    if (selectedPostId && tab === 'feed') {
      return { label: 'Back', onBack: () => setSelectedPostId(null) };
    }
    if (tab === 'markets' && selectedTicker) {
      return { label: 'Markets', onBack: () => setSelectedTicker(null) };
    }
    if (tab === 'profile' && profilePortfolioId) {
      return { label: 'Portfolios', onBack: () => setProfilePortfolioId(null) };
    }
    if (tab === 'profile' && profileMode === 'public') {
      if (profileUserId === CURRENT_USER.id) {
        return null;
      }
      return {
        label: 'Back',
        onBack: () => setTab(profileReturnTab || 'feed'),
      };
    }
    return null;
  }, [
    selectedPostId,
    tab,
    selectedTicker,
    profileMode,
    profileUserId,
    profileReturnTab,
    profilePortfolioId,
  ]);

  return (
    <>
      <Shell
        tab={tab}
        feedMode={feedMode}
        pageTitleOverride={pageTitleOverride}
        mobileBack={mobileBack}
        activityUnread={activityUnread}
        onTabChange={handleTabChange}
        onFeedModeChange={setFeedModeAndStay}
        onProfile={() => {
          setSelectedPostId(null);
          setProfileMode('own');
          setProfileUserId(CURRENT_USER.id);
          setProfileReturnTab(tab);
          setTab('profile');
        }}
        onCompose={() => setComposeOpen(true)}
      >
        {tab === 'feed' &&
          (selectedPostId ? (
            <PostDetailPage
              postId={selectedPostId}
              posts={posts}
              onBack={() => setSelectedPostId(null)}
              onOpenProfile={openProfile}
            />
          ) : (
            <FeedPage
              posts={posts}
              feedMode={feedMode}
              onOpenProfile={openProfile}
              onOpenPost={openPost}
            />
          ))}
        {tab === 'search' && <SearchPage onOpenProfile={openProfile} />}
        {tab === 'activity' && (
          <ActivityPage
            items={activityItems}
            onOpenProfile={openProfile}
            onOpenPost={(postId) => {
              markActivityRead(
                activityItems.find((item) => item.meta?.postId === postId)?.id ?? ''
              );
              openPost(postId);
            }}
            onOpenStock={(ticker) => {
              const item = activityItems.find((i) => i.ticker === ticker);
              if (item) markActivityRead(item.id);
              openStock(ticker);
            }}
          />
        )}
        {tab === 'portfolio' && (
          <PortfolioPage
            onSelectStock={openStock}
            onOpenProfile={openProfile}
            onOpenPost={openPost}
          />
        )}
        {tab === 'markets' && (
          <MarketsPage
            selectedTicker={selectedTicker}
            onSelectStock={openStock}
            onClearStock={() => setSelectedTicker(null)}
            onOpenProfile={openProfile}
            onOpenPost={openPost}
          />
        )}
        {tab === 'profile' && (
          <ProfilePage
            mode={profileMode}
            userId={profileUserId}
            posts={posts}
            selectedPortfolioId={profilePortfolioId}
            onSelectPortfolio={setProfilePortfolioId}
            onClearPortfolio={() => setProfilePortfolioId(null)}
            onBack={() => setTab(profileReturnTab || 'feed')}
            onOpenPublicPreview={() => {
              setProfileUserId(CURRENT_USER.id);
              setProfileMode('public');
            }}
            onExitPublicPreview={() => {
              setProfileUserId(CURRENT_USER.id);
              setProfileMode('own');
            }}
            onOpenProfile={openProfile}
            onOpenPost={openPost}
          />
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
