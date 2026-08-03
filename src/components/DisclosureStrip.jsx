import { useState } from 'react';
import { getPosition } from '../data/mockData';
import { formatTicker, sameTicker, statusStyles } from '../lib/tickers';
import TickerMiniCard from './TickerMiniCard';

/**
 * Soft position tags for securities — wash pills, no heavy borders.
 * Renders inline so they can sit on the same flow as post body text.
 */
export default function DisclosureStrip({
  tickers,
  authorId,
  activeTicker,
  activeSource,
  onOpenTicker,
  onCloseTicker,
  className = '',
}) {
  const [localActive, setLocalActive] = useState(null);
  const uncontrolled = activeTicker === undefined;
  const active = uncontrolled ? localActive : activeTicker;
  const source = uncontrolled ? 'strip' : activeSource;

  if (!tickers?.length) return null;

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 align-middle ${className}`}>
      {tickers.map((ticker) => {
        const position = getPosition(authorId, ticker);
        const styles = statusStyles(position?.status);
        const isSelected = sameTicker(active, ticker);
        const showCard = isSelected && source === 'strip';

        return (
          <span key={ticker} className="relative inline-flex shrink-0">
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
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums transition hover:opacity-90 ${styles.chip}`}
            >
              <span>${formatTicker(ticker)}</span>
              {styles.shortLabel ? (
                <span className="font-medium opacity-70">{styles.shortLabel}</span>
              ) : null}
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
    </span>
  );
}
