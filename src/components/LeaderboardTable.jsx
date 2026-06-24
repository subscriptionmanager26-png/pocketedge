import React from 'react';
import { Medal } from 'lucide-react';

const MEDAL_STYLES = {
  1: 'bg-amber-100 text-amber-700 border-amber-200',
  2: 'bg-neutral-100 text-pe-text-secondary border-neutral-200',
  3: 'bg-orange-50 text-orange-700 border-orange-200',
};

const GRID_WITH_RETURNS =
  'grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,0.9fr)_4.5rem] sm:grid-cols-[3rem_minmax(0,1.2fr)_minmax(0,1fr)_5.5rem]';

const GRID_NO_RETURNS =
  'grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-[3rem_minmax(0,1.2fr)_minmax(0,1fr)]';

export default function LeaderboardTable({
  entries,
  userBaskets = [],
  signedIn = false,
  publicView = false,
  onBasketClick,
  limit,
  hideReturns = true,
}) {
  const rows = limit ? entries.slice(0, limit) : entries;
  const gridClass = hideReturns ? GRID_NO_RETURNS : GRID_WITH_RETURNS;

  return (
    <div className="bg-white border border-neutral-200/80 rounded-2xl overflow-hidden">
      <div
        className={`grid ${gridClass} gap-x-3 sm:gap-x-4 px-4 sm:px-5 py-3 border-b border-neutral-100 text-[10px] font-semibold uppercase tracking-wider text-pe-text-muted`}
      >
        <span>Rank</span>
        <span>Basket</span>
        <span>Creator</span>
        {!hideReturns && <span className="text-right">Returns</span>}
      </div>

      <ul className="divide-y divide-neutral-100">
        {rows.map((entry) => {
          const isYours = userBaskets.some((b) => b.id === entry.basket.id);
          const interactive = !publicView && onBasketClick;
          const RowTag = interactive ? 'button' : 'div';
          const rowProps = interactive
            ? {
                type: 'button',
                onClick: () => onBasketClick(entry.basket.id),
                className: `w-full text-left px-4 sm:px-5 py-3.5 sm:py-4 hover:bg-neutral-50 transition-colors ${
                  isYours ? 'bg-neutral-900/[0.03]' : ''
                }`,
              }
            : {
                className: `px-4 sm:px-5 py-3.5 sm:py-4 ${isYours ? 'bg-neutral-900/[0.03]' : ''}`,
              };

          return (
            <li key={entry.basket.id}>
              <RowTag {...rowProps}>
                <div className={`grid ${gridClass} gap-x-3 sm:gap-x-4 gap-y-1 items-center`}>
                  <RankBadge rank={entry.rank} />

                  <div className="min-w-0">
                    <p className="font-medium text-pe-text text-sm sm:text-base leading-snug line-clamp-2">
                      {entry.basket.name}
                    </p>
                    {isYours && signedIn && (
                      <span className="text-[10px] font-medium text-pe-text-secondary">Your basket</span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-pe-text-secondary font-medium truncate">
                    {entry.creatorName}
                  </p>
                </div>
              </RowTag>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RankBadge({ rank }) {
  const medal = MEDAL_STYLES[rank];
  if (medal) {
    return (
      <span
        className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${medal}`}
      >
        <Medal className="w-4 h-4" />
      </span>
    );
  }

  return (
    <span className="w-8 h-8 rounded-full bg-neutral-100 text-pe-text-secondary text-sm font-bold flex items-center justify-center shrink-0">
      {rank}
    </span>
  );
}
