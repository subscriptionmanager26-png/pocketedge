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

const SEE_MORE_LABEL = 'See more';
const SEE_MORE_SUFFIX = `… ${SEE_MORE_LABEL}`;

function readLineHeight(style) {
  const lh = parseFloat(style.lineHeight);
  if (Number.isFinite(lh) && lh > 0) return lh;
  const fs = parseFloat(style.fontSize);
  return (Number.isFinite(fs) ? fs : 16) * 1.55;
}

function breakNear(text, index) {
  if (index >= text.length) return text;
  const slice = text.slice(0, index);
  const space = slice.lastIndexOf(' ');
  const newline = slice.lastIndexOf('\n');
  const at = Math.max(space, newline);
  if (at > index * 0.55) return text.slice(0, at);
  return slice;
}

/** Truncate `text` so `text + "… See more"` fits in `maxLines` at `widthPx`. */
function clampTextToLines(text, maxLines, widthPx, style) {
  if (!text || !widthPx || maxLines <= 0) {
    return { text, truncated: false };
  }

  const probe = document.createElement('div');
  probe.style.cssText = [
    'position:absolute',
    'visibility:hidden',
    'pointer-events:none',
    'left:0',
    'top:0',
    `width:${Math.max(1, Math.floor(widthPx))}px`,
    `font:${style.font}`,
    `font-size:${style.fontSize}`,
    `font-family:${style.fontFamily}`,
    `font-weight:${style.fontWeight}`,
    `font-style:${style.fontStyle}`,
    `line-height:${style.lineHeight}`,
    `letter-spacing:${style.letterSpacing}`,
    'white-space:pre-wrap',
    'overflow-wrap:anywhere',
    'word-break:break-word',
    'padding:0',
    'margin:0',
    'border:0',
  ].join(';');
  document.body.appendChild(probe);

  try {
    const maxHeight = readLineHeight(style) * maxLines + 1;
    probe.textContent = text;
    if (probe.scrollHeight <= maxHeight) {
      return { text, truncated: false };
    }

    let lo = 0;
    let hi = text.length;
    let best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const cut = breakNear(text, mid).replace(/\s+$/u, '');
      probe.textContent = `${cut}${SEE_MORE_SUFFIX}`;
      if (probe.scrollHeight <= maxHeight) {
        best = cut.length;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    const clipped = breakNear(text, best).replace(/\s+$/u, '');
    if (!clipped || clipped === text) {
      return { text, truncated: false };
    }
    return { text: clipped, truncated: true };
  } finally {
    probe.remove();
  }
}

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
  const [clamped, setClamped] = useState(() => ({
    text: String(text ?? ''),
    truncated: false,
  }));
  const uncontrolled = activeTicker === undefined;
  const active = uncontrolled ? localActive : activeTicker;
  const source = uncontrolled ? 'mention' : activeSource;
  // Prefer navigating to the security page; position details live in the bottom tags.
  const openSecurity = Boolean(onOpenStock);
  const clampLines = Number(maxLines) > 0 ? Number(maxLines) : null;
  const fullText = String(text ?? '');

  useLayoutEffect(() => {
    if (!clampLines) {
      setClamped({ text: fullText, truncated: false });
      return undefined;
    }

    const el = rootRef.current;
    if (!el) return undefined;

    const run = () => {
      const width = el.clientWidth;
      if (width <= 0) return;
      const next = clampTextToLines(fullText, clampLines, width, getComputedStyle(el));
      setClamped((prev) =>
        prev.text === next.text && prev.truncated === next.truncated ? prev : next
      );
    };

    run();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(run) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [fullText, clampLines]);

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
  const lines = clamped.text.split('\n').map((line) => {
    if (line.trim()) contentLineIndex += 1;
    return { line, contentLineIndex };
  });

  return (
    <div
      ref={rootRef}
      className={`whitespace-pre-wrap text-left text-[16px] font-normal leading-[1.55] text-pe-ink ${className}`}
    >
      {lines.map(({ line, contentLineIndex: index }, i) => (
        <span key={i}>
          {renderText(line, index)}
          {i < lines.length - 1 ? '\n' : null}
        </span>
      ))}
      {clamped.truncated ? (
        <>
          …
          {' '}
          <button
            type="button"
            className="inline p-0 text-[14px] font-semibold leading-[1.55] text-pe-link"
            onClick={(event) => {
              event.stopPropagation();
              onSeeMore?.();
            }}
          >
            {SEE_MORE_LABEL}
          </button>
        </>
      ) : null}
    </div>
  );
}
