import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronDown,
  Home,
  Lightbulb,
  Menu,
  Pencil,
  Search,
  Settings,
  User,
  Wallet,
  X,
} from 'lucide-react';
import Avatar from './Avatar';
import { MARKETING_NAV_ITEMS } from './AuthLayoutHeader';
import LogoMark from './LogoMark';
import PageHeader from './PageHeader';
import { getAppCurrentUser } from '../lib/socialIdentity';
import { prefetchTab } from '../lib/tabPrefetch';
import {
  getScrollPosition,
  readScrollTop,
  rememberScrollPositionOnLeave,
  saveScrollPosition,
  writeScrollTop,
  disableBrowserScrollRestoration,
} from '../lib/scrollRestore';

/** Detail → list transitions should restore even when browser back skipped scrollAction. */
function shouldRestoreScroll(prevKey, nextKey, scrollAction) {
  if (scrollAction === 'back') return true;
  if (!prevKey || !nextKey) return false;
  if (nextKey === 'feed' && String(prevKey).startsWith('post:')) return true;
  if (
    (nextKey === 'markets' || nextKey === 'explore' || nextKey === 'ideas') &&
    /^(stock|etf|fund|index|commodity):/.test(String(prevKey))
  ) {
    return true;
  }
  // Closing an asset sub-panel (insights/posts/…) → restore the security page scroll.
  if (
    /^(stock|etf|fund|index|commodity):[^:]+:.+/.test(String(prevKey)) &&
    /^(stock|etf|fund|index|commodity):[^:]+$/.test(String(nextKey)) &&
    String(prevKey).startsWith(`${String(nextKey)}:`)
  ) {
    return true;
  }
  if (
    String(prevKey).includes(':portfolio:') &&
    String(nextKey).startsWith('profile:') &&
    !String(nextKey).includes(':portfolio:')
  ) {
    return true;
  }
  return false;
}

const DESKTOP_TABS = [
  { id: 'feed', label: 'Feed', icon: Home },
  { id: 'explore', label: 'Explore', icon: Search },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'activity', label: 'Activity', icon: Bell },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  { id: 'menu', label: 'Menu', icon: Menu },
];

/** Activity + Menu live in the top header on mobile — not in the bottom nav. */
const MOBILE_TABS = DESKTOP_TABS.filter((t) => t.id !== 'menu' && t.id !== 'activity').concat([
  { id: 'profile', label: 'Profile', icon: User },
]);

const FEED_OPTIONS = [
  { id: 'forYou', label: 'For You' },
  { id: 'following', label: 'Following' },
];

const FEED_LABELS = {
  forYou: 'For You',
  following: 'Following',
};

/**
 * Desktop middle header is not a page title — each page owns its primary control.
 * Shell only renders:
 * - mobile logo chrome
 * - desktop feed-type selector on the home feed
 */
export default function Shell({
  tab,
  feedMode = 'forYou',
  pageTitleOverride,
  mobileBack,
  activityUnread = 0,
  routeKey = 'feed',
  scrollAction = 'reset',
  onScrollActionConsumed,
  onTabChange,
  onFeedModeChange,
  onProfile,
  onSettings,
  onGoHome,
  onCompose,
  guestMode = false,
  onRequireSignIn,
  mobileActions = null,
  children,
}) {
  const feedTitle = FEED_LABELS[feedMode] ?? 'For You';
  const showFeedSelector = tab === 'feed' && !pageTitleOverride;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);
  const desktopMenuRef = useRef(null);
  const desktopAppMenuRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const prevRouteKeyRef = useRef(routeKey);
  const routeKeyRef = useRef(routeKey);
  const restoringRef = useRef(false);
  routeKeyRef.current = routeKey;

  useEffect(() => {
    disableBrowserScrollRestoration();
  }, []);

  // Track live scroll for the active route (actual position, including scroll-up).
  useEffect(() => {
    const container = scrollContainerRef.current;
    let ticking = false;

    const persist = () => {
      ticking = false;
      if (restoringRef.current) return;
      saveScrollPosition(routeKeyRef.current, readScrollTop(container));
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(persist);
    };

    persist();
    container?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container?.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen && !desktopMenuOpen && !appMenuOpen) return undefined;

    const onPointerDown = (event) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
      if (desktopMenuRef.current && !desktopMenuRef.current.contains(event.target)) {
        setDesktopMenuOpen(false);
      }
      // Desktop Menu popover only — mobile drawer uses its own overlay.
      if (
        appMenuOpen &&
        desktopAppMenuRef.current &&
        !desktopAppMenuRef.current.contains(event.target) &&
        window.matchMedia('(min-width: 768px)').matches
      ) {
        setAppMenuOpen(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        setDesktopMenuOpen(false);
        setAppMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileMenuOpen, desktopMenuOpen, appMenuOpen]);

  useEffect(() => {
    if (!appMenuOpen) return undefined;
    if (!window.matchMedia('(max-width: 767px)').matches) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [appMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setDesktopMenuOpen(false);
    setAppMenuOpen(false);
  }, [tab]);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    const prevKey = prevRouteKeyRef.current;
    if (prevKey === routeKey) return;

    if (prevKey) {
      // Prefer the live read; if content already clamped to 0, keep last tracked value.
      rememberScrollPositionOnLeave(prevKey, readScrollTop(container));
    }

    const restoreScroll = shouldRestoreScroll(prevKey, routeKey, scrollAction);
    const restore = restoreScroll ? getScrollPosition(routeKey) : 0;
    if (!restoreScroll) {
      // Fresh forward navigation: start at top and clear any stale restore target.
      saveScrollPosition(routeKey, 0);
    }
    prevRouteKeyRef.current = routeKey;
    restoringRef.current = restore > 0;

    let cancelled = false;
    let attempts = 0;
    // Retry tops too — new content can mount after the first paint and leave a mid-page offset.
    const maxAttempts = restore > 0 ? 24 : 12;

    const finish = () => {
      restoringRef.current = false;
      if (restore > 0) {
        saveScrollPosition(routeKey, restore);
      }
      onScrollActionConsumed?.();
    };

    const apply = () => {
      if (cancelled) return;
      writeScrollTop(container, restore);
      attempts += 1;
      if (attempts >= maxAttempts) {
        finish();
        return;
      }
      if (restore <= 0) {
        const current = readScrollTop(container);
        if (current <= 1) {
          finish();
          return;
        }
        window.setTimeout(apply, attempts < 8 ? 16 : 50);
        return;
      }
      const current = readScrollTop(container);
      if (current >= restore - 2) {
        finish();
        return;
      }
      window.setTimeout(apply, attempts < 8 ? 16 : 50);
    };

    apply();
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(apply);
    });

    return () => {
      cancelled = true;
      restoringRef.current = false;
      cancelAnimationFrame(raf);
    };
  }, [routeKey, scrollAction, onScrollActionConsumed]);

  const selectFeedMode = (mode) => {
    if (guestMode && mode === 'following') {
      onRequireSignIn?.();
      return;
    }
    onFeedModeChange?.(mode);
    setMobileMenuOpen(false);
    setDesktopMenuOpen(false);
  };

  const goTab = (id) => {
    prefetchTab(id);
    if (guestMode && id === 'profile') {
      onRequireSignIn?.();
      return;
    }
    if (id === 'profile') onProfile?.();
    else if (id === 'menu') setAppMenuOpen((open) => !open);
    else if (id === 'settings') {
      if (guestMode) {
        onRequireSignIn?.();
        return;
      }
      onSettings?.();
    } else onTabChange(id);
  };

  const openSettingsFromMenu = () => {
    setAppMenuOpen(false);
    if (guestMode) {
      onRequireSignIn?.();
      return;
    }
    onSettings?.();
  };

  const handleComposeOrSignIn = () => {
    if (guestMode) {
      onRequireSignIn?.();
      return;
    }
    onCompose?.();
  };

  const handleProfileOrSignIn = () => {
    if (guestMode) {
      onRequireSignIn?.();
      return;
    }
    onProfile?.();
  };

  const currentUser = getAppCurrentUser();
  const menuActive = appMenuOpen || tab === 'settings';

  return (
    <div className="min-h-dvh bg-pe-canvas text-pe-text md:flex md:h-dvh md:overflow-hidden">
      <aside className="hidden md:flex md:h-full md:w-[232px] md:shrink-0 md:flex-col md:overflow-y-auto md:overscroll-y-contain md:border-r md:border-pe-border md:p-2">
        <div className="flex h-16 items-start p-2">
          <button
            type="button"
            onClick={onGoHome}
            className="flex h-12 w-12 items-center justify-center rounded-md transition hover:bg-pe-surface"
            aria-label="Go to home feed"
          >
            <LogoMark />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-2 p-2">
          {DESKTOP_TABS.map(({ id, label, icon: Icon }) => {
            const active = id === 'menu' ? menuActive : tab === id;
            if (id === 'menu') {
              return (
                <div key={id} className="flex flex-col gap-1" ref={desktopAppMenuRef}>
                  <button
                    type="button"
                    onClick={() => goTab(id)}
                    className={`flex min-h-12 w-full items-center gap-1 rounded-md text-left text-[20px] leading-6 transition hover:bg-pe-surface ${
                      active
                        ? 'font-semibold text-pe-accent'
                        : 'font-medium text-pe-text-secondary'
                    }`}
                    aria-haspopup="menu"
                    aria-expanded={appMenuOpen}
                    aria-controls="shell-desktop-app-menu"
                  >
                    <span className="flex h-12 min-w-12 shrink-0 items-center justify-center">
                      <Icon className="h-6 w-6" strokeWidth={2} />
                    </span>
                    <span className="flex-1 pr-2">{label}</span>
                  </button>
                  {appMenuOpen ? (
                    <div
                      id="shell-desktop-app-menu"
                      role="menu"
                      className="mb-1 ml-3 flex flex-col gap-0.5 border-l border-pe-border pl-2"
                    >
                      <AppMenuLinks
                        compact
                        guestMode={guestMode}
                        onNavigate={() => setAppMenuOpen(false)}
                        onSettings={openSettingsFromMenu}
                      />
                    </div>
                  ) : null}
                </div>
              );
            }
            return (
              <button
                key={id}
                type="button"
                onClick={() => goTab(id)}
                onMouseEnter={() => prefetchTab(id)}
                onTouchStart={() => prefetchTab(id)}
                className={`flex min-h-12 items-center gap-1 rounded-md text-left text-[20px] leading-6 transition hover:bg-pe-surface ${
                  active
                    ? 'font-semibold text-pe-accent'
                    : 'font-medium text-pe-text-secondary'
                }`}
              >
                <span className="flex h-12 min-w-12 shrink-0 items-center justify-center">
                  <span className="relative">
                    <Icon className="h-6 w-6" strokeWidth={2} />
                    {id === 'activity' && activityUnread > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pe-accent px-1 text-[8px] font-bold text-white">
                        {activityUnread > 9 ? '9+' : activityUnread}
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex-1 pr-2">{label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={handleComposeOrSignIn}
            className="mt-2 flex min-h-12 w-full items-center justify-center rounded-full bg-pe-accent px-4 text-center text-[20px] font-bold text-white transition hover:bg-pe-accent-pressed active:scale-[0.99]"
          >
            {guestMode ? 'Sign in' : 'Post'}
          </button>
        </nav>

        <div className="p-2">
          {guestMode ? (
            <button
              type="button"
              onClick={handleProfileOrSignIn}
              className="flex min-h-12 w-full items-center justify-center rounded-md border border-pe-border px-3 text-[15px] font-semibold text-pe-text transition hover:bg-pe-surface"
            >
              Sign in to your account
            </button>
          ) : (
            <button
              type="button"
              onClick={handleProfileOrSignIn}
              className={`flex min-h-12 w-full items-center gap-1 rounded-md text-left text-[20px] leading-6 transition hover:bg-pe-surface ${
                tab === 'profile'
                  ? 'font-semibold text-pe-accent'
                  : 'font-medium text-pe-text-secondary'
              }`}
            >
              <span className="flex h-12 min-w-12 shrink-0 items-center justify-center">
                <Avatar person={currentUser} size="sm" />
              </span>
              <span className="min-w-0 flex-1 pr-2">
                <span className="block truncate text-[20px] font-medium leading-6 text-pe-text">
                  {currentUser.name}
                </span>
                <span className="block truncate text-[12px] text-pe-text-muted">
                  @{currentUser.handle}
                </span>
              </span>
            </button>
          )}
        </div>
      </aside>

      <div
        ref={scrollContainerRef}
        className="flex min-h-dvh min-w-0 flex-1 flex-col md:min-h-0 md:overflow-y-auto md:overscroll-y-contain"
      >
        <div className="flex min-h-0 min-w-0 flex-1 md:px-5">
          <div className="flex min-h-0 min-w-0 flex-1 justify-center md:mr-[420px]">
            <div className="flex min-h-0 w-full min-w-0 max-w-feed flex-col">
              {/* Mobile chrome only — logo / feed menu + avatar */}
              <header className="sticky top-0 z-40 border-b border-pe-border bg-pe-canvas/95 backdrop-blur-md md:hidden">
                <div className="flex h-[56px] items-center justify-between px-4">
                  <div className="min-w-0" ref={mobileMenuRef}>
                    {showFeedSelector ? (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setMobileMenuOpen((open) => !open)}
                          className="inline-flex h-12 items-center gap-0.5"
                          aria-haspopup="listbox"
                          aria-expanded={mobileMenuOpen}
                          aria-label={`Feed menu. Currently ${feedTitle}`}
                        >
                          <span className="flex h-12 w-12 items-center justify-center">
                            <LogoMark />
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 text-pe-text-secondary transition ${
                              mobileMenuOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        {mobileMenuOpen && (
                          <FeedModeMenu
                            feedMode={feedMode}
                            onSelect={selectFeedMode}
                            className="left-0 top-full mt-1"
                          />
                        )}
                      </div>
                    ) : mobileBack ? (
                      <button
                        type="button"
                        onClick={mobileBack.onBack}
                        className="inline-flex h-12 max-w-[calc(100vw-5rem)] items-center gap-1.5 text-pe-text-secondary"
                      >
                        <ArrowLeft className="h-5 w-5 shrink-0" />
                        <span className="truncate text-[15px] font-semibold text-pe-text">
                          {mobileBack.label}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onGoHome}
                        className="flex h-12 w-12 items-center justify-center rounded-md transition hover:bg-pe-surface"
                        aria-label="Go to home feed"
                      >
                        <LogoMark />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {mobileActions ?? (
                      <button
                        type="button"
                        onClick={() => goTab('activity')}
                        className="relative flex h-10 w-10 items-center justify-center rounded-full text-pe-text-secondary transition hover:bg-pe-surface hover:text-pe-text"
                        aria-label={
                          activityUnread > 0
                            ? `${activityUnread} unread activity items`
                            : 'Activity'
                        }
                      >
                        <Bell className="h-5 w-5" />
                        {activityUnread > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pe-accent px-1 text-[12px] font-bold text-white">
                            {activityUnread > 9 ? '9+' : activityUnread}
                          </span>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAppMenuOpen((open) => !open)}
                      className={`flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-pe-surface ${
                        menuActive
                          ? 'text-pe-accent'
                          : 'text-pe-text-secondary hover:text-pe-text'
                      }`}
                      aria-label={appMenuOpen ? 'Close menu' : 'Open menu'}
                      aria-expanded={appMenuOpen}
                      aria-controls="shell-app-menu-drawer"
                    >
                      {appMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </header>

              {/* Desktop: only the feed-type control on home — never a redundant page title */}
              {showFeedSelector && (
                <PageHeader className="hidden md:block">
                  <div className="relative" ref={desktopMenuRef}>
                    <button
                      type="button"
                      onClick={() => setDesktopMenuOpen((open) => !open)}
                      className="inline-flex items-center gap-1 rounded-md py-1 text-left transition hover:bg-pe-surface"
                      aria-haspopup="listbox"
                      aria-expanded={desktopMenuOpen}
                      aria-label={`Feed menu. Currently ${feedTitle}`}
                    >
                      <span className="text-[15px] font-semibold leading-6 tracking-tight text-pe-text">
                        {feedTitle}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-pe-text-secondary transition ${
                          desktopMenuOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {desktopMenuOpen && (
                      <FeedModeMenu
                        feedMode={feedMode}
                        onSelect={selectFeedMode}
                        className="left-0 top-full mt-1"
                      />
                    )}
                  </div>
                </PageHeader>
              )}

              <main className="flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-10">{children}</main>
            </div>
          </div>
        </div>
      </div>

      {showFeedSelector && (
        <button
          type="button"
          onClick={handleComposeOrSignIn}
          className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.75rem)] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-pe-accent text-white transition hover:bg-pe-accent-pressed active:scale-95 md:hidden"
          aria-label={guestMode ? 'Sign in' : 'Compose post'}
        >
          <Pencil className="h-5 w-5" />
        </button>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-pe-border bg-pe-canvas pb-[env(safe-area-inset-bottom,0px)] md:hidden">
        <div className="mx-auto flex h-14 max-w-feed items-center justify-around px-1">
          {MOBILE_TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => goTab(id)}
                onMouseEnter={() => prefetchTab(id)}
                onTouchStart={() => prefetchTab(id)}
                className={`relative flex h-full min-w-[4.25rem] flex-col items-center justify-center gap-0.5 text-[12px] font-medium transition ${
                  active ? 'text-pe-accent' : 'text-pe-text-muted'
                }`}
              >
                <Icon
                  className={`h-6 w-6 ${active ? 'text-pe-accent' : 'text-pe-text-muted'}`}
                  strokeWidth={2}
                />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile app menu drawer — marketing pages + Settings */}
      <button
        type="button"
        className={`fixed inset-0 z-50 bg-black/40 transition md:hidden ${
          appMenuOpen ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
        aria-hidden={!appMenuOpen}
        aria-label="Close menu"
        onClick={() => setAppMenuOpen(false)}
      />
      <aside
        id="shell-app-menu-drawer"
        className={`fixed right-0 top-0 z-[60] flex h-full w-[min(300px,85vw)] flex-col border-l border-pe-border bg-pe-canvas shadow-xl transition-transform duration-300 md:hidden ${
          appMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!appMenuOpen}
      >
        <div className="flex items-center justify-between border-b border-pe-border px-4 py-4">
          <span className="text-[15px] font-semibold text-pe-text">Menu</span>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-pe-surface"
            aria-label="Close menu"
            onClick={() => setAppMenuOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-3" aria-label="App menu">
          <AppMenuLinks
            guestMode={guestMode}
            onNavigate={() => setAppMenuOpen(false)}
            onSettings={openSettingsFromMenu}
          />
        </nav>
      </aside>
    </div>
  );
}

function AppMenuLinks({ onNavigate, onSettings, guestMode = false, compact = false }) {
  const itemClass = compact
    ? 'flex w-full items-center rounded-md px-2.5 py-2 text-left text-[15px] font-medium text-pe-text transition hover:bg-pe-surface'
    : 'flex w-full items-center rounded-lg px-3 py-3.5 text-left text-[15px] font-medium text-pe-text transition hover:bg-pe-surface';

  return (
    <>
      {MARKETING_NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          role="menuitem"
          onClick={onNavigate}
          className={itemClass}
        >
          {item.label}
        </Link>
      ))}
      <button
        type="button"
        role="menuitem"
        onClick={onSettings}
        className={`${itemClass} gap-2`}
      >
        <Settings className="h-4 w-4 shrink-0 text-pe-text-muted" />
        {guestMode ? 'Sign in' : 'Settings'}
      </button>
    </>
  );
}

function FeedModeMenu({ feedMode, onSelect, className = '' }) {
  return (
    <div
      role="listbox"
      aria-label="Feed mode"
      className={`absolute z-50 min-w-[10.5rem] overflow-hidden rounded-lg border border-pe-border-strong bg-pe-canvas py-1 shadow-lg ${className}`}
    >
      {FEED_OPTIONS.map((option) => {
        const active = feedMode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onSelect(option.id)}
            className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-medium transition ${
              active
                ? 'bg-pe-accent-wash text-pe-accent'
                : 'text-pe-text hover:bg-pe-surface'
            }`}
          >
            {option.label}
            {active && <Check className="h-4 w-4" />}
          </button>
        );
      })}
    </div>
  );
}
