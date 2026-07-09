import { useState } from 'react';
import { getPosition } from '../data/mockData';
import { formatTicker, statusStyles } from '../lib/tickers';
import TickerMiniCard from './TickerMiniCard';

const MENTION_PARTS_RE = /(@[A-Z][A-Z0-9]{1,11}\b|\$[A-Z][A-Z0-9]{1,11}\b)/g;

function mentionTicker(part) {
  if (part.startsWith('@')) return part.slice(1);
  if (part.startsWith('$')) return part.slice(1);
  return null;
}

export default function TickerText({
  text,
  authorId,
  className = '',
  activeTicker,
  onActiveTickerChange,
}) {
  const [localActive, setLocalActive] = useState(null);
  const active = activeTicker !== undefined ? activeTicker : localActive;
  const setActive = onActiveTickerChange ?? setLocalActive;
  const parts = text.split(MENTION_PARTS_RE);

  return (
    <p
      className={`text-[16px] font-normal leading-[1.55] text-pe-ink ${className}`}
    >
      {parts.map((part, i) => {
        const ticker = mentionTicker(part);
        if (!ticker) {
          return <span key={i}>{part}</span>;
        }
        const position = getPosition(authorId, ticker);
        const styles = statusStyles(position.status);
        const isOpen = active === ticker;

        return (
          <span key={i} className="relative inline">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setActive(isOpen ? null : ticker);
              }}
              className={`font-semibold underline decoration-dotted decoration-2 underline-offset-[5px] transition hover:opacity-80 ${styles.underline}`}
            >
              {formatTicker(ticker)}
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
    </p>
  );
}
