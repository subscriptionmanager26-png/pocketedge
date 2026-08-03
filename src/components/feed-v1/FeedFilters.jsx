import { SlidersHorizontal } from 'lucide-react';

const FILTERS = [
  { id: 'forYou', label: 'For You' },
  { id: 'following', label: 'Following' },
];

/** Desktop-only tabs — mobile uses logo feed-mode menu. */
export default function FeedFilters({ active = 'forYou', onChange }) {
  return (
    <div className="hidden items-center gap-1 px-4 md:flex md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {FILTERS.map((f) => {
          const isActive = active === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onChange?.(f.id)}
              className={`relative shrink-0 px-3.5 py-3 text-[15px] font-medium transition-colors duration-150 ${
                isActive
                  ? 'text-[var(--fv-text)]'
                  : 'text-[var(--fv-text-muted)] hover:text-[var(--fv-text-secondary)]'
              }`}
            >
              {f.label}
              {isActive ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--fv-accent)] transition-all duration-150" />
              ) : null}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--fv-text-secondary)] transition hover:bg-black/[0.04] hover:text-[var(--fv-text)]"
        aria-label="Filter feed"
      >
        <SlidersHorizontal className="h-5 w-5" strokeWidth={2} />
      </button>
    </div>
  );
}
