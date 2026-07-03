import { ChevronDown, Home, LineChart, Pencil, Search, Wallet } from 'lucide-react';
import Avatar from './Avatar';
import { CURRENT_USER } from '../data/mockData';

const TABS = [
  { id: 'feed', label: 'Feed', icon: Home },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  { id: 'markets', label: 'Markets', icon: LineChart },
];

const PAGE_TITLES = {
  search: 'Search',
  portfolio: 'Portfolio',
  markets: 'Markets',
  profile: 'Profile',
};

const FEED_LABELS = {
  forYou: 'For You',
  following: 'Following',
};

export default function Shell({
  tab,
  feedMode = 'forYou',
  onTabChange,
  onFeedModeToggle,
  onProfile,
  onCompose,
  children,
}) {
  const feedTitle = FEED_LABELS[feedMode] ?? 'For You';
  const pageTitle = tab === 'feed' ? feedTitle : PAGE_TITLES[tab] ?? 'Social';

  return (
    <div className="min-h-dvh bg-pe-canvas text-pe-text md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-r md:border-pe-border md:bg-pe-sidebar lg:w-64">
        <div className="px-5 pb-2 pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-pe-text-secondary">
            PocketEdge
          </p>
          <p className="mt-1 text-sm text-pe-text-muted">Social</p>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] font-medium transition ${
                  active
                    ? 'bg-pe-elevated text-pe-text shadow-card'
                    : 'text-pe-text-secondary hover:bg-pe-surface hover:text-pe-text'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'stroke-[2.25]' : 'opacity-80'}`} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-pe-border p-3">
          <button
            type="button"
            onClick={onProfile}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-pe-surface"
          >
            <Avatar person={CURRENT_USER} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-pe-text">{CURRENT_USER.name}</p>
              <p className="truncate text-xs text-pe-text-muted">@{CURRENT_USER.handle}</p>
            </div>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-pe-border bg-pe-canvas/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-feed items-center justify-between px-4 py-3.5 md:px-6">
            <div className="min-w-0">
              {/* Mobile-only brand mark — desktop brand lives in the sidebar */}
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-pe-text-muted md:hidden">
                PocketEdge
              </p>

              {tab === 'feed' ? (
                <button
                  type="button"
                  onClick={onFeedModeToggle}
                  className="group inline-flex items-center gap-1.5 rounded-lg text-left transition hover:opacity-90"
                  aria-label={`Switch feed. Currently ${feedTitle}`}
                >
                  <h1 className="text-xl font-semibold tracking-tight text-pe-text md:text-2xl">
                    {feedTitle}
                  </h1>
                  <ChevronDown className="h-5 w-5 text-pe-text-secondary transition group-hover:text-pe-text" />
                </button>
              ) : (
                <h1 className="text-xl font-semibold tracking-tight text-pe-text md:text-2xl">
                  {pageTitle}
                </h1>
              )}
            </div>

            <Avatar
              person={CURRENT_USER}
              size="sm"
              onClick={onProfile}
              className="md:hidden"
            />
          </div>
        </header>

        <main className="mx-auto w-full max-w-feed flex-1 pb-24 md:pb-8">{children}</main>
      </div>

      {tab === 'feed' && (
        <button
          type="button"
          onClick={onCompose}
          className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-lg shadow-black/50 transition hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
          aria-label="Compose post"
        >
          <Pencil className="h-5 w-5" />
        </button>
      )}

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-pe-border bg-pe-canvas/95 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-feed items-stretch justify-around px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className={`flex min-w-[4.25rem] flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-medium transition ${
                  active ? 'text-pe-text' : 'text-pe-text-muted hover:text-pe-text-secondary'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'stroke-[2.25]' : ''}`} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
