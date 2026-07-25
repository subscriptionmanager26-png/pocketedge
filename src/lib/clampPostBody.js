/**
 * Line-aware truncation for feed post bodies.
 *
 * Hard newlines always break. Soft wrap is greedy by word; a single token wider
 * than the container falls back to character splitting for that token only.
 */

const TOKEN_RE = /\s+|\S+/g;

let sharedContext = null;
const widthCaches = new Map();

function getMeasureContext() {
  if (sharedContext) return sharedContext;
  if (typeof document === 'undefined') return null;
  sharedContext = document.createElement('canvas').getContext('2d');
  return sharedContext;
}

/** Build a canvas `font` shorthand from a computed style. */
export function fontFromStyle(style, weight) {
  if (!style?.fontSize || !style?.fontFamily) return '';
  const fontStyle = style.fontStyle && style.fontStyle !== 'normal' ? `${style.fontStyle} ` : '';
  const fontWeight = weight ?? style.fontWeight ?? '400';
  return `${fontStyle}${fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

/** Memoized text width measurer for one font shorthand. */
export function createTextMeasurer(font) {
  const ctx = getMeasureContext();
  if (!ctx || !font) return null;

  let cache = widthCaches.get(font);
  if (!cache) {
    cache = new Map();
    widthCaches.set(font, cache);
  }

  return (value) => {
    const text = String(value ?? '');
    if (!text) return 0;
    const cached = cache.get(text);
    if (cached !== undefined) return cached;
    ctx.font = font;
    const width = ctx.measureText(text).width;
    if (cache.size < 5000) cache.set(text, width);
    return width;
  };
}

/** Longest prefix of `text` whose measured width stays within `budget`. */
function fitChars(text, measure, budget) {
  if (!text || budget <= 0) return 0;
  if (measure(text) <= budget) return text.length;

  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(text.slice(0, mid)) <= budget) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function flushLine(out, start, end) {
  out.push({ start, end });
}

function wrapHardSegment(text, segStart, segEnd, measure, width, out) {
  if (segEnd <= segStart) {
    flushLine(out, segStart, segEnd);
    return;
  }

  const segment = text.slice(segStart, segEnd);
  let lineStart = segStart;
  let lineText = '';

  TOKEN_RE.lastIndex = 0;
  let match = TOKEN_RE.exec(segment);
  while (match !== null) {
    const token = match[0];
    const tokenStart = segStart + match.index;

    if (!/\S/.test(token)) {
      // Trailing whitespace hangs at the end of a line; it never forces a wrap.
      lineText += token;
      match = TOKEN_RE.exec(segment);
      continue;
    }

    if (lineText && measure(lineText + token) <= width) {
      lineText += token;
      match = TOKEN_RE.exec(segment);
      continue;
    }

    if (lineText) {
      flushLine(out, lineStart, tokenStart);
      lineStart = tokenStart;
      lineText = '';
    }

    if (measure(token) <= width) {
      lineText = token;
      match = TOKEN_RE.exec(segment);
      continue;
    }

    // Token alone is wider than the line — split by character.
    // Keep the final chunk as the open line so later tokens (e.g. "… See more")
    // can still pack onto it when there is room.
    let remaining = token;
    let remainingStart = tokenStart;
    while (remaining.length > 0) {
      const take = Math.max(1, fitChars(remaining, measure, width));
      if (take >= remaining.length) {
        lineStart = remainingStart;
        lineText = remaining;
        break;
      }
      flushLine(out, remainingStart, remainingStart + take);
      remainingStart += take;
      remaining = remaining.slice(take);
      lineStart = remainingStart;
      lineText = '';
    }
    match = TOKEN_RE.exec(segment);
  }

  if (lineText || lineStart < segEnd) {
    flushLine(out, lineStart, segEnd);
  }
}

/** Split text into rendered lines as `{ start, end }` offsets into `text`. */
export function wrapVisualLines(text, measure, width) {
  const source = String(text ?? '');
  if (!source) return [];
  if (!measure || !(width > 0)) return [{ start: 0, end: source.length }];

  const lines = [];
  let segStart = 0;
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === '\n') {
      wrapHardSegment(source, segStart, i, measure, width, lines);
      segStart = i + 1;
    }
  }
  wrapHardSegment(source, segStart, source.length, measure, width, lines);
  return lines;
}

/**
 * Longest prefix of `[start, end)` that fits in `budget`.
 * Prefers whole words; falls back to characters when the first word is too wide.
 */
function fillToBudget(text, start, end, measure, budget) {
  if (end <= start || budget <= 0) return start;

  const segment = text.slice(start, end);
  if (measure(segment.replace(/\s+$/u, '')) <= budget) return end;

  let best = start;
  let line = '';

  TOKEN_RE.lastIndex = 0;
  let match = TOKEN_RE.exec(segment);
  while (match !== null) {
    const token = match[0];
    const candidate = line + token;
    if (measure(candidate.replace(/\s+$/u, '')) > budget) {
      if (!line && /\S/.test(token)) {
        const take = fitChars(token, measure, budget);
        if (take > 0) best = start + match.index + take;
      }
      break;
    }

    line = candidate;
    if (/\S/.test(token)) best = start + match.index + token.length;
    match = TOKEN_RE.exec(segment);
  }

  return best;
}

/**
 * Keep lines `1..maxLines-1` intact and fill the final line with as much text
 * as fits alongside the trailing affordance (`suffixWidth`, e.g. "… See more").
 */
export function clampPostBody(text, { maxLines, width, measure, suffix, suffixWidth } = {}) {
  const source = String(text ?? '');
  const lineLimit = Number(maxLines);

  if (!source || !measure || !(width > 0) || !(lineLimit > 0)) {
    return { text: source, truncated: false };
  }

  const lines = wrapVisualLines(source, measure, width);
  if (lines.length <= lineLimit) {
    return { text: source, truncated: false };
  }

  const reserve = Number.isFinite(suffixWidth) ? suffixWidth : measure(suffix ?? '');
  const budget = Math.max(0, width - reserve);

  let target = lines[lineLimit - 1];
  // A blank final line (consecutive newlines) has no room to anchor the suffix.
  if (target.end <= target.start && lineLimit > 1) {
    target = lines[lineLimit - 2];
  }

  const cut = fillToBudget(source, target.start, target.end, measure, budget);
  const clipped = source.slice(0, cut).replace(/\s+$/u, '');
  if (clipped) {
    return { text: clipped, truncated: true };
  }

  return {
    text: source.slice(0, lines[0].end).replace(/\s+$/u, ''),
    truncated: true,
  };
}
