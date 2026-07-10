import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CURRENT_USER, getHandleForUserId, getPersonByHandle } from '../data/mockData';
import { parseAppPath, profilePath, tabPath } from './routes';

/**
 * Keeps App tab/profile state in sync with /@username URLs.
 */
export function useProfileRouting({
  authView,
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
    if (authView !== 'app') return;

    const parsed = parseAppPath(location.pathname);
    applyingUrl.current = true;

    if (parsed.kind === 'profile') {
      const person = getPersonByHandle(parsed.username);
      if (person) {
        setProfileUserId(person.id);
        setProfileMode(person.id === CURRENT_USER.id ? 'own' : 'public');
        setProfilePortfolioId(parsed.portfolioId);
        setTab('profile');
      }
    } else if (parsed.kind === 'tab') {
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
    location.pathname,
    setProfileMode,
    setProfilePortfolioId,
    setProfileUserId,
    setTab,
  ]);

  // state -> URL
  useEffect(() => {
    if (authView !== 'app' || applyingUrl.current) return;

    let target = tabPath(tab);
    if (tab === 'profile') {
      const handle = getHandleForUserId(profileUserId);
      if (handle) {
        target = profilePath(handle, { portfolioId: profilePortfolioId });
      }
    }

    if (location.pathname !== target) {
      navigate(target, { replace: true });
    }
  }, [
    authView,
    tab,
    profileUserId,
    profilePortfolioId,
    location.pathname,
    navigate,
  ]);
}

export function navigateToProfile(navigate, userId, { portfolioId } = {}) {
  const handle = getHandleForUserId(userId);
  if (!handle) return;
  navigate(profilePath(handle, { portfolioId }));
}

export function navigateToTab(navigate, nextTab) {
  navigate(tabPath(nextTab));
}
