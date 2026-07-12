import { useState } from 'react';
import { getPosition } from '../data/mockData';
import {
  MENTION_PARTS_RE,
  mentionDisplayLabel,
  parseMentionPart,
  statusStyles,
} from '../lib/tickers';
import TickerMiniCard from './TickerMiniCard';

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
  const parts = String(text ?? '').split(MENTION_PARTS_RE);

  return (
    <p className={`whitespace-pre-wrap text-left text-[16px] font-normal leading-[1.55] text-pe-ink ${className}`}>
      {parts.map((part, i) => {
        const mention = parseMentionPart(part);
        if (!mention) {
          return <span key={i}>{part}</span>;
        }

        const key = mention.key;
        const label = mentionDisplayLabel(part);
        const position = getPosition(authorId, key);
        const styles = statusStyles(position.status);
        const isOpen = active === key;

        const toggle = (event) => {
          event.stopPropagation();
          setActive(isOpen ? null : key);
        };

        return (
          <span key={`${i}-${key}`} className="relative inline">
            {/* Inline span so long mentions wrap like text; buttons are inline-block and jump whole. */}
            <span
              role="button"
              tabIndex={0}
              onClick={toggle}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  toggle(event);
                }
              }}
              className={`inline cursor-pointer break-words text-left font-semibold underline decoration-dotted decoration-2 underline-offset-[5px] transition hover:opacity-80 ${styles.underline}`}
            >
              @{label}
            </span>
            {isOpen && (
              <TickerMiniCard
                ticker={key}
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
