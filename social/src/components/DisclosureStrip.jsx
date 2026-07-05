import { useState } from 'react';
import { getPosition } from '../data/mockData';
import { statusStyles } from '../lib/tickers';
import TickerMiniCard from './TickerMiniCard';

export default function DisclosureStrip({
  tickers,
  authorId,
  activeTicker,
  onActiveTickerChange,
}) {
  const [localActive, setLocalActive] = useState(null);
  const active = activeTicker !== undefined ? activeTicker : localActive;
  const setActive = onActiveTickerChange ?? setLocalActive;

  if (!tickers?.length) return null;

  return (
    <div className="mt-3.5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-none">
      {tickers.map((ticker) => {
        const position = getPosition(authorId, ticker);
        const styles = statusStyles(position.status);
        const isOpen = active === ticker;

        return (
          <span key={ticker} className="relative shrink-0">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setActive(isOpen ? null : ticker);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition hover:opacity-90 ${styles.chip}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
              ${ticker}
              <span className="font-medium opacity-80">· {styles.label}</span>
            </button>
            {isOpen && (
              <TickerMiniCard
                ticker={ticker}
                authorId={authorId}
                onClose={() => setActive(null)}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}
