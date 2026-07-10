import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { parseAppPath, pathFromAppState, profilePath, tabPath } from './routes';
import { getAppCurrentUserId, getHandleForUserIdSync, resolvePersonByHandle } from './socialIdentity';

function clearMarketSelection(setters) {
  setters.setSelectedTicker(null);
  setters.setSelectedTickerKind('stock');
  setters.setSelectedFundId(null);
  setters.setSelectedIndexId(null);
  setters.setSelectedCommodityId(null);
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
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const applyingUrl = useRef(false);

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

  // URL -> state
  useEffect(() => {
    if (authView !== 'app' || !profileReady) return;

    const parsed = parseAppPath(location.pathname);
    applyingUrl.current = true;

    const finish = () => {
      queueMicrotask(() => {
        applyingUrl.current = false;
      });
    };

    if (parsed.kind === 'profile') {
      resolvePersonByHandle(parsed.username).then((person) => {
        if (!person) {
          finish();
          return;
        }
        clearMarketSelection(setters);
        setSelectedPostId(null);
        setProfileUserId(person.id);
        setProfileMode(person.id === getAppCurrentUserId() ? 'own' : 'public');
        setProfilePortfolioId(parsed.portfolioId);
        setTab('profile');
        finish();
      });
      return;
    }

    if (parsed.kind === 'post') {
      clearMarketSelection(setters);
      setProfilePortfolioId(null);
      setSelectedPostId(parsed.postId);
      setTab('feed');
      finish();
      return;
    }

    if (parsed.kind === 'stock' || parsed.kind === 'etf') {
      setProfilePortfolioId(null);
      setSelectedPostId(null);
      setSelectedFundId(null);
      setSelectedIndexId(null);
      setSelectedCommodityId(null);
      setSelectedTicker(parsed.symbol);
      setSelectedTickerKind(parsed.kind === 'etf' ? 'etf' : 'stock');
      setTab('markets');
      finish();
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
      finish();
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
      finish();
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
      setTab('markets');
      finish();
      return;
    }

    if (parsed.kind === 'tab') {
      clearMarketSelection(setters);
      setSelectedPostId(null);
      setTab(parsed.tab);
      if (parsed.tab !== 'profile') {
        setProfilePortfolioId(null);
      }
      finish();
    }
  }, [
    authView,
    profileReady,
    location.pathname,
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
  ]);

  // state -> URL
  useEffect(() => {
    if (authView !== 'app' || !profileReady || applyingUrl.current) return;

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
      getHandleForUserId: getHandleForUserIdSync,
    });

    if (location.pathname !== target) {
      navigate(target, { replace: true });
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
    location.pathname,
    navigate,
  ]);
}

export function navigateToProfile(navigate, userId, { portfolioId } = {}) {
  const handle = getHandleForUserIdSync(userId);
  if (!handle) return;
  navigate(profilePath(handle, { portfolioId }));
}

export function navigateToTab(navigate, nextTab) {
  navigate(tabPath(nextTab));
}
