import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { parseAppPath, profilePath, tabPath } from './routes';
import { getAppCurrentUserId, getHandleForUserIdSync, resolvePersonByHandle } from './socialIdentity';

/**
 * Keeps App tab/profile state in sync with /@username URLs.
 */
export function useProfileRouting({
  authView,
  profileReady,
  tab,
  profileUserId,
  profilePortfolioId,
  setTab,
  setProfileUserId,
  setProfilePortfolioId,
  setProfileMode,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const applyingUrl = useRef(false);

  // URL -> state
  useEffect(() => {
    if (authView !== 'app' || !profileReady) return;

    const parsed = parseAppPath(location.pathname);
    applyingUrl.current = true;

    if (parsed.kind === 'profile') {
      resolvePersonByHandle(parsed.username).then((person) => {
        if (!person) return;
        setProfileUserId(person.id);
        setProfileMode(person.id === getAppCurrentUserId() ? 'own' : 'public');
        setProfilePortfolioId(parsed.portfolioId);
        setTab('profile');
        queueMicrotask(() => {
          applyingUrl.current = false;
        });
      });
      return;
    }

    if (parsed.kind === 'tab') {
      setTab(parsed.tab);
      if (parsed.tab !== 'profile') {
        setProfilePortfolioId(null);
      }
    }

    queueMicrotask(() => {
      applyingUrl.current = false;
    });
  }, [
    authView,
    profileReady,
    location.pathname,
    setProfileMode,
    setProfilePortfolioId,
    setProfileUserId,
    setTab,
  ]);

  // state -> URL
  useEffect(() => {
    if (authView !== 'app' || !profileReady || applyingUrl.current) return;

    let target = tabPath(tab);
    if (tab === 'profile') {
      const handle = getHandleForUserIdSync(profileUserId);
      if (handle) {
        target = profilePath(handle, { portfolioId: profilePortfolioId });
      }
    }

    if (location.pathname !== target) {
      navigate(target, { replace: true });
    }
  }, [
    authView,
    profileReady,
    tab,
    profileUserId,
    profilePortfolioId,
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
