import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, Check, ChevronDown, Search, Settings, User, X } from 'lucide-react';
import LogoMark from '../LogoMark';

const FEED_OPTIONS = [
  { id: 'forYou', label: 'For You' },
  { id: 'following', label: 'Following' },
];

/**
 * Global top chrome (all shell pages):
 * Desktop — feed-width search centered above the column; bell + profile right-aligned
 * Mobile — logo (or back / feed menu) · search · notifications · profile
 */
export default function FeedTopBar({
  feedMode = 'forYou',
  onFeedModeChange,
  showFeedMenu = false,
  mobileBack = null,
  onGoHome,
  onActivity,
  onProfile,
  onSettings,
  menuItems = [],
  activityUnread = 0,
  avatarInitial = 'P',
  guestMode = false,
  searchQuery = '',
  onSearchChange,
  onSearchFocus,
  onSearchClear,
}) {
  const [feedMenuOpen, setFeedMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const feedMenuRef = useRef(null);
  const profileMenuRef = useRef(null);
  const feedTitle = FEED_OPTIONS.find((o) => o.id === feedMode)?.label ?? 'For You';
  const hasQuery = Boolean(searchQuery?.trim());

  useEffect(() => {
    if (!feedMenuOpen && !profileMenuOpen) return undefined;
    const onDoc = (event) => {
      if (feedMenuRef.current && !feedMenuRef.current.contains(event.target)) {
        setFeedMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setFeedMenuOpen(false);
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [feedMenuOpen, profileMenuOpen]);

  useEffect(() => {
    setFeedMenuOpen(false);
    setProfileMenuOpen(false);
  }, [showFeedMenu, mobileBack]);

  const unreadLabel =
    activityUnread > 0
      ? `${activityUnread > 9 ? '9+' : activityUnread} unread notifications`
      : 'Notifications';

  const closeProfileMenu = () => setProfileMenuOpen(false);

  const backButton = mobileBack ? (
    <button
      type="button"
      onClick={mobileBack.onBack}
      className="inline-flex h-10 max-w-[9rem] shrink-0 items-center gap-1 text-[var(--fv-text-secondary)] transition hover:text-[var(--fv-text)] md:h-11 md:max-w-none"
      aria-label={`Back to ${mobileBack.label}`}
    >
      <ArrowLeft className="h-5 w-5 shrink-0" strokeWidth={2} />
      <span className="truncate text-[14px] font-semibold text-[var(--fv-text)]">
        {mobileBack.label}
      </span>
    </button>
  ) : null;

  const accountActions = (
    <>
      <button
        type="button"
        onClick={onActivity}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--fv-text-secondary)] shadow-[var(--fv-shadow)] transition duration-150 hover:text-[var(--fv-text)] md:h-11 md:w-11"
        aria-label={guestMode ? 'Sign in to see activity' : unreadLabel}
      >
        <Bell className="h-[18px] w-[18px] md:h-5 md:w-5" strokeWidth={2} />
        {!guestMode && activityUnread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#dc2626] px-1 text-[10px] font-bold text-white md:h-[18px] md:min-w-[18px] md:text-[11px]">
            {activityUnread > 9 ? '9+' : activityUnread}
          </span>
        ) : null}
      </button>

      <div className="relative shrink-0" ref={profileMenuRef}>
        <button
          type="button"
          onClick={() => {
            setFeedMenuOpen(false);
            setProfileMenuOpen((open) => !open);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--fv-accent)] text-[14px] font-semibold text-white shadow-[var(--fv-shadow)] md:h-11 md:w-11 md:text-[15px]"
          aria-label={guestMode ? 'Account menu' : 'Profile and menu'}
          aria-haspopup="menu"
          aria-expanded={profileMenuOpen}
        >
          {guestMode ? '?' : avatarInitial}
        </button>
        {profileMenuOpen ? (
          <div
            role="menu"
            aria-label="Profile and tools"
            className="absolute right-0 top-full z-50 mt-2 min-w-[12.5rem] overflow-hidden rounded-[14px] border border-[var(--fv-border)] bg-white py-1 shadow-[var(--fv-shadow-hover)]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeProfileMenu();
                onProfile?.();
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-[var(--fv-text)] transition hover:bg-black/[0.03]"
            >
              <User className="h-4 w-4 shrink-0 text-[var(--fv-text-muted)]" strokeWidth={2} />
              {guestMode ? 'Sign in' : 'Profile'}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeProfileMenu();
                onSettings?.();
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-[var(--fv-text)] transition hover:bg-black/[0.03]"
            >
              <Settings className="h-4 w-4 shrink-0 text-[var(--fv-text-muted)]" strokeWidth={2} />
              {guestMode ? 'Sign in' : 'Settings'}
            </button>
            {menuItems.length ? (
              <div className="border-t border-[var(--fv-border)] py-1">
                {menuItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    role="menuitem"
                    onClick={closeProfileMenu}
                    className="flex w-full items-center px-3 py-2.5 text-left text-sm font-medium text-[var(--fv-text)] transition hover:bg-black/[0.03]"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );

  const searchField = (
    <div className="relative min-w-0 flex-1">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--fv-text-muted)] md:left-4 md:h-5 md:w-5"
        strokeWidth={2}
      />
      <input
        type="text"
        value={searchQuery}
        onChange={(event) => onSearchChange?.(event.target.value)}
        onFocus={onSearchFocus}
        className="fv-search"
        placeholder="Search…"
        aria-label="Search people, stocks, topics"
        autoComplete="off"
      />
      {hasQuery ? (
        <button
          type="button"
          onClick={() => onSearchClear?.()}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--fv-text-muted)] transition hover:bg-black/[0.04] hover:text-[var(--fv-text)]"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--fv-border)]/60 bg-white/95 px-3 py-2.5 backdrop-blur-md md:fixed md:left-[232px] md:right-0 md:border-b-0 md:bg-white md:px-5 md:py-4">
      {/* Mobile row */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="relative shrink-0" ref={feedMenuRef}>
          {mobileBack ? (
            backButton
          ) : showFeedMenu ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setFeedMenuOpen((open) => !open);
                }}
                className="inline-flex h-10 items-center gap-0.5"
                aria-haspopup="listbox"
                aria-expanded={feedMenuOpen}
                aria-label={`Feed menu. Currently ${feedTitle}`}
              >
                <span className="flex h-10 w-10 items-center justify-center">
                  <LogoMark />
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-[var(--fv-text-secondary)] transition ${
                    feedMenuOpen ? 'rotate-180' : ''
                  }`}
                  strokeWidth={2}
                />
              </button>
              {feedMenuOpen ? (
                <div
                  role="listbox"
                  aria-label="Feed mode"
                  className="absolute left-0 top-full z-50 mt-1 min-w-[10.5rem] overflow-hidden rounded-lg border border-[var(--fv-border)] bg-white py-1 shadow-[var(--fv-shadow-hover)]"
                >
                  {FEED_OPTIONS.map((option) => {
                    const active = feedMode === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          onFeedModeChange?.(option.id);
                          setFeedMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-medium transition ${
                          active
                            ? 'bg-[var(--fv-accent)]/10 text-[var(--fv-accent)]'
                            : 'text-[var(--fv-text)] hover:bg-black/[0.03]'
                        }`}
                      >
                        {option.label}
                        {active ? <Check className="h-4 w-4" strokeWidth={2} /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              onClick={onGoHome}
              className="flex h-10 w-10 items-center justify-center"
              aria-label="Go to home feed"
            >
              <LogoMark />
            </button>
          )}
        </div>
        {searchField}
        {accountActions}
      </div>

      {/*
        Desktop: mirror Shell feed centering (justify-center + mr rail),
        pin bell/profile to the true right edge of the page.
      */}
      <div className="relative hidden w-full items-center md:flex">
        <div className="flex min-w-0 flex-1 justify-center md:mr-[420px]">
          <div className="flex w-full max-w-feed items-center gap-3">
            {mobileBack ? backButton : null}
            {searchField}
          </div>
        </div>
        <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-2 md:right-5">
          {accountActions}
        </div>
      </div>
    </header>
  );
}
