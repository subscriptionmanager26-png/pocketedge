import { useEffect, useMemo, useState } from 'react';
import ComposeModal from './components/ComposeModal';
import Shell from './components/Shell';
import ActivityPage from './pages/ActivityPage';
import FeedPage from './pages/FeedPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import OnboardingFlow from './pages/onboarding/OnboardingFlow';
import SettingsPage from './pages/SettingsPage';
import MarketsPage from './pages/MarketsPage';
import InvestmentPage from './pages/InvestmentPage';
import FundReviewModal from './components/FundReviewModal';
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
import { clearSocialGraph } from './lib/socialGraphStore';
import {
  clearSession,
  resolveAuthView,
  saveSession,
  isOnboardingComplete,
} from './lib/sessionStore';
import { clearWatchlists } from './lib/watchlistStore';
import { clearReviewStore } from './lib/reviewStore';
import { CURRENT_USER, POSTS, getPerson } from './data/mockData';
import { getFund } from './data/fundData';

export default function App() {
  const [authView, setAuthView] = useState(() => resolveAuthView());
  const [tab, setTab] = useState('feed');
  const [feedMode, setFeedMode] = useState('forYou');
  const [composeOpen, setComposeOpen] = useState(false);
  const [posts, setPosts] = useState(POSTS);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [selectedFundId, setSelectedFundId] = useState(null);
  const [fundReviewOpen, setFundReviewOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [profileMode, setProfileMode] = useState('own');
  const [profileUserId, setProfileUserId] = useState(CURRENT_USER.id);
  const [profileReturnTab, setProfileReturnTab] = useState('feed');
  const [profilePortfolioId, setProfilePortfolioId] = useState(null);
  const [activityTick, setActivityTick] = useState(0);
  const [graphTick, setGraphTick] = useState(0);

  useEffect(() => subscribeActivity(() => setActivityTick((n) => n + 1)), []);

  const activityItems = useMemo(
    () => getActivityFeed(),
    [activityTick, posts, graphTick]
  );
  const activityUnread = getUnreadActivityCount(activityItems);

  useEffect(() => {
    if (tab === 'activity') markAllActivityRead(activityItems);
  }, [tab, activityItems]);

  const handlePost = ({ body, image }) => {
    const post = {
      id: `p_local_${Date.now()}`,
      authorId: CURRENT_USER.id,
      type: image ? 'image' : 'text',
      body: body || '',
      image: image ?? null,
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

  const handleAddComment = (postId, text) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const comment = {
          id: `c_${Date.now()}`,
          authorId: CURRENT_USER.id,
          body: text,
          createdAt: new Date().toISOString(),
        };
        return { ...p, comments: [...(p.comments ?? []), comment] };
      })
    );
  };

  const setFeedModeAndStay = (mode) => {
    setFeedMode(mode);
    setSelectedPostId(null);
    setTab('feed');
  };

  const openStock = (ticker) => {
    setSelectedTicker(ticker);
    setSelectedFundId(null);
    setSelectedPostId(null);
    setTab('markets');
  };

  const openFund = (fundId) => {
    setSelectedFundId(fundId);
    setSelectedTicker(null);
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
      setProfileReturnTab(tab === 'profile' || tab === 'settings' ? profileReturnTab : tab);
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
    if (next !== 'markets') {
      setSelectedTicker(null);
      setSelectedFundId(null);
    }
    if (next === 'profile') {
      setProfileMode('own');
      setProfileUserId(CURRENT_USER.id);
      setProfileReturnTab(next);
    }
  };

  const handleLogin = ({ email }) => {
    saveSession({ userId: CURRENT_USER.id, email, isNew: false });
    setAuthView(isOnboardingComplete() ? 'app' : 'onboarding');
  };

  const handleSignup = ({ email }) => {
    saveSession({ userId: CURRENT_USER.id, email, isNew: true });
    setAuthView('onboarding');
  };

  const handleLogout = () => {
    clearSession();
    clearSocialGraph();
    clearWatchlists();
    clearReviewStore();
    setAuthView('landing');
    setTab('feed');
    setPosts(POSTS);
  };

  const pageTitleOverride =
    authView === 'app' && tab === 'settings'
      ? 'Settings'
      : authView === 'app' && selectedPostId && tab === 'feed'
        ? 'Post'
        : authView === 'app' && tab === 'activity'
          ? 'Activity'
          : authView === 'app' && tab === 'profile' && profileMode === 'public'
            ? getPerson(profileUserId).name
          : authView === 'app' && tab === 'markets' && selectedFundId
            ? getFund(selectedFundId)?.name ?? 'Fund'
            : undefined;

  const mobileBack = useMemo(() => {
    if (authView !== 'app') return null;
    if (tab === 'settings') {
      return { label: 'Profile', onBack: () => setTab('profile') };
    }
    if (selectedPostId && tab === 'feed') {
      return { label: 'Back', onBack: () => setSelectedPostId(null) };
    }
    if (tab === 'markets' && selectedFundId) {
      return { label: 'Markets', onBack: () => setSelectedFundId(null) };
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
    authView,
    selectedPostId,
    tab,
    selectedTicker,
    selectedFundId,
    profileMode,
    profileUserId,
    profileReturnTab,
    profilePortfolioId,
  ]);

  if (authView === 'landing') {
    return (
      <LandingPage
        onGetStarted={() => setAuthView('signup')}
        onSignIn={() => setAuthView('login')}
      />
    );
  }

  if (authView === 'login') {
    return (
      <LoginPage
        onBack={() => setAuthView('landing')}
        onLogin={handleLogin}
        onGoSignup={() => setAuthView('signup')}
      />
    );
  }

  if (authView === 'signup') {
    return (
      <SignupPage
        onBack={() => setAuthView('landing')}
        onSignup={handleSignup}
        onGoLogin={() => setAuthView('login')}
      />
    );
  }

  if (authView === 'onboarding') {
    return <OnboardingFlow onComplete={() => setAuthView('app')} />;
  }

  return (
    <>
      <Shell
        tab={tab === 'settings' ? 'profile' : tab}
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
          setProfileReturnTab(tab === 'settings' ? 'feed' : tab);
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
              onAddComment={(text) => handleAddComment(selectedPostId, text)}
            />
          ) : (
            <FeedPage
              posts={posts}
              feedMode={feedMode}
              graphTick={graphTick}
              onGraphChange={() => setGraphTick((n) => n + 1)}
              onOpenProfile={openProfile}
              onOpenPost={openPost}
            />
          ))}
        {tab === 'search' && (
          <SearchPage
            onOpenProfile={openProfile}
            onSelectStock={openStock}
            onGraphChange={() => setGraphTick((n) => n + 1)}
          />
        )}
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
        {tab === 'markets' &&
          (selectedFundId ? (
            <InvestmentPage
              fundId={selectedFundId}
              onBack={() => setSelectedFundId(null)}
              onOpenProfile={openProfile}
              onGraphChange={() => setGraphTick((n) => n + 1)}
              onPromptReview={() => setFundReviewOpen(true)}
            />
          ) : (
            <MarketsPage
              selectedTicker={selectedTicker}
              onSelectStock={openStock}
              onSelectFund={openFund}
              onClearStock={() => setSelectedTicker(null)}
              onOpenProfile={openProfile}
              onOpenPost={openPost}
            />
          ))}
        {tab === 'profile' && (
          <ProfilePage
            mode={profileMode}
            userId={profileUserId}
            posts={posts}
            selectedPortfolioId={profilePortfolioId}
            onSelectPortfolio={setProfilePortfolioId}
            onClearPortfolio={() => setProfilePortfolioId(null)}
            onBack={() => setTab(profileReturnTab || 'feed')}
            onOpenSettings={() => setTab('settings')}
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
            onGraphChange={() => setGraphTick((n) => n + 1)}
          />
        )}
        {tab === 'settings' && <SettingsPage onBack={() => setTab('profile')} onLogout={handleLogout} />}
      </Shell>

      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} onPost={handlePost} />

      <FundReviewModal
        open={fundReviewOpen}
        onClose={() => setFundReviewOpen(false)}
        onSubmitted={() => setFundReviewOpen(false)}
      />
    </>
  );
}
