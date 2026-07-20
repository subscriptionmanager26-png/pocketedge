import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ComposeModal from './components/ComposeModal';
import Shell from './components/Shell';
import FeedPage from './pages/FeedPage';
import HomePage from './pages/HomePage';
import { RouteFallbackSkeleton } from './components/PageSkeletons';
import { getActivityFeed } from './lib/activityFeed';
import {
  getUnreadActivityCount,
  markActivityRead,
  markAllActivityRead,
  subscribeActivity,
} from './lib/activityStore';
import {
  clearSocialGraph,
  getMyRecentFollowerEvents,
  hydrateMyFollowing,
  subscribeSocialGraph,
} from './lib/socialGraphStore';
import {
  clearSession,
  resolveAuthViewForUserAsync,
  skipAuthForDev,
} from './lib/sessionStore';
import { cleanOAuthCallbackUrl, ensureSupabase, isSupabaseConfigured, shouldLoadSupabaseEarly, signOutFromSupabase } from './lib/supabase';
import { identifyPostHogUser, resetPostHogUser } from './lib/posthog';
import { clearWatchlists } from './lib/watchlistStore';
import { CURRENT_USER, getPerson, STOCKS } from './data/mockData';
import { getFund } from './data/fundData';
import { isProductionApp } from './lib/appMode';
import { startAppBootstrap } from './lib/appBootstrap';
import {
  getAppCurrentUser,
  resolvePeople,
  setSelfProfile,
  getHandleForUserIdSync,
} from './lib/socialIdentity';
import {
  addPostComment,
  buildOptimisticPostComment,
  createPost,
  fetchPost,
  togglePostLike,
  usePostBackend,
} from './lib/socialPostApi';
import { clearCachedFeedPosts, readCachedFeedPosts, writeCachedFeedPosts } from './lib/feedCache';
import { clearCachedBootstrap, readCachedBootstrap } from './lib/bootstrapCache';
import { peekCachedAuthSession } from './lib/peekAuthSession';
import { markAuthReady, markTabPaint } from './lib/perfMarks';
import { parseAppPath, commodityPath, etfPath, fundPath, indexPath, postPath, profilePath, stockPath, tabPath } from './lib/routes';
import {
  navigateBack,
  navigateToProfile,
  navigateToTab,
  useProfileRouting,
} from './lib/useProfileRouting';

const ActivityPage = lazy(() => import('./pages/ActivityPage'));
const OnboardingFlow = lazy(() => import('./pages/onboarding/OnboardingFlow'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const MarketsPage = lazy(() => import('./pages/MarketsPage'));
const InvestmentPage = lazy(() => import('./pages/InvestmentPage'));
const StockInvestmentPage = lazy(() => import('./pages/StockInvestmentPage'));
const IndexDetailPage = lazy(() => import('./pages/IndexDetailPage'));
const CommodityDetailPage = lazy(() => import('./pages/CommodityDetailPage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const PostDetailPage = lazy(() => import('./pages/PostDetailPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage'));

function RouteSuspense({ children }) {
  return <Suspense fallback={<RouteFallbackSkeleton />}>{children}</Suspense>;
}

function initialAuthState() {
  const cached = peekCachedAuthSession();
  if (cached?.user && cached.view === 'app') {
    return { authView: 'app', authUser: cached.user };
  }
  // Do not paint onboarding from a stale local guess — domain moves clear
  // localStorage while the account may already have a portfolio.
  if (cached?.user) {
    return { authView: 'bootstrapping', authUser: cached.user };
  }
  return { authView: 'bootstrapping', authUser: null };
}

function initialBootstrapState() {
  const boot = readCachedBootstrap();
  const feed = boot?.posts?.length ? boot.posts : readCachedFeedPosts();
  return {
    posts: feed ?? [],
    postsLoading: !(feed && feed.length > 0),
    socialProfile: boot?.profile ?? null,
    profileReady: Boolean(boot?.profile),
  };
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialAuth = useMemo(() => initialAuthState(), []);
  const initialBoot = useMemo(() => initialBootstrapState(), []);
  const [authView, setAuthView] = useState(initialAuth.authView);
  const [authUser, setAuthUser] = useState(initialAuth.authUser);
  const [tab, setTab] = useState('feed');
  const [feedMode, setFeedMode] = useState('forYou');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composePortfolioShare, setComposePortfolioShare] = useState(null);
  const [posts, setPosts] = useState(initialBoot.posts);
  const [postsLoading, setPostsLoading] = useState(initialBoot.postsLoading);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [selectedTickerKind, setSelectedTickerKind] = useState('stock');
  const [selectedFundId, setSelectedFundId] = useState(null);
  const [selectedIndexId, setSelectedIndexId] = useState(null);
  const [selectedCommodityId, setSelectedCommodityId] = useState(null);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [profileMode, setProfileMode] = useState('own');
  const [profileUserId, setProfileUserId] = useState(CURRENT_USER.id);
  const [profileReturnTab, setProfileReturnTab] = useState('feed');
  const [settingsReturnTab, setSettingsReturnTab] = useState('feed');
  const [profilePortfolioId, setProfilePortfolioId] = useState(null);
  const [profileSeedPerson, setProfileSeedPerson] = useState(null);
  const [marketsSectionTab, setMarketsSectionTab] = useState('stocks');
  const [profileFollowListMode, setProfileFollowListMode] = useState(null);
  const [mobileHeaderActions, setMobileHeaderActions] = useState(null);
  const portfolioBackRef = useRef(null);
  const followListBackRef = useRef(null);
  const marketReturnContextRef = useRef(null);
  const [activityTick, setActivityTick] = useState(0);
  const [graphTick, setGraphTick] = useState(0);
  const [scrollAction, setScrollAction] = useState('reset');
  const [profileReady, setProfileReady] = useState(initialBoot.profileReady);
  const [socialProfile, setSocialProfile] = useState(initialBoot.socialProfile);
  const currentUserId = socialProfile?.user_id ?? CURRENT_USER.id;

  const resetScroll = useCallback(() => setScrollAction('reset'), []);
  const backScroll = useCallback(() => setScrollAction('back'), []);
  const consumeScrollAction = useCallback(() => setScrollAction('reset'), []);

  const routeKey = useMemo(() => {
    if (tab === 'feed' && selectedPostId) return `post:${selectedPostId}`;
    if (tab === 'feed') return 'feed';
    if (tab === 'markets' && selectedCommodityId) return `commodity:${selectedCommodityId}`;
    if (tab === 'markets' && selectedIndexId) return `index:${selectedIndexId}`;
    if (tab === 'markets' && selectedFundId) return `fund:${selectedFundId}`;
    if (tab === 'markets' && selectedTicker) return `stock:${selectedTicker}`;
    if (tab === 'profile' && profilePortfolioId) {
      return `profile:${profileUserId}:portfolio:${profilePortfolioId}`;
    }
    if (tab === 'profile' && profileMode === 'public' && profileUserId !== currentUserId) {
      return `profile:${profileUserId}:public`;
    }
    if (tab === 'profile') return `profile:${profileUserId}`;
    return tab;
  }, [
    tab,
    selectedPostId,
    selectedFundId,
    selectedIndexId,
    selectedCommodityId,
    selectedTicker,
    profilePortfolioId,
    profileMode,
    profileUserId,
    currentUserId,
  ]);

  useProfileRouting({
    authView,
    profileReady,
    tab,
    profileUserId,
    profilePortfolioId,
    selectedPostId,
    selectedTicker,
    selectedTickerKind,
    selectedFundId,
    selectedIndexId,
    selectedCommodityId,
    setTab,
    setProfileUserId,
    setProfilePortfolioId,
    setProfileMode,
    setSelectedPostId,
    setSelectedTicker,
    setSelectedTickerKind,
    setSelectedFundId,
    setSelectedIndexId,
    setSelectedCommodityId,
    onProfileResolved: setProfileSeedPerson,
  });

  useEffect(() => subscribeActivity(() => setActivityTick((n) => n + 1)), []);
  useEffect(() => subscribeSocialGraph(() => setGraphTick((n) => n + 1)), []);

  // Own profile must use the live auth UUID, not demo CURRENT_USER.id (`u_me`).
  useEffect(() => {
    const liveId = socialProfile?.user_id;
    if (!liveId) return;
    if (profileUserId === CURRENT_USER.id || profileUserId === 'u_me') {
      setProfileUserId(liveId);
    }
  }, [socialProfile?.user_id, profileUserId]);

  useEffect(() => {
    if (skipAuthForDev()) {
      setAuthUser({ id: 'u_me', email: 'demo@pocketedge.in' });
      setAuthView('app');
      return undefined;
    }

    if (!isSupabaseConfigured()) {
      setAuthView('landing');
      return undefined;
    }

    let cancelled = false;
    let subscription = null;

    const bootAuth = async () => {
      if (!shouldLoadSupabaseEarly()) {
        setAuthView('landing');
        return;
      }

      const client = await ensureSupabase();
      if (cancelled || !client) {
        if (!cancelled) setAuthView('landing');
        return;
      }

      cleanOAuthCallbackUrl();

      let authGen = 0;
      const syncAuth = (session) => {
        if (cancelled) return;
        const user = session?.user ?? null;
        setAuthUser(user);
        if (user) {
          identifyPostHogUser(user);
          markAuthReady();
          const gen = ++authGen;
          setAuthView('bootstrapping');
          resolveAuthViewForUserAsync(user).then((view) => {
            if (cancelled || gen !== authGen) return;
            setAuthView(view);
          });
        } else {
          authGen += 1;
          resetPostHogUser();
          setAuthView('landing');
        }
      };

      const { data: { session } } = await client.auth.getSession();
      syncAuth(session);

      const { data: { subscription: sub } } = client.auth.onAuthStateChange((_event, session) => {
        cleanOAuthCallbackUrl();
        syncAuth(session);
      });
      subscription = sub;
    };

    bootAuth();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authView !== 'app' || !authUser?.id) {
      setSelfProfile(null);
      setProfileReady(true);
      setPostsLoading(false);
      return;
    }

    let cancelled = false;
    const cancelledRef = { current: false };
    startAppBootstrap({
      authUserId: authUser.id,
      cancelledRef,
      setSocialProfile,
      setSelfProfile,
      setProfileReady,
      setPosts,
      setPostsLoading,
    });

    return () => {
      cancelled = true;
      cancelledRef.current = true;
    };
  }, [authView, authUser?.id]);

  useEffect(() => {
    if (authView !== 'app') return;
    if (tab === 'markets' || tab === 'portfolio' || tab === 'profile') {
      markTabPaint(tab);
    }
  }, [authView, tab]);

  const activityItems = useMemo(
    () => getActivityFeed(),
    [activityTick, posts, graphTick]
  );
  const activityUnread = getUnreadActivityCount(activityItems);

  useEffect(() => {
    if (tab === 'activity') markAllActivityRead(activityItems);
  }, [tab, activityItems]);

  useEffect(() => {
    if (authView !== 'app' || tab !== 'activity') return undefined;
    let cancelled = false;
    hydrateMyFollowing()
      .then(() => {
        if (cancelled) return null;
        const followerIds = getMyRecentFollowerEvents().map((event) => event.followerId);
        if (followerIds.length) return resolvePeople(followerIds);
        return null;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authView, tab, authUser?.id]);

  const handlePost = async ({ body, image, portfolioShare }) => {
    const me = getAppCurrentUser();

    if (usePostBackend()) {
      try {
        const post = await createPost({
          body: body || '',
          image,
          portfolioShare,
          via: {
            kind: 'person',
            label: `@${me.handle}`,
            reason: portfolioShare ? 'shared a portfolio' : 'you posted',
          },
          topics: [],
        });
        setPosts((prev) => [post, ...prev]);
        setSelectedPostId(null);
        setComposePortfolioShare(null);
        setTab('feed');
        navigate(tabPath('feed'));
      } catch (err) {
        console.error('createPost failed', err);
      }
      return;
    }

    const post = {
      id: `p_local_${Date.now()}`,
      authorId: currentUserId,
      type: portfolioShare ? 'portfolio' : image ? 'image' : 'text',
      body: body || '',
      image: image ?? null,
      portfolioShare: portfolioShare ?? null,
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: [],
      via: {
        kind: 'person',
        label: `@${me.handle}`,
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

  const handleAddComment = async (postId, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (usePostBackend()) {
      const optimistic = buildOptimisticPostComment(trimmed);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, comments: [...(p.comments ?? []), optimistic], commentCount: (p.commentCount ?? p.comments?.length ?? 0) + 1 }
            : p
        )
      );
      try {
        const updated = await addPostComment(postId, trimmed);
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id !== postId) return p;
            // addPostComment may return a full post, or a partial merge on reload failure.
            if (updated?.authorId || updated?.body != null || updated?.type) {
              return updated;
            }
            const comments = updated?.comments?.length
              ? updated.comments
              : [...(p.comments ?? []).filter((c) => c.id !== optimistic.id), ...(updated?.comments ?? [])];
            return {
              ...p,
              comments,
              commentCount: Math.max(
                comments.length,
                Number(updated?.commentCount) || 0,
                Number(p.commentCount) || 0
              ),
            };
          })
        );
      } catch (err) {
        console.error('addPostComment failed', err);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  comments: (p.comments ?? []).filter((c) => c.id !== optimistic.id),
                  commentCount: Math.max(0, (p.commentCount ?? p.comments?.length ?? 1) - 1),
                }
              : p
          )
        );
      }
      return;
    }

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const comment = {
          id: `c_${Date.now()}`,
          authorId: currentUserId,
          body: trimmed,
          createdAt: new Date().toISOString(),
        };
        return { ...p, comments: [...(p.comments ?? []), comment] };
      })
    );
  };

  const handleTogglePostLike = (postId) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const { liked, likes } = togglePostLike(postId, {
          liked: p.liked ?? false,
          likes: p.likes ?? 0,
        });
        return { ...p, liked, likes };
      })
    );
  };

  const setFeedModeAndStay = (mode) => {
    resetScroll();
    setFeedMode(mode);
    setSelectedPostId(null);
    setTab('feed');
  };

  const clearMarketSelection = () => {
    setSelectedTicker(null);
    setSelectedTickerKind('stock');
    setSelectedFundId(null);
    setSelectedIndexId(null);
    setSelectedCommodityId(null);
  };

  const MARKET_RETURN_LABELS = {
    feed: 'Feed',
    search: 'Search',
    activity: 'Activity',
    portfolio: 'Portfolio',
    markets: 'Markets',
  };

  const captureMarketReturnContext = useCallback(() => {
    const onMarketDetail =
      tab === 'markets' &&
      Boolean(selectedTicker || selectedFundId || selectedIndexId || selectedCommodityId);

    marketReturnContextRef.current = onMarketDetail
      ? { tab: 'markets' }
      : {
          tab,
          profileUserId,
          profilePortfolioId,
          profileMode,
          selectedPostId,
        };
  }, [
    tab,
    selectedTicker,
    selectedFundId,
    selectedIndexId,
    selectedCommodityId,
    profileUserId,
    profilePortfolioId,
    profileMode,
    selectedPostId,
  ]);

  const getMarketBackLabel = useCallback(() => {
    const ctx = marketReturnContextRef.current;
    if (!ctx || ctx.tab === 'markets') return 'Markets';
    return MARKET_RETURN_LABELS[ctx.tab] ?? 'Back';
  }, []);

  const profileBackFallback = useCallback(() => {
    const handle = getHandleForUserIdSync(profileUserId);
    return handle ? profilePath(handle) : tabPath(profileReturnTab || 'feed');
  }, [profileUserId, profileReturnTab]);

  const closeMarketDetail = useCallback(() => {
    backScroll();
    marketReturnContextRef.current = null;
    navigateBack(navigate, location, tabPath('markets'));
  }, [backScroll, location, navigate]);

  const closePost = useCallback(() => {
    backScroll();
    navigateBack(navigate, location, tabPath('feed'));
  }, [backScroll, location, navigate]);

  const openFund = (fundId) => {
    captureMarketReturnContext();
    resetScroll();
    clearMarketSelection();
    setSelectedFundId(String(fundId ?? '').trim());
    setSelectedPostId(null);
    setTab('markets');
    navigate(fundPath(fundId));
  };

  const openStock = (ticker, { kind = 'stock', assetType } = {}) => {
    const key = String(ticker ?? '').trim();
    const resolvedKind = assetType || kind;
    // Portfolio holdings use AMFI scheme codes for mutual funds — never open as stocks.
    if (resolvedKind === 'fund' || /^\d{6,}$/.test(key)) {
      openFund(key);
      return;
    }
    captureMarketReturnContext();
    resetScroll();
    clearMarketSelection();
    setSelectedTicker(key);
    setSelectedTickerKind(resolvedKind === 'etf' ? 'etf' : 'stock');
    setSelectedPostId(null);
    setTab('markets');
    navigate(resolvedKind === 'etf' ? etfPath(key) : stockPath(key));
  };

  const openIndex = (indexId) => {
    captureMarketReturnContext();
    resetScroll();
    clearMarketSelection();
    setSelectedIndexId(indexId);
    setSelectedPostId(null);
    setTab('markets');
    navigate(indexPath(indexId));
  };

  const openCommodity = (commodityId) => {
    captureMarketReturnContext();
    resetScroll();
    clearMarketSelection();
    setSelectedCommodityId(commodityId);
    setSelectedPostId(null);
    setTab('markets');
    navigate(commodityPath(commodityId));
  };

  const openPost = (postId) => {
    clearMarketSelection();
    setSelectedPostId(postId);
    setTab('feed');
    navigate(postPath(postId));
  };

  const openSettings = () => {
    resetScroll();
    setSelectedPostId(null);
    setSettingsReturnTab(tab === 'settings' ? settingsReturnTab : tab);
    setTab('settings');
    navigateToTab(navigate, 'settings');
  };

  const goHome = () => {
    resetScroll();
    setSelectedPostId(null);
    setSelectedTicker(null);
    setSelectedFundId(null);
    setSelectedIndexId(null);
    setSelectedCommodityId(null);
    setProfilePortfolioId(null);
    setTab('feed');
    navigateToTab(navigate, 'feed');
  };

  const openProfile = (userId) => {
    if (!userId) return;
    resetScroll();
    setSelectedPostId(null);
    setProfilePortfolioId(null);
    if (userId === currentUserId) {
      setProfileUserId(currentUserId);
      setProfileMode('own');
      setProfileReturnTab(tab === 'profile' || tab === 'settings' ? profileReturnTab : tab);
      setTab('profile');
      navigateToProfile(navigate, userId);
      return;
    }
    setProfileReturnTab(tab === 'profile' ? profileReturnTab : tab);
    setProfileUserId(userId);
    setProfileMode('public');
    setTab('profile');
    navigateToProfile(navigate, userId);
  };

  const openProfilePortfolio = (userId, portfolioId) => {
    if (!userId || !portfolioId) return;
    resetScroll();
    setSelectedPostId(null);
    setProfileReturnTab(tab === 'profile' || tab === 'settings' ? profileReturnTab : tab);
    setProfileUserId(userId);
    setProfileMode(userId === currentUserId ? 'own' : 'public');
    setProfilePortfolioId(portfolioId);
    setTab('profile');
    navigateToProfile(navigate, userId, { portfolioId });
  };

  const handleTabChange = (next) => {
    resetScroll();
    setTab(next);
    setSelectedPostId(null);
    setProfilePortfolioId(null);
    if (next === 'markets') {
      setMarketsSectionTab('stocks');
    }
    if (next !== 'markets') {
      clearMarketSelection();
    }
    if (next === 'profile') {
      setProfileMode('own');
      setProfileUserId(currentUserId);
      setProfileReturnTab(next);
      navigateToProfile(navigate, currentUserId);
      return;
    }
    navigateToTab(navigate, next);
  };

  const handleLogout = async () => {
    await signOutFromSupabase();
    clearSession();
    clearSocialGraph();
    clearWatchlists();
    clearCachedBootstrap();
    clearCachedFeedPosts();
    setSocialProfile(null);
    setSelfProfile(null);
    setProfileReady(false);
    setAuthUser(null);
    setAuthView('landing');
    setTab('feed');
    setPosts([]);
    setPostsLoading(false);
  };

  const pageTitleOverride =
    authView === 'app' && tab === 'settings'
      ? 'Settings'
      : authView === 'app' && selectedPostId && tab === 'feed'
        ? 'Post'
        : authView === 'app' && tab === 'activity'
          ? 'Activity'
          : authView === 'app' && tab === 'profile' && profileMode === 'public'
            ? getPerson(profileUserId)?.name
          : authView === 'app' && tab === 'markets' && selectedCommodityId
            ? selectedCommodityId
          : authView === 'app' && tab === 'markets' && selectedIndexId
            ? selectedIndexId
          : authView === 'app' && tab === 'markets' && selectedFundId
            ? getFund(selectedFundId)?.name ?? 'Fund'
            : authView === 'app' && tab === 'markets' && selectedTicker
              ? STOCKS[selectedTicker]?.name ?? selectedTicker
            : undefined;

  const mobileBack = useMemo(() => {
    if (authView !== 'app') return null;
    if (selectedPostId && tab === 'feed') {
      return { label: 'Back', onBack: closePost };
    }
    if (tab === 'markets' && selectedCommodityId) {
      return { label: getMarketBackLabel(), onBack: closeMarketDetail };
    }
    if (tab === 'markets' && selectedIndexId) {
      return { label: getMarketBackLabel(), onBack: closeMarketDetail };
    }
    if (tab === 'markets' && selectedFundId) {
      return { label: getMarketBackLabel(), onBack: closeMarketDetail };
    }
    if (tab === 'markets' && selectedTicker) {
      return { label: getMarketBackLabel(), onBack: closeMarketDetail };
    }
    if (tab === 'profile' && profileFollowListMode) {
      return {
        label: 'Back',
        onBack: () => {
          backScroll();
          followListBackRef.current?.();
        },
      };
    }
    if (tab === 'settings') {
      return {
        label: MARKET_RETURN_LABELS[settingsReturnTab] ?? 'Back',
        onBack: () => {
          backScroll();
          navigateBack(navigate, location, tabPath(settingsReturnTab || 'feed'));
        },
      };
    }
    if (tab === 'profile' && profilePortfolioId) {
      return {
        label: 'Portfolios',
        onBack: () => {
          const goBack = () => {
            backScroll();
            navigateBack(navigate, location, profileBackFallback());
          };
          if (portfolioBackRef.current) {
            portfolioBackRef.current(goBack);
            return;
          }
          goBack();
        },
      };
    }
    if (tab === 'profile' && profileMode === 'public') {
      if (profileUserId === currentUserId) {
        return null;
      }
      return {
        label: 'Back',
        onBack: () => {
          backScroll();
          navigateBack(navigate, location, tabPath(profileReturnTab || 'feed'));
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
    selectedIndexId,
    selectedCommodityId,
    profileMode,
    profileUserId,
    profileReturnTab,
    profilePortfolioId,
    profileFollowListMode,
    settingsReturnTab,
    backScroll,
    closePost,
    navigate,
    location,
    profileBackFallback,
    closeMarketDetail,
    getMarketBackLabel,
    currentUserId,
  ]);

  useEffect(() => {
    if (tab !== 'profile') {
      setMobileHeaderActions(null);
      setProfileFollowListMode(null);
    }
  }, [tab]);

  if (authView === 'bootstrapping') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-pe-canvas px-6">
        <div className="h-9 w-9 rounded-[10px] bg-pe-accent" aria-hidden="true" />
        <p className="text-[13px] font-semibold tracking-wide text-pe-text-muted">PocketEdge</p>
        <div className="h-0.5 w-[120px] overflow-hidden rounded-full bg-pe-surface" aria-hidden="true">
          <div className="h-full w-2/5 animate-pulse rounded-full bg-pe-accent" />
        </div>
      </div>
    );
  }

  if (authView === 'landing') {
    const parsed = parseAppPath(location.pathname);
    if (parsed.kind === 'profile' && parsed.username) {
      return (
        <RouteSuspense>
          <PublicProfilePage username={parsed.username} />
        </RouteSuspense>
      );
    }
    return <HomePage />;
  }

  if (authView === 'onboarding') {
    return (
      <RouteSuspense>
        <OnboardingFlow
          userId={authUser?.id}
          onComplete={() => setAuthView('app')}
        />
      </RouteSuspense>
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
          setProfileUserId(currentUserId);
          setProfileReturnTab(tab === 'profile' || tab === 'settings' ? profileReturnTab : tab);
          setTab('profile');
          navigateToProfile(navigate, currentUserId);
        }}
        onSettings={openSettings}
        onGoHome={goHome}
        onCompose={openCompose}
        mobileActions={mobileHeaderActions}
      >
        {tab === 'feed' && (
          selectedPostId ? (
            <RouteSuspense>
              <PostDetailPage
                postId={selectedPostId}
                posts={posts}
                onBack={closePost}
                onOpenProfile={openProfile}
                onAddComment={(text) => handleAddComment(selectedPostId, text)}
                onToggleLike={handleTogglePostLike}
                fetchPost={usePostBackend() ? fetchPost : null}
              />
            </RouteSuspense>
          ) : (
            <FeedPage
              posts={posts}
              feedMode={feedMode}
              graphTick={graphTick}
              loading={postsLoading}
              onGraphChange={() => setGraphTick((n) => n + 1)}
              onOpenProfile={openProfile}
              onOpenPost={openPost}
              onToggleLike={handleTogglePostLike}
            />
          )
        )}
        {tab === 'search' && (
          <RouteSuspense>
            <SearchPage
              onOpenProfile={openProfile}
              onSelectStock={openStock}
              onSelectFund={openFund}
              onSelectIndex={openIndex}
              onGraphChange={() => setGraphTick((n) => n + 1)}
            />
          </RouteSuspense>
        )}
        {tab === 'activity' && (
          <RouteSuspense>
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
          </RouteSuspense>
        )}
        {tab === 'portfolio' && (
          <RouteSuspense>
            <PortfolioPage
              onSelectStock={openStock}
              onSelectFund={openFund}
              onOpenProfile={openProfile}
              onOpenPost={openPost}
              onOpenSourcePortfolio={openProfilePortfolio}
            />
          </RouteSuspense>
        )}
        {tab === 'markets' &&
          (selectedCommodityId ? (
            <RouteSuspense>
              <CommodityDetailPage
                commodityId={selectedCommodityId}
                onBack={closeMarketDetail}
                onOpenProfile={openProfile}
              />
            </RouteSuspense>
          ) : selectedIndexId ? (
            <RouteSuspense>
              <IndexDetailPage
                indexId={selectedIndexId}
                onBack={closeMarketDetail}
                onOpenProfile={openProfile}
              />
            </RouteSuspense>
          ) : selectedFundId ? (
            <RouteSuspense>
              <InvestmentPage
                fundId={selectedFundId}
                onBack={closeMarketDetail}
                onOpenProfile={openProfile}
              />
            </RouteSuspense>
          ) : selectedTicker ? (
            <RouteSuspense>
              <StockInvestmentPage
                ticker={selectedTicker}
                onBack={closeMarketDetail}
                onOpenProfile={openProfile}
              />
            </RouteSuspense>
          ) : (
            <RouteSuspense>
              <MarketsPage
                sectionTab={marketsSectionTab}
                onSectionTabChange={setMarketsSectionTab}
                onSelectStock={openStock}
                onSelectFund={openFund}
                onSelectIndex={openIndex}
                onSelectCommodity={openCommodity}
              />
            </RouteSuspense>
          ))}
        {tab === 'profile' && (
          <RouteSuspense>
            <ProfilePage
              mode={profileMode}
              userId={profileUserId}
              initialPerson={
                profileSeedPerson?.id === profileUserId ? profileSeedPerson : null
              }
              posts={posts}
              selectedPortfolioId={profilePortfolioId}
              onSelectPortfolio={(id) => {
                resetScroll();
                setProfilePortfolioId(id);
                navigateToProfile(navigate, profileUserId, { portfolioId: id });
              }}
              onClearPortfolio={() => {
                backScroll();
                navigateBack(navigate, location, profileBackFallback());
              }}
              onBack={() => {
                backScroll();
                navigateBack(navigate, location, tabPath(profileReturnTab || 'feed'));
              }}
              onOpenPublicPreview={() => {
                setProfileUserId(currentUserId);
                setProfileMode('public');
              }}
              onExitPublicPreview={() => {
                setProfileUserId(currentUserId);
                setProfileMode('own');
              }}
              onOpenProfile={openProfile}
              onOpenPost={openPost}
              onGraphChange={() => setGraphTick((n) => n + 1)}
              onMobileHeaderActionsChange={setMobileHeaderActions}
              onRegisterPortfolioBackHandler={(handler) => {
                portfolioBackRef.current = handler;
              }}
              onFollowListModeChange={setProfileFollowListMode}
              onRegisterFollowListBackHandler={(handler) => {
                followListBackRef.current = handler;
              }}
              onOpenSourcePortfolio={openProfilePortfolio}
            />
          </RouteSuspense>
        )}
        {tab === 'settings' && (
          <RouteSuspense>
            <SettingsPage onLogout={handleLogout} />
          </RouteSuspense>
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
    </>
  );
}
