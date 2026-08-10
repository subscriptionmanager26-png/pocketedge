import { useState } from 'react';
import { getPosition } from '../data/mockData';
import {
  MENTION_PARTS_RE,
  mentionDisplayLabel,
  parseMentionPart,
  sameTicker,
  statusStyles,
} from '../lib/tickers';
import TickerMiniCard from './TickerMiniCard';

export default function TickerText({
  text,
  authorId,
  className = '',
  boldContentLine = null,
  activeTicker,
  activeSource,
  onOpenTicker,
  onCloseTicker,
  onOpenStock,
  containerRef,
  trailing = null,
}) {
  const [localActive, setLocalActive] = useState(null);
  const uncontrolled = activeTicker === undefined;
  const active = uncontrolled ? localActive : activeTicker;
  const source = uncontrolled ? 'mention' : activeSource;
  // Prefer navigating to the security page; position details live in the bottom tags.
  const openSecurity = Boolean(onOpenStock);

  const renderText = (line, lineIndex) => {
    const parts = line.split(MENTION_PARTS_RE);
    return (
      <span
        key={lineIndex}
        className={lineIndex === boldContentLine ? 'font-bold' : undefined}
      >
        {parts.map((part, i) => {
          const mention = parseMentionPart(part);
          if (!mention) {
            return <span key={i}>{part}</span>;
          }

          const key = mention.key;
          const label = mentionDisplayLabel(part);
          const position = getPosition(authorId, key);
          const styles = statusStyles(position?.status);
          const isSelected = sameTicker(active, key);
          const showCard = !openSecurity && isSelected && source === 'mention';

          const toggle = (event) => {
            event.stopPropagation();
            if (openSecurity) {
              onOpenStock?.(key);
              return;
            }
            if (uncontrolled) {
              setLocalActive(isSelected ? null : key);
              return;
            }
            if (isSelected && source === 'mention') onCloseTicker?.();
            else onOpenTicker?.(key, 'mention');
          };

          return (
            <span key={`${i}-${key}`} className="relative inline">
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
                className={`inline-flex cursor-pointer items-baseline rounded-[6px] px-1 py-px text-left text-[inherit] font-semibold leading-[inherit] transition hover:opacity-90 ${styles.chip}`}
              >
                ${label}
              </span>
              {showCard ? (
                <TickerMiniCard
                  ticker={key}
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
  };

  let contentLineIndex = -1;
  const lines = String(text ?? '').split('\n').map((line) => {
    if (line.trim()) contentLineIndex += 1;
    return { line, contentLineIndex };
  });

  return (
    <div
      ref={containerRef}
      className={`break-words whitespace-pre-wrap text-left text-[15px] font-normal leading-[1.55] text-pe-ink [overflow-wrap:anywhere] ${className}`}
    >
      {lines.map(({ line, contentLineIndex: index }, i) => (
        <span key={i}>
          {renderText(line, index)}
          {i < lines.length - 1 ? '\n' : null}
        </span>
      ))}
      {trailing}
    </div>
  );
}
