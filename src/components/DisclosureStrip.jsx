import { useState } from 'react';
import { getPosition } from '../data/mockData';
import { formatTicker, sameTicker, statusStyles } from '../lib/tickers';
import TickerMiniCard from './TickerMiniCard';

export default function DisclosureStrip({
  tickers,
  authorId,
  activeTicker,
  activeSource,
  onOpenTicker,
  onCloseTicker,
}) {
  const [localActive, setLocalActive] = useState(null);
  const uncontrolled = activeTicker === undefined;
  const active = uncontrolled ? localActive : activeTicker;
  const source = uncontrolled ? 'strip' : activeSource;

  if (!tickers?.length) return null;

  return (
    <div className="mt-3.5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-none">
      {tickers.map((ticker) => {
        const position = getPosition(authorId, ticker);
        const styles = statusStyles(position?.status);
        const isSelected = sameTicker(active, ticker);
        const showCard = isSelected && source === 'strip';

        return (
          <span key={ticker} className="relative shrink-0">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (uncontrolled) {
                  setLocalActive(isSelected ? null : ticker);
                  return;
                }
                if (isSelected && source === 'strip') onCloseTicker?.();
                else onOpenTicker?.(ticker, 'strip');
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition hover:opacity-90 ${styles.chip}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
              {formatTicker(ticker)}
              <span className="font-medium opacity-80">· {styles.label}</span>
            </button>
            {showCard ? (
              <TickerMiniCard
                ticker={ticker}
                authorId={authorId}
                onClose={() => {
                  if (uncontrolled) setLocalActive(null);
                  else onCloseTicker?.();
                }}
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
