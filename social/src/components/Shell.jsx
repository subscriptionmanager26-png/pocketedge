import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronDown,
  Home,
  LineChart,
  Pencil,
  Search,
  Settings,
  User,
  Wallet,
} from 'lucide-react';
import Avatar from './Avatar';
import LogoMark from './LogoMark';
import PageHeader from './PageHeader';
import { getAppCurrentUser } from '../lib/socialIdentity';
import {
  getScrollPosition,
  readScrollTop,
  saveScrollPosition,
  writeScrollTop,
} from '../lib/scrollRestore';

const DESKTOP_TABS = [
  { id: 'feed', label: 'Feed', icon: Home },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'activity', label: 'Activity', icon: Bell },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  { id: 'markets', label: 'Markets', icon: LineChart },
  { id: 'settings', label: 'Settings', icon: Settings },
];

/** Activity is top-right on mobile — not in the bottom nav. */
const MOBILE_TABS = DESKTOP_TABS.filter((t) => t.id !== 'settings' && t.id !== 'activity')
  .concat([{ id: 'profile', label: 'Profile', icon: User }]);

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
  mobileActions = null,
  children,
}) {
  const feedTitle = FEED_LABELS[feedMode] ?? 'For You';
  const showFeedSelector = tab === 'feed' && !pageTitleOverride;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);
  const desktopMenuRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const prevRouteKeyRef = useRef(routeKey);

  useEffect(() => {
    if (!mobileMenuOpen && !desktopMenuOpen) return undefined;

    const onPointerDown = (event) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
      if (desktopMenuRef.current && !desktopMenuRef.current.contains(event.target)) {
        setDesktopMenuOpen(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        setDesktopMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileMenuOpen, desktopMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setDesktopMenuOpen(false);
  }, [tab]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const prevKey = prevRouteKeyRef.current;
    if (prevKey === routeKey) return;

    if (prevKey) {
      saveScrollPosition(prevKey, readScrollTop(container));
    }

    const restore = scrollAction === 'back' ? getScrollPosition(routeKey) : 0;

    requestAnimationFrame(() => {
      writeScrollTop(container, restore);
      onScrollActionConsumed?.();
    });

    prevRouteKeyRef.current = routeKey;
  }, [routeKey, scrollAction, onScrollActionConsumed]);

  const selectFeedMode = (mode) => {
    onFeedModeChange?.(mode);
    setMobileMenuOpen(false);
    setDesktopMenuOpen(false);
  };

  const goTab = (id) => {
    if (id === 'profile') onProfile?.();
    else if (id === 'settings') onSettings?.();
    else onTabChange(id);
  };

  const currentUser = getAppCurrentUser();

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
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => goTab(id)}
                className={`flex min-h-12 items-center gap-1 rounded-md text-left text-[15px] leading-5 transition hover:bg-pe-surface ${
                  active
                    ? 'font-semibold text-pe-accent'
                    : 'font-medium text-pe-text-secondary'
                }`}
              >
                <span className="flex h-12 min-w-12 shrink-0 items-center justify-center">
                  <span className="relative">
                    <Icon
                      className="h-6 w-6"
                      strokeWidth={2}
                    />
                    {id === 'activity' && activityUnread > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pe-accent px-1 text-[10px] font-bold text-white">
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
            onClick={onCompose}
            className="mt-2 flex min-h-12 w-full items-center justify-center rounded-full bg-pe-accent px-4 text-center text-[15px] font-bold text-white transition hover:bg-pe-accent-pressed active:scale-[0.99]"
          >
            Post
          </button>
        </nav>

        <div className="p-2">
          <button
            type="button"
            onClick={onProfile}
            className={`flex min-h-12 w-full items-center gap-1 rounded-md text-left text-[15px] leading-5 transition hover:bg-pe-surface ${
              tab === 'profile'
                ? 'font-semibold text-pe-accent'
                : 'font-medium text-pe-text-secondary'
            }`}
          >
            <span className="flex h-12 min-w-12 shrink-0 items-center justify-center">
              <Avatar person={currentUser} size="sm" />
            </span>
            <span className="min-w-0 flex-1 pr-2">
              <span className="block truncate text-[15px] font-medium leading-5 text-pe-text">
                {currentUser.name}
              </span>
              <span className="block truncate text-[13px] text-pe-text-muted">
                @{currentUser.handle}
              </span>
            </span>
          </button>
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
                      <>
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
                            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pe-accent px-1 text-[10px] font-bold text-white">
                              {activityUnread > 9 ? '9+' : activityUnread}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={onSettings}
                          className={`flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-pe-surface ${
                            tab === 'settings'
                              ? 'text-pe-accent'
                              : 'text-pe-text-secondary hover:text-pe-text'
                          }`}
                          aria-label="Settings"
                        >
                          <Settings className="h-5 w-5" />
                        </button>
                      </>
                    )}
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
                      <span className="text-[17px] font-semibold leading-6 tracking-tight text-pe-text">
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
          onClick={onCompose}
          className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.75rem)] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-pe-accent text-white transition hover:bg-pe-accent-pressed active:scale-95 md:hidden"
          aria-label="Compose post"
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
                className={`relative flex h-full min-w-[4.25rem] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
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
    </div>
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
