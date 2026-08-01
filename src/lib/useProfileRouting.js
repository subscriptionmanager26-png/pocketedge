import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { parseAppPath, pathFromAppState, profilePath, tabPath } from './routes';
import { getAppCurrentUserId, getHandleForUserIdSync, resolvePerson, resolvePersonByHandle } from './socialIdentity';

function clearMarketSelection(setters) {
  setters.setSelectedTicker(null);
  setters.setSelectedTickerKind('stock');
  setters.setSelectedFundId(null);
  setters.setSelectedIndexId(null);
  setters.setSelectedCommodityId(null);
}

function isDeepLinkPath(pathname) {
  const kind = parseAppPath(pathname).kind;
  return kind === 'profile' || kind === 'post' || kind === 'stock' || kind === 'etf'
    || kind === 'fund' || kind === 'index' || kind === 'commodity' || kind === 'ideas-theme';
}

/**
 * Keeps App tab/profile/asset state in sync with shareable URLs.
 */
export function useProfileRouting({
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
  marketsSectionTab = 'stocks',
  ideasThemeId = null,
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
  setIdeasThemeId,
  onProfileResolved,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  /** True while URL→state is applying (blocks state→URL overwrite). */
  const applyingUrl = useRef(false);
  /** Pathname we're hydrating from the address bar; blocks state→URL until done. */
  const pendingUrlPath = useRef(null);

  const setters = {
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
  };

  const routingActive = authView === 'app' || authView === 'landing';

  // Mark deep-link paths as pending immediately so state→URL cannot clobber them
  // before authView becomes 'app'/'landing' (default tab is 'feed').
  useEffect(() => {
    if (routingActive) return;
    if (isDeepLinkPath(location.pathname)) {
      pendingUrlPath.current = location.pathname;
    }
  }, [routingActive, location.pathname]);

  // URL -> state
  useEffect(() => {
    if (!routingActive) return;

    const pathname = location.pathname;
    const parsed = parseAppPath(pathname);
    let cancelled = false;

    applyingUrl.current = true;
    pendingUrlPath.current = pathname;

    const finish = () => {
      if (cancelled) return;
      queueMicrotask(() => {
        if (cancelled) return;
        applyingUrl.current = false;
        if (pendingUrlPath.current === pathname) {
          pendingUrlPath.current = null;
        }
      });
    };

    const apply = async () => {
      try {
        if (parsed.redirectFrom === 'search') {
          navigate(tabPath('explore'), { replace: true });
          finish();
          return;
        }

        if (parsed.kind === 'profile') {
          const person = await resolvePersonByHandle(parsed.username);
          if (cancelled) return;
          if (!person) return;
          clearMarketSelection(setters);
          setSelectedPostId(null);
          setProfileUserId(person.id);
          setProfileMode(person.id === getAppCurrentUserId() ? 'own' : 'public');
          setProfilePortfolioId(parsed.portfolioId);
          onProfileResolved?.(person);
          setTab('profile');
          return;
        }

        if (parsed.kind === 'post') {
          clearMarketSelection(setters);
          setProfilePortfolioId(null);
          setSelectedPostId(parsed.postId);
          setTab('feed');
          return;
        }

        if (parsed.kind === 'stock' || parsed.kind === 'etf') {
          // AMFI scheme codes are numeric — treat accidental /stock/<code> as fund.
          if (parsed.kind === 'stock' && /^\d{6,}$/.test(String(parsed.symbol ?? ''))) {
            setProfilePortfolioId(null);
            setSelectedPostId(null);
            setSelectedTicker(null);
            setSelectedTickerKind('stock');
            setSelectedIndexId(null);
            setSelectedCommodityId(null);
            setSelectedFundId(String(parsed.symbol));
            setTab('markets');
            navigate(`/fund/${encodeURIComponent(String(parsed.symbol))}`, { replace: true });
            return;
          }

          setProfilePortfolioId(null);
          setSelectedPostId(null);
          setSelectedFundId(null);
          setSelectedIndexId(null);
          setSelectedCommodityId(null);
          setSelectedTicker(parsed.symbol);
          setSelectedTickerKind(parsed.kind === 'etf' ? 'etf' : 'stock');
          setTab('markets');
          return;
        }

        if (parsed.kind === 'fund') {
          setProfilePortfolioId(null);
          setSelectedPostId(null);
          setSelectedTicker(null);
          setSelectedTickerKind('stock');
          setSelectedIndexId(null);
          setSelectedCommodityId(null);
          setSelectedFundId(parsed.schemeCode);
          setTab('markets');
          return;
        }

        if (parsed.kind === 'index') {
          setProfilePortfolioId(null);
          setSelectedPostId(null);
          setSelectedTicker(null);
          setSelectedTickerKind('stock');
          setSelectedFundId(null);
          setSelectedCommodityId(null);
          setSelectedIndexId(parsed.indexId);
          setTab('markets');
          return;
        }

        if (parsed.kind === 'commodity') {
          setProfilePortfolioId(null);
          setSelectedPostId(null);
          setSelectedTicker(null);
          setSelectedTickerKind('stock');
          setSelectedFundId(null);
          setSelectedIndexId(null);
          setSelectedCommodityId(parsed.commodityId);
          setIdeasThemeId?.(null);
          setTab('markets');
          return;
        }

        if (parsed.kind === 'ideas-theme') {
          clearMarketSelection(setters);
          setSelectedPostId(null);
          setProfilePortfolioId(null);
          setIdeasThemeId?.(parsed.themeId);
          setTab('ideas');
          return;
        }

        if (parsed.kind === 'tab') {
          clearMarketSelection(setters);
          setSelectedPostId(null);
          setTab(parsed.tab);
          if (parsed.tab !== 'profile') {
            setProfilePortfolioId(null);
          }
          if (parsed.tab === 'ideas') {
            setIdeasThemeId?.(null);
          } else {
            setIdeasThemeId?.(null);
          }
        }
      } catch (err) {
        console.error('Failed to hydrate route from URL', err);
      } finally {
        finish();
      }
    };

    void apply();

    return () => {
      cancelled = true;
    };
  }, [
    authView,
    location.pathname,
    navigate,
    onProfileResolved,
    setProfileMode,
    setProfilePortfolioId,
    setProfileUserId,
    setSelectedCommodityId,
    setSelectedFundId,
    setSelectedIndexId,
    setSelectedPostId,
    setSelectedTicker,
    setSelectedTickerKind,
    setTab,
    setIdeasThemeId,
  ]);

  // state -> URL
  useEffect(() => {
    if (!routingActive || !profileReady) return;
    if (applyingUrl.current || pendingUrlPath.current) return;

    const target = pathFromAppState({
      tab,
      profileUserId,
      profilePortfolioId,
      selectedPostId,
      selectedTicker,
      selectedTickerKind,
      selectedFundId,
      selectedIndexId,
      selectedCommodityId,
      marketsSectionTab,
      ideasThemeId,
      getHandleForUserId: getHandleForUserIdSync,
    });

    if (!target) return;

    const targetUrl = new URL(target, 'https://pocketedge.local');
    const samePath = location.pathname === targetUrl.pathname;
    const sameSearch = (location.search || '') === targetUrl.search;
    if (!(samePath && sameSearch)) {
      navigate(`${targetUrl.pathname}${targetUrl.search}`);
    }
  }, [
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
    marketsSectionTab,
    ideasThemeId,
    location.pathname,
    location.search,
    navigate,
  ]);
}

export function navigateToProfile(navigate, userId, { portfolioId, handle } = {}) {
  const syncHandle = handle || getHandleForUserIdSync(userId);
  if (syncHandle) {
    navigate(profilePath(syncHandle, { portfolioId }));
    return;
  }
  if (!userId) return;
  resolvePerson(userId)
    .then((person) => {
      if (person?.handle) navigate(profilePath(person.handle, { portfolioId }));
    })
    .catch(() => {});
}

export function navigateToTab(navigate, nextTab) {
  navigate(tabPath(nextTab));
}

/** Browser back when history exists; otherwise navigate to a sensible fallback. */
export function navigateBack(navigate, location, fallbackPath) {
  if (location.key !== 'default') {
    navigate(-1);
    return;
  }
  navigate(fallbackPath);
}
