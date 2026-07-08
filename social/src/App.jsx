import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ComposeModal from './components/ComposeModal';
import Shell from './components/Shell';
import ActivityPage from './pages/ActivityPage';
import FeedPage from './pages/FeedPage';
import HomePage from './pages/HomePage';
import OnboardingFlow from './pages/onboarding/OnboardingFlow';
import SettingsPage from './pages/SettingsPage';
import MarketsPage from './pages/MarketsPage';
import InvestmentPage from './pages/InvestmentPage';
import StockInvestmentPage from './pages/StockInvestmentPage';
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
  resolveAuthViewForUser,
  skipAuthForDev,
} from './lib/sessionStore';
import { cleanOAuthCallbackUrl, signOutFromSupabase, supabase } from './lib/supabase';
import { clearWatchlists } from './lib/watchlistStore';
import { clearReviewStore } from './lib/reviewStore';
import { buildPortfolioShare } from './lib/portfolioShare';
import { CURRENT_USER, POSTS, getPerson, STOCKS } from './data/mockData';
import { getFund } from './data/fundData';

export default function App() {
  const [authView, setAuthView] = useState('bootstrapping');
  const [authUser, setAuthUser] = useState(null);
  const [tab, setTab] = useState('feed');
  const [feedMode, setFeedMode] = useState('forYou');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composePortfolioShare, setComposePortfolioShare] = useState(null);
  const [posts, setPosts] = useState(POSTS);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [selectedFundId, setSelectedFundId] = useState(null);
  const [fundReviewOpen, setFundReviewOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [profileMode, setProfileMode] = useState('own');
  const [profileUserId, setProfileUserId] = useState(CURRENT_USER.id);
  const [profileReturnTab, setProfileReturnTab] = useState('feed');
  const [settingsReturnTab, setSettingsReturnTab] = useState('feed');
  const [fundReviewPrefill, setFundReviewPrefill] = useState(null);
  const [profilePortfolioId, setProfilePortfolioId] = useState(null);
  const [activityTick, setActivityTick] = useState(0);
  const [graphTick, setGraphTick] = useState(0);
  const [scrollAction, setScrollAction] = useState('reset');

  const resetScroll = useCallback(() => setScrollAction('reset'), []);
  const backScroll = useCallback(() => setScrollAction('back'), []);
  const consumeScrollAction = useCallback(() => setScrollAction('reset'), []);

  const routeKey = useMemo(() => {
    if (tab === 'feed' && selectedPostId) return `post:${selectedPostId}`;
    if (tab === 'markets' && selectedFundId) return `fund:${selectedFundId}`;
    if (tab === 'markets' && selectedTicker) return `stock:${selectedTicker}`;
    if (tab === 'profile' && profilePortfolioId) {
      return `profile:${profileUserId}:portfolio:${profilePortfolioId}`;
    }
    if (tab === 'profile' && profileMode === 'public' && profileUserId !== CURRENT_USER.id) {
      return `profile:${profileUserId}:public`;
    }
    if (tab === 'profile') return `profile:${profileUserId}`;
    return tab;
  }, [
    tab,
    selectedPostId,
    selectedFundId,
    selectedTicker,
    profilePortfolioId,
    profileMode,
    profileUserId,
  ]);

  useEffect(() => subscribeActivity(() => setActivityTick((n) => n + 1)), []);

  useEffect(() => {
    if (skipAuthForDev()) {
      setAuthUser({ id: 'u_me', email: 'demo@pocketedge.in' });
      setAuthView('app');
      return undefined;
    }

    if (!supabase) {
      setAuthView('landing');
      return undefined;
    }

    cleanOAuthCallbackUrl();

    const syncAuth = (session) => {
      const user = session?.user ?? null;
      setAuthUser(user);
      setAuthView(resolveAuthViewForUser(user));
    };

    supabase.auth.getSession().then(({ data: { session } }) => syncAuth(session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      cleanOAuthCallbackUrl();
      syncAuth(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const activityItems = useMemo(
    () => getActivityFeed(),
    [activityTick, posts, graphTick]
  );
  const activityUnread = getUnreadActivityCount(activityItems);

  useEffect(() => {
    if (tab === 'activity') markAllActivityRead(activityItems);
  }, [tab, activityItems]);

  const handlePost = ({ body, image, portfolioShare }) => {
    const post = {
      id: `p_local_${Date.now()}`,
      authorId: CURRENT_USER.id,
      type: portfolioShare ? 'portfolio' : image ? 'image' : 'text',
      body: body || '',
      image: image ?? null,
      portfolioShare: portfolioShare ?? null,
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: [],
      via: {
        kind: 'person',
        label: `@${CURRENT_USER.handle}`,
        reason: portfolioShare ? 'shared a portfolio' : 'you posted',
      },
      topics: [],
    };
    setPosts((prev) => [post, ...prev]);
    setSelectedPostId(null);
    setComposePortfolioShare(null);
    setTab('feed');
  };

  const openCompose = () => {
    setComposePortfolioShare(null);
    setComposeOpen(true);
  };

  const sharePortfolioAsPost = (portfolio) => {
    const share = buildPortfolioShare(portfolio, '1M');
    if (!share) return;
    setComposePortfolioShare(share);
    setComposeOpen(true);
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
    resetScroll();
    setFeedMode(mode);
    setSelectedPostId(null);
    setTab('feed');
  };

  const openStock = (ticker) => {
    resetScroll();
    setSelectedTicker(ticker);
    setSelectedFundId(null);
    setSelectedPostId(null);
    setTab('markets');
  };

  const openFund = (fundId) => {
    resetScroll();
    setSelectedFundId(fundId);
    setSelectedTicker(null);
    setSelectedPostId(null);
    setTab('markets');
  };

  const openPost = (postId) => {
    resetScroll();
    setSelectedPostId(postId);
    setTab('feed');
  };

  const openSettings = () => {
    resetScroll();
    setSelectedPostId(null);
    setSettingsReturnTab(tab === 'settings' ? settingsReturnTab : tab);
    setTab('settings');
  };

  const goHome = () => {
    resetScroll();
    setSelectedPostId(null);
    setSelectedTicker(null);
    setSelectedFundId(null);
    setProfilePortfolioId(null);
    setTab('feed');
  };

  const openProfile = (userId) => {
    if (!userId) return;
    resetScroll();
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
    resetScroll();
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

  const handleLogout = async () => {
    await signOutFromSupabase();
    clearSession();
    clearSocialGraph();
    clearWatchlists();
    clearReviewStore();
    setAuthUser(null);
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
            : authView === 'app' && tab === 'markets' && selectedTicker
              ? STOCKS[selectedTicker]?.name ?? selectedTicker
            : undefined;

  const mobileBack = useMemo(() => {
    if (authView !== 'app') return null;
    if (selectedPostId && tab === 'feed') {
      return { label: 'Back', onBack: () => { backScroll(); setSelectedPostId(null); } };
    }
    if (tab === 'markets' && selectedFundId) {
      return { label: 'Markets', onBack: () => { backScroll(); setSelectedFundId(null); } };
    }
    if (tab === 'markets' && selectedTicker) {
      return { label: 'Markets', onBack: () => { backScroll(); setSelectedTicker(null); } };
    }
    if (tab === 'profile' && profilePortfolioId) {
      return { label: 'Portfolios', onBack: () => { backScroll(); setProfilePortfolioId(null); } };
    }
    if (tab === 'profile' && profileMode === 'public') {
      if (profileUserId === CURRENT_USER.id) {
        return null;
      }
      return {
        label: 'Back',
        onBack: () => {
          backScroll();
          setTab(profileReturnTab || 'feed');
        },
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
    backScroll,
  ]);

  if (authView === 'bootstrapping') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-pe-canvas text-sm text-pe-text-secondary">
        Loading…
      </div>
    );
  }

  if (authView === 'landing') {
    return <HomePage />;
  }

  if (authView === 'onboarding') {
    return (
      <OnboardingFlow
        userId={authUser?.id}
        onComplete={() => setAuthView('app')}
      />
    );
  }

  return (
    <>
      <Shell
        tab={tab}
        feedMode={feedMode}
        pageTitleOverride={pageTitleOverride}
        mobileBack={mobileBack}
        activityUnread={activityUnread}
        routeKey={routeKey}
        scrollAction={scrollAction}
        onScrollActionConsumed={consumeScrollAction}
        onTabChange={handleTabChange}
        onFeedModeChange={setFeedModeAndStay}
        onProfile={() => {
          resetScroll();
          setSelectedPostId(null);
          setProfileMode('own');
          setProfileUserId(CURRENT_USER.id);
          setProfileReturnTab(tab === 'profile' || tab === 'settings' ? profileReturnTab : tab);
          setTab('profile');
        }}
        onSettings={openSettings}
        onGoHome={goHome}
        onCompose={openCompose}
      >
        {tab === 'feed' &&
          (selectedPostId ? (
            <PostDetailPage
              postId={selectedPostId}
              posts={posts}
              onBack={() => {
                backScroll();
                setSelectedPostId(null);
              }}
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
            onSharePortfolio={sharePortfolioAsPost}
          />
        )}
        {tab === 'markets' &&
          (selectedFundId ? (
            <InvestmentPage
              fundId={selectedFundId}
              onBack={() => {
                backScroll();
                setSelectedFundId(null);
              }}
              onOpenProfile={openProfile}
              onGraphChange={() => setGraphTick((n) => n + 1)}
              onPromptReview={() => {
                setFundReviewPrefill(selectedFundId);
                setFundReviewOpen(true);
              }}
            />
          ) : selectedTicker ? (
            <StockInvestmentPage
              ticker={selectedTicker}
              onBack={() => {
                backScroll();
                setSelectedTicker(null);
              }}
              onOpenProfile={openProfile}
              onGraphChange={() => setGraphTick((n) => n + 1)}
              onPromptReview={() => {
                setFundReviewPrefill(null);
                setFundReviewOpen(true);
              }}
            />
          ) : (
            <MarketsPage
              onSelectStock={openStock}
              onSelectFund={openFund}
            />
          ))}
        {tab === 'profile' && (
          <ProfilePage
            mode={profileMode}
            userId={profileUserId}
            posts={posts}
            selectedPortfolioId={profilePortfolioId}
            onSelectPortfolio={(id) => {
              resetScroll();
              setProfilePortfolioId(id);
            }}
            onClearPortfolio={() => {
              backScroll();
              setProfilePortfolioId(null);
            }}
            onBack={() => {
              backScroll();
              setTab(profileReturnTab || 'feed');
            }}
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
        {tab === 'settings' && (
          <SettingsPage onLogout={handleLogout} />
        )}
      </Shell>

      <ComposeModal
        open={composeOpen}
        portfolioShare={composePortfolioShare}
        onClose={() => {
          setComposeOpen(false);
          setComposePortfolioShare(null);
        }}
        onPost={handlePost}
      />

      <FundReviewModal
        open={fundReviewOpen}
        prefillFundId={fundReviewPrefill}
        onClose={() => {
          setFundReviewOpen(false);
          setFundReviewPrefill(null);
        }}
        onSubmitted={() => {
          setFundReviewOpen(false);
          setFundReviewPrefill(null);
        }}
      />
    </>
  );
}
