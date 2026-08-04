import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Home,
  Lightbulb,
  Pencil,
  Wallet,
} from 'lucide-react';
import LogoMark from './LogoMark';
import PageHeader from './PageHeader';
import FeedTopBar from './feed-v1/FeedTopBar';
import FeedRightRail from './feed-v1/FeedRightRail';
import GlobalSearchPanel from './GlobalSearchPanel';
import { fetchMarketPreview } from '../lib/marketDataApi';
import {
  loadRailDiscussions,
  loadRailPeople,
  loadRailTrending,
} from '../lib/feedRailData';
import { getAppCurrentUser } from '../lib/socialIdentity';
import { disclosuresPath, insightsPath, resourcesPath } from '../lib/routes';
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
  // Explore kept in routing/code but hidden from shell UI — Ideas covers discovery for now.
  // { id: 'explore', label: 'Explore', icon: Search },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
];

/** Primary destinations only — Activity, Profile, and Menu live in the top bar. */
const MOBILE_TABS = DESKTOP_TABS;

/** Slim in-app menu — tools + settings only (opened from the profile control). */
const APP_MENU_ITEMS = [
  { label: 'Insights', href: insightsPath() },
  { label: 'ETF iNAV tracker', href: resourcesPath('etf-inav') },
  { label: 'SGB Tracker', href: resourcesPath('sgb') },
  { label: 'MF Screener', href: resourcesPath('mf-screener') },
  { label: 'Disclosures', href: disclosuresPath() },
];

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
  onSelectStock,
  onSelectFund,
  onSelectCommodity,
  onSelectIndex,
  onOpenProfileFromSearch,
  onOpenPost,
  onOpenProfile,
  onGraphChange,
  /** Wide main column, no right rail — Resources tools. */
  wideContent = false,
  children,
}) {
  const feedTitle = FEED_LABELS[feedMode] ?? 'For You';
  // Feed mode tabs live in FeedDesignPage; mobile logo menu only on home feed.
  const showFeedSelector = false;
  const showFeedMenu = tab === 'feed' && !pageTitleOverride && !mobileBack && !wideContent;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [railTrending, setRailTrending] = useState([]);
  const [railDiscussions, setRailDiscussions] = useState([]);
  const [railPeople, setRailPeople] = useState([]);
  const [railLive, setRailLive] = useState(false);
  // Must be after searchOpen state — authenticated path evaluates !searchOpen;
  // guestMode short-circuits earlier, which is why logout still rendered.
  const showMobileComposeFab =
    tab === 'feed' &&
    !guestMode &&
    !mobileBack &&
    !searchOpen &&
    !pageTitleOverride &&
    !wideContent;
  const desktopMenuRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const prevRouteKeyRef = useRef(routeKey);
  const routeKeyRef = useRef(routeKey);
  const restoringRef = useRef(false);
  routeKeyRef.current = routeKey;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadRailTrending(5).catch(() => ({ live: false, items: [] })),
      loadRailDiscussions(4, { guestMode }).catch(() => []),
      loadRailPeople(4).catch(() => []),
      fetchMarketPreview('indices').catch(() => null),
    ]).then(([trendingPayload, discussions, people, indicesPayload]) => {
      if (cancelled) return;
      setRailTrending(trendingPayload?.items ?? []);
      setRailDiscussions(discussions ?? []);
      setRailPeople(people ?? []);
      setRailLive(
        Boolean(trendingPayload?.live) || indicesPayload?.source === 'rpc'
      );
    });
    return () => {
      cancelled = true;
    };
  }, [guestMode]);

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
    if (!mobileMenuOpen && !desktopMenuOpen) return undefined;

    const onPointerDown = (event) => {
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
    setSearchOpen(false);
    setSearchQuery('');
  }, [tab]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
  };

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
    onTabChange(id);
  };

  const openSettingsFromMenu = () => {
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
    // Soft gate: navigate to Profile and show in-page CTA (do not OAuth immediately).
    onProfile?.();
  };

  const currentUser = getAppCurrentUser();
  const avatarInitial = (currentUser?.name || currentUser?.handle || 'P').trim().charAt(0).toUpperCase();

  const handleActivity = () => {
    if (guestMode) {
      onRequireSignIn?.();
      return;
    }
    goTab('activity');
  };

  return (
    <div className="pe-feed-v1 min-h-dvh bg-white text-pe-text md:flex md:h-dvh md:overflow-hidden">
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
                onMouseEnter={() => prefetchTab(id)}
                onTouchStart={() => prefetchTab(id)}
                className={`flex min-h-12 items-center gap-1 rounded-md text-left text-[20px] leading-6 transition hover:bg-pe-surface ${
                  active
                    ? 'font-semibold text-pe-accent'
                    : 'font-medium text-pe-text-secondary'
                }`}
              >
                <span className="flex h-12 min-w-12 shrink-0 items-center justify-center">
                  <Icon className="h-6 w-6" strokeWidth={2} />
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
      </aside>

      <div
        ref={scrollContainerRef}
        className="flex min-h-dvh min-w-0 flex-1 flex-col md:min-h-0 md:overflow-y-auto md:overscroll-y-contain"
      >
        <div className="flex min-h-0 min-w-0 flex-1 md:px-5">
          <div
            className={`flex min-h-0 min-w-0 flex-1 justify-center ${
              wideContent ? '' : 'md:mr-[420px]'
            }`}
          >
            <div
              className={`flex min-h-0 w-full min-w-0 flex-col md:pt-[72px] ${
                wideContent ? 'max-w-6xl' : 'max-w-feed'
              }`}
            >
              <FeedTopBar
                feedMode={feedMode}
                onFeedModeChange={selectFeedMode}
                showFeedMenu={showFeedMenu}
                mobileBack={mobileBack}
                onGoHome={onGoHome}
                onActivity={handleActivity}
                onProfile={handleProfileOrSignIn}
                onSettings={openSettingsFromMenu}
                menuItems={APP_MENU_ITEMS}
                activityUnread={activityUnread}
                avatarInitial={avatarInitial}
                guestMode={guestMode}
                wide={wideContent}
                searchQuery={searchQuery}
                onSearchChange={(value) => {
                  setSearchQuery(value);
                  setSearchOpen(true);
                }}
                onSearchFocus={() => setSearchOpen(true)}
                onSearchClear={closeSearch}
              />

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

              <main
                className={`relative z-0 flex min-h-0 flex-1 flex-col md:pb-10 ${
                  showMobileComposeFab
                    ? 'pb-[calc(3.5rem+4.25rem+env(safe-area-inset-bottom,0px))]'
                    : 'pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]'
                }`}
              >
                {searchOpen ? (
                  <GlobalSearchPanel
                    query={searchQuery}
                    onClose={closeSearch}
                    guestMode={guestMode}
                    onRequireSignIn={onRequireSignIn}
                    onSelectStock={onSelectStock}
                    onSelectFund={onSelectFund}
                    onSelectCommodity={onSelectCommodity}
                    onSelectIndex={onSelectIndex}
                    onOpenProfile={onOpenProfileFromSearch}
                    onGraphChange={onGraphChange}
                  />
                ) : (
                  children
                )}
              </main>
            </div>
          </div>
        </div>
      </div>

      {wideContent ? null : (
        <div className="hidden md:contents">
          <FeedRightRail
            trending={railTrending}
            discussions={railDiscussions}
            people={railPeople}
            live={railLive}
            guestMode={guestMode}
            onOpenIndex={onSelectIndex}
            onOpenStock={onSelectStock}
            onOpenPost={onOpenPost}
            onOpenProfile={onOpenProfile || onOpenProfileFromSearch}
            onCompose={onCompose}
            onRequireSignIn={onRequireSignIn}
            onFollowChange={onGraphChange}
          />
        </div>
      )}

      {showMobileComposeFab ? (
        <button
          type="button"
          onClick={handleComposeOrSignIn}
          className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.75rem)] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-pe-accent text-white shadow-[0_6px_24px_rgba(0,0,0,0.18)] transition hover:bg-pe-accent-pressed active:scale-95 md:hidden"
          aria-label="Compose post"
        >
          <Pencil className="h-5 w-5" />
        </button>
      ) : null}

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
