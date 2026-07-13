import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ComposeModal from './components/ComposeModal';
import Shell from './components/Shell';
import FeedPage from './pages/FeedPage';
import HomePage from './pages/HomePage';
import FundReviewModal from './components/FundReviewModal';
import { RouteFallbackSkeleton } from './components/PageSkeletons';
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
import { CURRENT_USER, getPerson, STOCKS } from './data/mockData';
import { getFund } from './data/fundData';
import { bootstrapSocialApp, ensureSocialProfile } from './lib/socialProfileApi';
import { isProductionApp } from './lib/appMode';
import { flushDemoLocalData } from './lib/flushDemoLocalData';
import {
  getAppCurrentUser,
  setSelfProfile,
  warmPostAuthors,
} from './lib/socialIdentity';
import {
  addPostComment,
  buildOptimisticPostComment,
  createPost,
  fetchFeedPosts,
  fetchPost,
  mapPostRow,
  notePostLikeSynced,
  togglePostLike,
  usePostBackend,
} from './lib/socialPostApi';
import { hydrateCommunityAccess } from './lib/reviewStore';
import { clearCachedFeedPosts, readCachedFeedPosts, writeCachedFeedPosts } from './lib/feedCache';
import { clearCachedBootstrap, readCachedBootstrap, writeCachedBootstrap } from './lib/bootstrapCache';
import { peekCachedAuthSession } from './lib/peekAuthSession';
import { parseAppPath, commodityPath, etfPath, fundPath, indexPath, postPath, stockPath, tabPath } from './lib/routes';
import {
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
  if (cached?.user && cached.view === 'onboarding') {
    return { authView: 'onboarding', authUser: cached.user };
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
  const [fundReviewOpen, setFundReviewOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [profileMode, setProfileMode] = useState('own');
  const [profileUserId, setProfileUserId] = useState(CURRENT_USER.id);
  const [profileReturnTab, setProfileReturnTab] = useState('feed');
  const [settingsReturnTab, setSettingsReturnTab] = useState('feed');
  const [fundReviewPrefill, setFundReviewPrefill] = useState(null);
  const [profilePortfolioId, setProfilePortfolioId] = useState(null);
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
  });

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

  useEffect(() => {
    if (authView !== 'app' || !authUser?.id) {
      setSelfProfile(null);
      setProfileReady(true);
      setPostsLoading(false);
      return;
    }

    let cancelled = false;
    const bootCache = readCachedBootstrap();
    const hasCachedProfile = Boolean(bootCache?.profile);
    const hasCachedFeed =
      (bootCache?.posts?.length ?? 0) > 0 || (readCachedFeedPosts()?.length ?? 0) > 0;
    if (!hasCachedProfile) setProfileReady(false);
    if (!hasCachedFeed) setPostsLoading(true);
    if (bootCache?.profile) {
      setSocialProfile(bootCache.profile);
      setSelfProfile(bootCache.profile);
      setProfileReady(true);
    }
    if (bootCache?.posts?.length) {
      // Warm author profiles before first paint so cards don't flash "Member".
      warmPostAuthors(bootCache.posts)
        .catch(() => {})
        .finally(() => {
          if (cancelled) return;
          setPosts(bootCache.posts);
          setPostsLoading(false);
        });
    }

    hydrateCommunityAccess().catch(() => {});

    const applyProfile = (profile) => {
      if (cancelled) return;
      if (isProductionApp()) flushDemoLocalData();
      setSocialProfile(profile);
      setSelfProfile(profile);
      setProfileReady(true);
    };

    const applyFeed = async (items, profileForCache) => {
      if (cancelled) return;
      await warmPostAuthors(items).catch(() => {});
      if (cancelled) return;
      setPosts(items);
      writeCachedFeedPosts(items);
      if (profileForCache) {
        writeCachedBootstrap({ profile: profileForCache, posts: items });
      }
      setPostsLoading(false);
    };

    if (usePostBackend()) {
      bootstrapSocialApp({ feedLimit: 50 })
        .then(async ({ profile, feed }) => {
          applyProfile(profile);
          const nextPosts = (feed?.items ?? []).map((row) => {
            const post = mapPostRow(row);
            notePostLikeSynced(post.id, post.liked);
            return post;
          });
          await applyFeed(nextPosts, profile);
        })
        .catch(async () => {
          // Fallback to separate calls if bootstrap RPC is unavailable.
          let profile = null;
          try {
            profile = await ensureSocialProfile();
            applyProfile(profile);
          } catch {
            if (!cancelled) {
              setSocialProfile(null);
              setSelfProfile(null);
              setProfileReady(true);
            }
          }
          try {
            const items = await fetchFeedPosts();
            await applyFeed(items, profile);
          } catch {
            await applyFeed([], profile);
          }
        });
    } else {
      ensureSocialProfile()
        .then((profile) => {
          applyProfile(profile);
          writeCachedBootstrap({ profile, posts: readCachedFeedPosts() ?? [] });
        })
        .catch(() => {
          if (!cancelled) {
            setSocialProfile(null);
            setSelfProfile(null);
            setProfileReady(true);
          }
        });
      setPostsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [authView, authUser?.id]);

  const activityItems = useMemo(
    () => getActivityFeed(),
    [activityTick, posts, graphTick]
  );
  const activityUnread = getUnreadActivityCount(activityItems);

  useEffect(() => {
    if (tab === 'activity') markAllActivityRead(activityItems);
  }, [tab, activityItems]);

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

  const sharePortfolioAsPost = (portfolio) => {
    const share = buildPortfolioShare(portfolio, '1M');
    if (!share) return;
    setComposePortfolioShare(share);
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
        setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
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

  const closeMarketDetail = useCallback(() => {
    backScroll();
    clearMarketSelection();

    const ctx = marketReturnContextRef.current;
    marketReturnContextRef.current = null;

    if (!ctx || ctx.tab === 'markets') {
      setTab('markets');
      navigate(tabPath('markets'));
      return;
    }

    setTab(ctx.tab);
    setProfileUserId(ctx.profileUserId ?? currentUserId);
    setProfileMode(ctx.profileMode ?? 'own');
    setProfilePortfolioId(ctx.profilePortfolioId ?? null);
    setSelectedPostId(ctx.selectedPostId ?? null);

    if (ctx.tab === 'profile') {
      navigateToProfile(navigate, ctx.profileUserId ?? currentUserId, {
        portfolioId: ctx.profilePortfolioId ?? undefined,
      });
      return;
    }

    if (ctx.tab === 'feed' && ctx.selectedPostId) {
      navigate(postPath(ctx.selectedPostId));
      return;
    }

    navigate(tabPath(ctx.tab));
  }, [backScroll, navigate, currentUserId]);

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
    resetScroll();
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
    clearReviewStore();
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
      return { label: 'Back', onBack: () => { backScroll(); navigate(tabPath('feed')); } };
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
    if (tab === 'profile' && profilePortfolioId) {
      return {
        label: 'Portfolios',
        onBack: () => {
          if (portfolioBackRef.current) {
            portfolioBackRef.current(() => {
              backScroll();
              navigateToProfile(navigate, profileUserId);
            });
            return;
          }
          backScroll();
          navigateToProfile(navigate, profileUserId);
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
    selectedIndexId,
    selectedCommodityId,
    profileMode,
    profileUserId,
    profileReturnTab,
    profilePortfolioId,
    profileFollowListMode,
    backScroll,
    navigate,
    closeMarketDetail,
    getMarketBackLabel,
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
        {tab === 'feed' &&
          (selectedPostId ? (
            <RouteSuspense>
              <PostDetailPage
                postId={selectedPostId}
                posts={posts}
                onBack={() => {
                  backScroll();
                  navigate(tabPath('feed'));
                }}
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
          ))}
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
                onPromptReview={() => {
                  setFundReviewPrefill(null);
                  setFundReviewOpen(true);
                }}
              />
            </RouteSuspense>
          ) : selectedIndexId ? (
            <RouteSuspense>
              <IndexDetailPage
                indexId={selectedIndexId}
                onBack={closeMarketDetail}
                onOpenProfile={openProfile}
                onPromptReview={() => {
                  setFundReviewPrefill(null);
                  setFundReviewOpen(true);
                }}
              />
            </RouteSuspense>
          ) : selectedFundId ? (
            <RouteSuspense>
              <InvestmentPage
                fundId={selectedFundId}
                onBack={closeMarketDetail}
                onOpenProfile={openProfile}
                onGraphChange={() => setGraphTick((n) => n + 1)}
                onPromptReview={() => {
                  setFundReviewPrefill(selectedFundId);
                  setFundReviewOpen(true);
                }}
              />
            </RouteSuspense>
          ) : selectedTicker ? (
            <RouteSuspense>
              <StockInvestmentPage
                ticker={selectedTicker}
                onBack={closeMarketDetail}
                onOpenProfile={openProfile}
                onGraphChange={() => setGraphTick((n) => n + 1)}
                onPromptReview={() => {
                  setFundReviewPrefill(null);
                  setFundReviewOpen(true);
                }}
              />
            </RouteSuspense>
          ) : (
            <RouteSuspense>
              <MarketsPage
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
