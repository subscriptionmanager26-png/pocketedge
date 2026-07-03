import { Home, LineChart, Pencil, Search, Wallet } from 'lucide-react';
import Avatar from './Avatar';
import { CURRENT_USER } from '../data/mockData';

const TABS = [
  { id: 'feed', label: 'Feed', icon: Home },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  { id: 'markets', label: 'Markets', icon: LineChart },
];

const TITLES = {
  feed: 'Feed',
  search: 'Search',
  portfolio: 'Portfolio',
  markets: 'Markets',
  profile: 'Profile',
};

export default function Shell({
  tab,
  onTabChange,
  onProfile,
  onCompose,
  children,
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-pe-canvas text-pe-text">
      <header className="sticky top-0 z-40 border-b border-pe-border/80 bg-pe-canvas/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-pe-text-muted">
              PocketEdge
            </p>
            <h1 className="text-lg font-semibold tracking-tight">{TITLES[tab] ?? 'Social'}</h1>
          </div>
          <Avatar person={CURRENT_USER} size="sm" onClick={onProfile} />
        </div>
      </header>

      <main className="flex-1 pb-24">{children}</main>

      {tab === 'feed' && (
        <button
          type="button"
          onClick={onCompose}
          className="fixed bottom-24 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-lg shadow-black/40 transition hover:scale-105 active:scale-95"
          style={{ right: 'max(1rem, calc((100vw - 32rem) / 2 + 1rem))' }}
          aria-label="Compose post"
        >
          <Pencil className="h-5 w-5" />
        </button>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-pe-border/80 bg-pe-canvas/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className={`flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-[11px] font-medium transition ${
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
