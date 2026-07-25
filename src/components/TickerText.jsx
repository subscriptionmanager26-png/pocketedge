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

function makeProbe(widthPx, style, { nowrap = false } = {}) {
  const probe = document.createElement('div');
  probe.style.cssText = [
    'position:absolute',
    'visibility:hidden',
    'pointer-events:none',
    'left:-9999px',
    'top:0',
    `width:${Math.max(1, Math.floor(widthPx))}px`,
    `font-size:${style.fontSize}`,
    `font-family:${style.fontFamily}`,
    `font-weight:${style.fontWeight}`,
    `font-style:${style.fontStyle}`,
    `line-height:${style.lineHeight}`,
    `letter-spacing:${style.letterSpacing}`,
    nowrap ? 'white-space:nowrap' : 'white-space:pre-wrap',
    'overflow-wrap:anywhere',
    'word-break:break-word',
    'padding:0',
    'margin:0',
    'border:0',
  ].join(';');
  return probe;
}

/** Split rendered text into visual lines using Range client rects. */
function getVisualLines(text, widthPx, style) {
  if (!text) return [];

  const probe = makeProbe(widthPx, style);
  probe.textContent = text;
  document.body.appendChild(probe);

  try {
    const textNode = probe.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
      return [{ start: 0, end: text.length, text }];
    }

    const range = document.createRange();
    const lines = [];
    let lineStart = 0;
    let prevLineIndex = 0;

    for (let i = 0; i < text.length; i += 1) {
      range.setStart(textNode, 0);
      range.setEnd(textNode, i + 1);
      const lineIndex = Math.max(0, range.getClientRects().length - 1);
      if (lineIndex > prevLineIndex) {
        lines.push({
          start: lineStart,
          end: i,
          text: text.slice(lineStart, i),
        });
        lineStart = i;
        prevLineIndex = lineIndex;
      }
    }

    lines.push({
      start: lineStart,
      end: text.length,
      text: text.slice(lineStart),
    });
    return lines;
  } finally {
    probe.remove();
  }
}

function measureInlineWidth(htmlOrText, widthPx, style, { html = false } = {}) {
  const probe = makeProbe(widthPx, style, { nowrap: true });
  if (html) probe.innerHTML = htmlOrText;
  else probe.textContent = htmlOrText;
  document.body.appendChild(probe);
  try {
    return probe.scrollWidth;
  } finally {
    probe.remove();
  }
}

function measureSeeMoreWidth(widthPx, style) {
  return measureInlineWidth(
    `…&nbsp;<span style="font-weight:600;font-size:14px">${SEE_MORE_LABEL}</span>`,
    widthPx,
    style,
    { html: true }
  );
}

function truncateLineToWidth(lineText, maxWidth, widthPx, style) {
  const cleaned = lineText.replace(/^\n/, '');
  if (!cleaned) return '';
  if (measureInlineWidth(cleaned, widthPx, style) <= maxWidth) {
    return cleaned.replace(/\s+$/u, '');
  }

  let lo = 0;
  let hi = cleaned.length;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    let cut = cleaned.slice(0, mid);
    const space = cut.lastIndexOf(' ');
    if (space > mid * 0.5) cut = cut.slice(0, space);
    cut = cut.replace(/\s+$/u, '');
    if (cut && measureInlineWidth(cut, widthPx, style) <= maxWidth) {
      best = cut.length;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return cleaned.slice(0, best).replace(/\s+$/u, '');
}

/**
 * Keep visual lines 1..(n-1) fully filled. On line n, keep as much text as
 * fits beside "… See more".
 */
function clampTextToLines(text, maxLines, widthPx, style) {
  if (!text || !widthPx || maxLines <= 0) {
    return { text, truncated: false };
  }

  const lines = getVisualLines(text, widthPx, style);
  if (lines.length <= maxLines) {
    return { text, truncated: false };
  }

  const seeMoreWidth = measureSeeMoreWidth(widthPx, style);
  const lastBudget = Math.max(8, widthPx - seeMoreWidth - 2);
  const lastLine = lines[maxLines - 1];
  let lastText = truncateLineToWidth(lastLine.text, lastBudget, widthPx, style);

  // If the 4th visual line was only a break/whitespace, anchor See more on the previous line.
  if (!lastText && maxLines > 1) {
    const prev = lines[maxLines - 2];
    lastText = truncateLineToWidth(prev.text, lastBudget, widthPx, style);
    const clipped = `${text.slice(0, prev.start)}${lastText}`.replace(/\s+$/u, '');
    return { text: clipped, truncated: true };
  }

  const clipped = `${text.slice(0, lastLine.start)}${lastText}`.replace(/\s+$/u, '');
  if (!clipped) {
    return { text, truncated: false };
  }
  return { text: clipped, truncated: true };
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
            className="inline p-0 align-baseline text-[14px] font-semibold leading-[inherit] text-pe-link"
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
