import { useLayoutEffect, useRef, useState } from 'react';
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
  maxLines = null,
  onSeeMore,
}) {
  const rootRef = useRef(null);
  const [localActive, setLocalActive] = useState(null);
  const [truncated, setTruncated] = useState(false);
  const uncontrolled = activeTicker === undefined;
  const active = uncontrolled ? localActive : activeTicker;
  const source = uncontrolled ? 'mention' : activeSource;
  // Prefer navigating to the security page; position details live in the bottom tags.
  const openSecurity = Boolean(onOpenStock);
  const clampLines = Number(maxLines) > 0 ? Number(maxLines) : null;

  useLayoutEffect(() => {
    if (!clampLines) {
      setTruncated(false);
      return undefined;
    }
    const el = rootRef.current;
    if (!el) return undefined;

    const measure = () => {
      setTruncated(el.scrollHeight > el.clientHeight + 1);
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [text, clampLines]);

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
                className={`inline cursor-pointer break-words text-left font-semibold underline decoration-dotted decoration-2 underline-offset-[5px] transition hover:opacity-80 ${styles.underline}`}
              >
                @{label}
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
      ref={rootRef}
      className={`whitespace-pre-wrap text-left text-[16px] font-normal leading-[1.55] text-pe-ink ${
        clampLines ? 'pe-ticker-text-clamp' : ''
      } ${className}`}
      style={
        clampLines
          ? { maxHeight: `calc(1.55em * ${clampLines})`, overflow: 'hidden' }
          : undefined
      }
    >
      {clampLines && truncated ? (
        <button
          type="button"
          className="pe-ticker-see-more float-right clear-both text-[14px] font-semibold text-pe-link"
          onClick={(event) => {
            event.stopPropagation();
            onSeeMore?.();
          }}
        >
          See more
        </button>
      ) : null}
      {lines.map(({ line, contentLineIndex: index }, i) => (
        <span key={i}>
          {renderText(line, index)}
          {i < lines.length - 1 ? '\n' : null}
        </span>
      ))}
    </div>
  );
}
