import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import ComposeModal from './components/ComposeModal';
import Shell from './components/Shell';
import FeedDesignPage from './pages/FeedDesignPage';
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
import { cleanOAuthCallbackUrl, ensureSupabase, isSupabaseConfigured, shouldLoadSupabaseEarly, signInWithGoogle, signOutFromSupabase } from './lib/supabase';
import { seedMarketAssetCache } from './lib/marketAssetSeed';
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
import { createDraftPortfolio } from './lib/socialPortfolioApi';
import {
  addPostComment,
  buildOptimisticPostComment,
  createPost,
  fetchPost,
  fetchPublicFeedPosts,
  fetchPublicPost,
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
import GuestSignInCta from './components/GuestSignInCta';

const ActivityPage = lazy(() => import('./pages/ActivityPage'));
const OnboardingFlow = lazy(() => import('./pages/onboarding/OnboardingFlow'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const InvestmentPage = lazy(() => import('./pages/InvestmentPage'));
const StockInvestmentPage = lazy(() => import('./pages/StockInvestmentPage'));
const IndexDetailPage = lazy(() => import('./pages/IndexDetailPage'));
const CommodityDetailPage = lazy(() => import('./pages/CommodityDetailPage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const PostDetailPage = lazy(() => import('./pages/PostDetailPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const IdeasPage = lazy(() => import('./pages/IdeasPage'));
const InsightsPage = lazy(() => import('./pages/marketing/InsightsPage'));
const BusinessModelPage = lazy(() => import('./pages/marketing/BusinessModelPage'));
const CompanyBriefPage = lazy(() => import('./pages/marketing/CompanyBriefPage'));
const ResourcesPage = lazy(() => import('./pages/marketing/ResourcesPage'));
const MfScreenerPage = lazy(() => import('./pages/marketing/MfScreenerPage'));
const EtfInavPage = lazy(() => import('./pages/marketing/EtfInavPage'));
const SgbTrackerPage = lazy(() => import('./pages/marketing/SgbTrackerPage'));
const DisclosuresPage = lazy(() => import('./pages/marketing/DisclosuresPage'));

function RouteSuspense({ children }) {
  return <Suspense fallback={<RouteFallbackSkeleton />}>{children}</Suspense>;
}

function MarketingRoute({ page, section, symbol }) {
  if (page === 'insights') return <InsightsPage />;
  if (page === 'business-model' && section === 'brief') return <CompanyBriefPage symbol={symbol} />;
  if (page === 'business-model' || page === 'learning') return <BusinessModelPage />;
  if (page === 'resources' && section === 'mf-screener') return <MfScreenerPage />;
  if (page === 'resources' && section === 'etf-inav') return <EtfInavPage />;
  if (page === 'resources' && section === 'sgb') return <SgbTrackerPage />;
  if (page === 'resources') return <ResourcesPage />;
  if (page === 'disclosures') return <DisclosuresPage section={section} />;
  return <HomePage />;
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
  // OAuth callback must wait for PKCE exchange before stripping ?code=.
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    if (url.searchParams.has('code') || url.searchParams.has('error')) {
      return { authView: 'bootstrapping', authUser: null };
    }
  }
  // Guests: paint landing immediately — no splash wait for Supabase.
  return { authView: 'landing', authUser: null };
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
  const [profileStartUpdateHoldings, setProfileStartUpdateHoldings] = useState(false);
  const [profileSeedPerson, setProfileSeedPerson] = useState(null);
  const [profileFollowListMode, setProfileFollowListMode] = useState(null);
  const [mobileHeaderActions, setMobileHeaderActions] = useState(null);
  const [assetPanelBack, setAssetPanelBack] = useState(null);
  const [assetDetailPanel, setAssetDetailPanel] = useState(null);
  const portfolioBackRef = useRef(null);
  const followListBackRef = useRef(null);
  const marketReturnContextRef = useRef(null);
  const [activityTick, setActivityTick] = useState(0);
  const [graphTick, setGraphTick] = useState(0);
  const [scrollAction, setScrollAction] = useState('reset');
  const [profileReady, setProfileReady] = useState(initialBoot.profileReady);
  const [socialProfile, setSocialProfile] = useState(initialBoot.socialProfile);
  const currentUserId = socialProfile?.user_id ?? authUser?.id ?? CURRENT_USER.id;

  const resetScroll = useCallback(() => setScrollAction('reset'), []);
  const backScroll = useCallback(() => setScrollAction('back'), []);
  const consumeScrollAction = useCallback(() => setScrollAction('reset'), []);

  const hasAssetDetail = Boolean(
    selectedTicker || selectedFundId || selectedIndexId || selectedCommodityId
  );

  const routeKey = useMemo(() => {
    if (tab === 'feed' && selectedPostId) return `post:${selectedPostId}`;
    if (tab === 'feed' && !hasAssetDetail) return 'feed';
    const panelSuffix = assetDetailPanel ? `:${assetDetailPanel}` : '';
    if (selectedCommodityId) {
      return `commodity:${selectedCommodityId}${panelSuffix}`;
    }
    if (selectedIndexId) {
      return `index:${selectedIndexId}${panelSuffix}`;
    }
    if (selectedFundId) {
      return `fund:${selectedFundId}${panelSuffix}`;
    }
    if (selectedTicker) {
      return `stock:${selectedTicker}${panelSuffix}`;
    }
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
    hasAssetDetail,
    assetDetailPanel,
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

  // Own profile must use the live auth UUID, not demo CURRENT_USER.id (`u_me` → @investor).
  useEffect(() => {
    const liveId = socialProfile?.user_id ?? authUser?.id;
    if (!liveId || liveId === 'u_me') return;
    if (profileUserId === CURRENT_USER.id || profileUserId === 'u_me') {
      setProfileUserId(liveId);
    }
  }, [socialProfile?.user_id, authUser?.id, profileUserId]);

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

      let authGen = 0;
      const syncAuth = (session) => {
        if (cancelled) return;
        const user = session?.user ?? null;
        setAuthUser(user);
        if (user) {
          identifyPostHogUser(user);
          markAuthReady();
          const gen = ++authGen;
          // Keep a cached 'app' view while re-validating so deep-link hydration
          // is not cancelled mid-flight by a bootstrapping flicker.
          setAuthView((prev) => (prev === 'app' || prev === 'onboarding' ? prev : 'bootstrapping'));
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

      // Exchange PKCE code before stripping it from the URL.
      const { data: { session } } = await client.auth.getSession();
      if (!cancelled) cleanOAuthCallbackUrl();
      syncAuth(session);

      const { data: { subscription: sub } } = client.auth.onAuthStateChange((_event, session) => {
        if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED' || _event === 'INITIAL_SESSION') {
          cleanOAuthCallbackUrl();
        }
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
    if (authView === 'landing') {
      setSelfProfile(null);
      setProfileReady(true);
      return undefined;
    }

    if (authView !== 'app' || !authUser?.id) {
      setSelfProfile(null);
      setProfileReady(true);
      setPostsLoading(false);
      return undefined;
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

  // Guest landing: public For You feed inside the same Shell frame.
  useEffect(() => {
    if (authView !== 'landing') return undefined;
    if (!isSupabaseConfigured() || skipAuthForDev()) {
      setPostsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setPostsLoading(true);
    fetchPublicFeedPosts()
      .then((next) => {
        if (cancelled) return;
        setPosts(next);
      })
      .catch((err) => {
        console.error('fetchPublicFeedPosts failed', err);
        if (!cancelled) setPosts([]);
      })
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authView]);

  useEffect(() => {
    if (authView !== 'app' && authView !== 'landing') return;
    if (tab === 'portfolio' || tab === 'profile' || tab === 'ideas') {
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

  const requireSignIn = useCallback(async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign-in failed', err);
    }
  }, []);

  const openCompose = () => {
    if (authView === 'landing') {
      void requireSignIn();
      return;
    }
    setComposePortfolioShare(null);
    setComposeOpen(true);
  };

  const handleAddComment = async (postId, text) => {
    if (authView === 'landing') {
      void requireSignIn();
      return;
    }
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
    if (authView === 'landing') {
      void requireSignIn();
      return;
    }
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
    if (authView === 'landing' && mode === 'following') {
      void requireSignIn();
      return;
    }
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
    setAssetDetailPanel(null);
    setAssetPanelBack(null);
  };

  const MARKET_RETURN_LABELS = {
    feed: 'Feed',
    ideas: 'Ideas',
    activity: 'Activity',
    portfolio: 'Portfolio',
    profile: 'Profile',
    settings: 'Settings',
  };

  const RETIRED_RETURN_TABS = new Set(['markets', 'explore', 'search']);

  const captureMarketReturnContext = useCallback(() => {
    // Already on an asset — keep prior origin (do not overwrite with a retired hub).
    if (hasAssetDetail) {
      if (!marketReturnContextRef.current) {
        marketReturnContextRef.current = { tab: 'ideas' };
      }
      return;
    }

    const originTab = RETIRED_RETURN_TABS.has(tab) ? 'ideas' : tab;
    marketReturnContextRef.current = {
      tab: originTab,
      profileUserId,
      profilePortfolioId,
      profileMode,
      selectedPostId,
    };
  }, [
    hasAssetDetail,
    tab,
    profileUserId,
    profilePortfolioId,
    profileMode,
    selectedPostId,
  ]);

  const getMarketBackLabel = useCallback(() => {
    const ctx = marketReturnContextRef.current;
    const returnTab =
      !ctx?.tab || RETIRED_RETURN_TABS.has(ctx.tab) ? 'ideas' : ctx.tab;
    return MARKET_RETURN_LABELS[returnTab] ?? 'Ideas';
  }, []);

  const profileBackFallback = useCallback(() => {
    const handle = getHandleForUserIdSync(profileUserId);
    return handle ? profilePath(handle) : tabPath(profileReturnTab || 'feed');
  }, [profileUserId, profileReturnTab]);

  const closeMarketDetail = useCallback(() => {
    backScroll();
    setAssetPanelBack(null);
    const ctx = marketReturnContextRef.current;
    marketReturnContextRef.current = null;
    clearMarketSelection();
    const fallbackTab =
      ctx?.tab && !RETIRED_RETURN_TABS.has(ctx.tab) ? ctx.tab : 'ideas';
    setTab(fallbackTab);
    navigateBack(navigate, location, tabPath(fallbackTab));
  }, [backScroll, location, navigate]);

  const closePost = useCallback(() => {
    backScroll();
    setSelectedPostId(null);
    navigateBack(navigate, location, tabPath('feed'));
  }, [backScroll, location, navigate]);

  const openFund = (fundId, seed = null) => {
    captureMarketReturnContext();
    resetScroll();
    clearMarketSelection();
    const id = String(fundId ?? '').trim();
    if (seed) seedMarketAssetCache(seed, id);
    setSelectedFundId(id);
    setSelectedPostId(null);
    navigate(fundPath(fundId));
  };

  const openStock = (ticker, { kind = 'stock', assetType, seed = null } = {}) => {
    const key = String(ticker ?? '').trim();
    const resolvedKind = assetType || kind;
    // Portfolio holdings use AMFI scheme codes for mutual funds — never open as stocks.
    if (resolvedKind === 'fund' || /^\d{6,}$/.test(key)) {
      openFund(key, seed);
      return;
    }
    captureMarketReturnContext();
    resetScroll();
    clearMarketSelection();
    if (seed) seedMarketAssetCache(seed, key);
    setSelectedTicker(key);
    setSelectedTickerKind(resolvedKind === 'etf' ? 'etf' : 'stock');
    setSelectedPostId(null);
    navigate(resolvedKind === 'etf' ? etfPath(key) : stockPath(key));
  };

  const openIndex = (indexId, seed = null) => {
    captureMarketReturnContext();
    resetScroll();
    clearMarketSelection();
    const id = String(indexId ?? '').trim();
    if (seed) seedMarketAssetCache(seed, id);
    setSelectedIndexId(indexId);
    setSelectedPostId(null);
    navigate(indexPath(indexId));
  };

  const openCommodity = (commodityId, seed = null) => {
    captureMarketReturnContext();
    resetScroll();
    clearMarketSelection();
    const id = String(commodityId ?? '').trim();
    if (seed) seedMarketAssetCache(seed, id);
    setSelectedCommodityId(commodityId);
    setSelectedPostId(null);
    navigate(commodityPath(commodityId));
  };

  const openPost = (postId) => {
    clearMarketSelection();
    resetScroll();
    setSelectedPostId(postId);
    setTab('feed');
    navigate(postPath(postId));
  };

  const openSettings = () => {
    if (authView === 'landing') {
      void requireSignIn();
      return;
    }
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
    if (
      authView === 'landing' &&
      (userId === currentUserId || userId === CURRENT_USER.id || userId === 'u_me')
    ) {
      void requireSignIn();
      return;
    }
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

  const openProfilePortfolio = (userId, portfolioId, { updateHoldings = false } = {}) => {
    if (!userId || !portfolioId) return;
    if (
      authView === 'landing' &&
      (userId === currentUserId || userId === CURRENT_USER.id || userId === 'u_me')
    ) {
      void requireSignIn();
      return;
    }
    resetScroll();
    setSelectedPostId(null);
    setProfileReturnTab(tab === 'profile' || tab === 'settings' ? profileReturnTab : tab);
    setProfileUserId(userId);
    setProfileMode(userId === currentUserId ? 'own' : 'public');
    setProfilePortfolioId(portfolioId);
    setProfileStartUpdateHoldings(Boolean(updateHoldings));
    setTab('profile');
    navigateToProfile(navigate, userId, { portfolioId });
  };

  const createOwnPortfolio = async () => {
    if (authView === 'landing') {
      void requireSignIn();
      return;
    }
    const ownerId = currentUserId;
    if (!ownerId) return;
    const created = await createDraftPortfolio(ownerId);
    openProfilePortfolio(ownerId, created.id);
  };

  const handleTabChange = (next) => {
    if (authView === 'landing' && next === 'settings') {
      void requireSignIn();
      return;
    }
    resetScroll();
    setTab(next);
    setSelectedPostId(null);
    setProfilePortfolioId(null);
    clearMarketSelection();
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

  const inShell = authView === 'app' || authView === 'landing';
  const guestMode = authView === 'landing';

  // Guests: Activity and own Profile stay gated. Shared public portfolios stay open.
  useEffect(() => {
    if (!guestMode) return;
    if (tab === 'activity') {
      setTab('feed');
      setSelectedPostId(null);
      navigateToTab(navigate, 'feed');
      return;
    }
    if (tab !== 'profile') return;
    if (profileMode === 'public' && profilePortfolioId) return;
    setTab('feed');
    setSelectedPostId(null);
    setProfilePortfolioId(null);
    navigateToTab(navigate, 'feed');
  }, [guestMode, tab, navigate, profileMode, profilePortfolioId]);

  const pageTitleOverride =
    inShell && tab === 'settings'
      ? 'Settings'
      : inShell && selectedPostId && tab === 'feed' && !hasAssetDetail
        ? 'Post'
        : inShell && tab === 'activity' && !hasAssetDetail
          ? 'Activity'
          : inShell && tab === 'profile' && profileMode === 'public' && !hasAssetDetail
            ? getPerson(profileUserId)?.name
          : inShell && selectedCommodityId
            ? selectedCommodityId
          : inShell && selectedIndexId
            ? selectedIndexId
          : inShell && selectedFundId
            ? getFund(selectedFundId)?.name ?? 'Fund'
            : inShell && selectedTicker
              ? STOCKS[selectedTicker]?.name ?? selectedTicker
            : undefined;

  const mobileBack = useMemo(() => {
    if (!inShell) return null;
    if (selectedPostId && tab === 'feed' && !hasAssetDetail) {
      return { label: 'Back', onBack: closePost };
    }
    if (hasAssetDetail && assetPanelBack) {
      return assetPanelBack;
    }
    if (selectedCommodityId) {
      return { label: getMarketBackLabel(), onBack: closeMarketDetail };
    }
    if (selectedIndexId) {
      return { label: getMarketBackLabel(), onBack: closeMarketDetail };
    }
    if (selectedFundId) {
      return { label: getMarketBackLabel(), onBack: closeMarketDetail };
    }
    if (selectedTicker) {
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
    inShell,
    authView,
    selectedPostId,
    tab,
    hasAssetDetail,
    selectedTicker,
    selectedFundId,
    selectedIndexId,
    selectedCommodityId,
    assetPanelBack,
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
    const bootPath = parseAppPath(location.pathname);
    // Public marketing can paint without waiting on auth for guests.
    if (bootPath.kind === 'marketing') {
      if (bootPath.redirectTo) {
        return <Navigate to={bootPath.redirectTo} replace />;
      }
      return (
        <RouteSuspense>
          <MarketingRoute
            page={bootPath.page}
            section={bootPath.section}
            symbol={bootPath.symbol}
          />
        </RouteSuspense>
      );
    }
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-pe-canvas px-6">
        <div className="h-9 w-9 rounded-[10px] bg-pe-accent" aria-hidden="true" />
        <p className="text-[12px] font-semibold tracking-wide text-pe-text-muted">PocketEdge</p>
        <div className="h-0.5 w-[120px] overflow-hidden rounded-full bg-pe-surface" aria-hidden="true">
          <div className="h-full w-2/5 animate-pulse rounded-full bg-pe-accent" />
        </div>
      </div>
    );
  }

  const parsedPath = parseAppPath(location.pathname);
  if (parsedPath.kind === 'marketing') {
    if (parsedPath.redirectTo) {
      return <Navigate to={parsedPath.redirectTo} replace />;
    }
    return (
      <RouteSuspense>
        <MarketingRoute
          page={parsedPath.page}
          section={parsedPath.section}
          symbol={parsedPath.symbol}
        />
      </RouteSuspense>
    );
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

  if (authView !== 'app' && authView !== 'landing') {
    return null;
  }

  return (
    <>
      <Shell
        tab={tab}
        feedMode={feedMode}
        pageTitleOverride={pageTitleOverride}
        mobileBack={mobileBack}
        activityUnread={guestMode ? 0 : activityUnread}
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
        onCreatePortfolio={createOwnPortfolio}
        guestMode={guestMode}
        onRequireSignIn={requireSignIn}
        mobileActions={mobileHeaderActions}
        onSelectStock={openStock}
        onSelectFund={openFund}
        onSelectCommodity={openCommodity}
        onSelectIndex={openIndex}
        onOpenProfileFromSearch={openProfile}
        onOpenPost={openPost}
        onOpenProfile={openProfile}
        onGraphChange={() => setGraphTick((n) => n + 1)}
      >
        {hasAssetDetail ? (
          selectedCommodityId ? (
            <RouteSuspense>
              <CommodityDetailPage
                commodityId={selectedCommodityId}
                guestMode={guestMode}
                onBack={closeMarketDetail}
                onOpenProfile={openProfile}
                onRegisterAssetPanelBack={setAssetPanelBack}
                onAssetDetailPanelChange={setAssetDetailPanel}
              />
            </RouteSuspense>
          ) : selectedIndexId ? (
            <RouteSuspense>
              <IndexDetailPage
                indexId={selectedIndexId}
                guestMode={guestMode}
                onBack={closeMarketDetail}
                onOpenProfile={openProfile}
                onRegisterAssetPanelBack={setAssetPanelBack}
                onAssetDetailPanelChange={setAssetDetailPanel}
              />
            </RouteSuspense>
          ) : selectedFundId ? (
            <RouteSuspense>
              <InvestmentPage
                fundId={selectedFundId}
                guestMode={guestMode}
                onBack={closeMarketDetail}
                onOpenProfile={openProfile}
                onOpenPortfolio={openProfilePortfolio}
                onRegisterAssetPanelBack={setAssetPanelBack}
                onAssetDetailPanelChange={setAssetDetailPanel}
              />
            </RouteSuspense>
          ) : (
            <RouteSuspense>
              <StockInvestmentPage
                ticker={selectedTicker}
                guestMode={guestMode}
                onBack={closeMarketDetail}
                onOpenProfile={openProfile}
                onOpenPortfolio={openProfilePortfolio}
                onRegisterAssetPanelBack={setAssetPanelBack}
                onAssetDetailPanelChange={setAssetDetailPanel}
              />
            </RouteSuspense>
          )
        ) : null}
        {!hasAssetDetail && tab === 'feed' && (
          selectedPostId ? (
            <RouteSuspense>
              <PostDetailPage
                postId={selectedPostId}
                posts={posts}
                onBack={closePost}
                onOpenProfile={openProfile}
                onOpenStock={openStock}
                onAddComment={(text) => handleAddComment(selectedPostId, text)}
                onToggleLike={handleTogglePostLike}
                fetchPost={
                  guestMode
                    ? fetchPublicPost
                    : usePostBackend()
                      ? fetchPost
                      : null
                }
              />
            </RouteSuspense>
          ) : (
            <FeedDesignPage
              posts={posts}
              feedMode={feedMode}
              onFeedModeChange={setFeedModeAndStay}
              graphTick={graphTick}
              loading={postsLoading}
              guestMode={guestMode}
              onOpenProfile={openProfile}
              onOpenPost={openPost}
              onOpenStock={openStock}
              onToggleLike={handleTogglePostLike}
              onCompose={openCompose}
            />
          )
        )}
        {!hasAssetDetail && tab === 'ideas' && (
          <RouteSuspense>
            <IdeasPage
              onSelectStock={openStock}
              onSelectFund={openFund}
              onSelectIndex={openIndex}
              onSelectCommodity={openCommodity}
            />
          </RouteSuspense>
        )}
        {!hasAssetDetail && tab === 'activity' && (
          <RouteSuspense>
            <ActivityPage
              guestMode={guestMode}
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
        {!hasAssetDetail && tab === 'portfolio' && (
          <RouteSuspense>
            <PortfolioPage
              guestMode={guestMode}
              onSelectStock={openStock}
              onSelectFund={openFund}
              onOpenProfile={openProfile}
              onOpenPost={openPost}
              onOpenSourcePortfolio={openProfilePortfolio}
              onCreatePortfolio={createOwnPortfolio}
            />
          </RouteSuspense>
        )}
        {!hasAssetDetail && tab === 'profile' &&
          (guestMode && profileMode === 'own' ? (
            <GuestSignInCta
              variant="hero"
              title="Your investing identity"
              description="Sign in to claim your profile, publish theses, and let others follow your edge."
              action="claim your profile"
              showExploreHint={false}
              benefits={[
                'Public profile with your best ideas',
                'Share portfolios you are proud of',
                'Build followers who trust your takes',
              ]}
            />
          ) : (
            <RouteSuspense>
              <ProfilePage
                mode={profileMode}
                userId={profileUserId}
                guestMode={guestMode}
                initialPerson={
                  profileSeedPerson?.id === profileUserId ? profileSeedPerson : null
                }
                posts={posts}
                selectedPortfolioId={profilePortfolioId}
                startUpdateHoldings={profileStartUpdateHoldings}
                onUpdateHoldingsConsumed={() => setProfileStartUpdateHoldings(false)}
                onSelectPortfolio={(id) => {
                  resetScroll();
                  setProfileStartUpdateHoldings(false);
                  setProfilePortfolioId(id);
                  navigateToProfile(navigate, profileUserId, { portfolioId: id });
                }}
                onClearPortfolio={() => {
                  backScroll();
                  setProfileStartUpdateHoldings(false);
                  navigateBack(navigate, location, profileBackFallback());
                }}
                onBack={() => {
                  backScroll();
                  setProfileStartUpdateHoldings(false);
                  navigateBack(navigate, location, tabPath(profileReturnTab || 'feed'));
                }}
                onOpenPublicPreview={() => {
                  if (guestMode) {
                    void requireSignIn();
                    return;
                  }
                  setProfileUserId(currentUserId);
                  setProfileMode('public');
                }}
                onExitPublicPreview={() => {
                  if (guestMode) {
                    void requireSignIn();
                    return;
                  }
                  setProfileUserId(currentUserId);
                  setProfileMode('own');
                }}
                onOpenProfile={openProfile}
                onOpenPost={openPost}
                onOpenStock={openStock}
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
                onRequireSignIn={guestMode ? requireSignIn : undefined}
              />
            </RouteSuspense>
          ))}
        {!hasAssetDetail && tab === 'settings' &&
          (guestMode ? (
            <GuestSignInCta
              variant="hero"
              title="Your preferences, saved"
              description="Sign in to sync settings, notifications, and privacy controls across devices."
              action="open settings"
              showExploreHint={false}
            />
          ) : (
            <RouteSuspense>
              <SettingsPage onLogout={handleLogout} />
            </RouteSuspense>
          ))}
      </Shell>

      {!guestMode ? (
        <ComposeModal
          open={composeOpen}
          portfolioShare={composePortfolioShare}
          onClose={() => {
            setComposeOpen(false);
            setComposePortfolioShare(null);
          }}
          onPost={handlePost}
        />
      ) : null}
    </>
  );
}
