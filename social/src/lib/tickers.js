/**
 * Security mentions in posts.
 *
 * Stocks / ETFs: `@RELIANCE` (symbol, no spaces)
 * Mutual funds:  `@[HDFC Flexi Cap Fund]` (brackets allow spaces in the name)
 *
 * Plain `@TOKEN` stops at whitespace or punctuation so typing after a mention
 * never keeps extending the underlined token.
 */

const BRACKET_MENTION_RE = /@\[([^\]]{1,80})\]/gi;
const PLAIN_MENTION_RE = /@([A-Za-z0-9][A-Za-z0-9.&-]{0,31})(?=\s|[.,!?;:'")\]]|$)/g;
const LEGACY_CASH_TAG_RE = /\$([A-Za-z][A-Za-z0-9]{0,11})(?=\s|[.,!?;:'")\]]|$)/g;

/** Split body into plain text and mention tokens for rendering. */
export const MENTION_PARTS_RE =
  /(@\[[^\]]{1,80}\]|@[A-Za-z0-9][A-Za-z0-9.&-]{0,31}(?=\s|[.,!?;:'")\]]|$)|\$[A-Za-z][A-Za-z0-9]{0,11}(?=\s|[.,!?;:'")\]]|$))/g;

export function formatTicker(ticker) {
  return ticker ?? '';
}

/** Token stored in the post body (without leading @). */
export function mentionTokenFromAsset(asset) {
  if (!asset) return '';
  if (asset.kind === 'fund') {
    const label = String(asset.name || asset.key || '').trim();
    return label ? `[${label}]` : '';
  }
  return String(asset.key || '')
    .trim()
    .toUpperCase();
}

/** Insertable text including @ and a trailing space. */
export function mentionInsertText(asset) {
  const token = mentionTokenFromAsset(asset);
  if (!token) return '';
  return `@${token} `;
}

export function parseMentionPart(part) {
  if (!part) return null;
  if (part.startsWith('@[' ) && part.endsWith(']')) {
    return { raw: part, key: part.slice(2, -1), kind: 'fund' };
  }
  if (part.startsWith('@')) {
    return { raw: part, key: part.slice(1), kind: 'symbol' };
  }
  if (part.startsWith('$')) {
    return { raw: part, key: part.slice(1), kind: 'symbol' };
  }
  return null;
}

export function mentionDisplayLabel(partOrKey) {
  const parsed =
    typeof partOrKey === 'string' && partOrKey.startsWith('@')
      ? parseMentionPart(partOrKey)
      : { key: partOrKey };
  const key = parsed?.key ?? '';
  return key;
}

export function extractTickers(text = '') {
  const found = [];
  const seen = new Set();

  const push = (key, { upper = false } = {}) => {
    let value = String(key ?? '').trim();
    if (!value) return;
    if (upper) value = value.toUpperCase();
    const seenKey = value.toUpperCase();
    if (seen.has(seenKey)) return;
    seen.add(seenKey);
    found.push(value);
  };

  for (const match of text.matchAll(BRACKET_MENTION_RE)) push(match[1]);
  for (const match of text.matchAll(PLAIN_MENTION_RE)) push(match[1], { upper: true });
  for (const match of text.matchAll(LEGACY_CASH_TAG_RE)) push(match[1], { upper: true });

  return found;
}

export function bodyMentionsTicker(body = '', ticker) {
  const needle = String(ticker ?? '').trim();
  if (!needle) return false;
  const upperBody = String(body).toUpperCase();
  const upperNeedle = needle.toUpperCase();
  if (upperBody.includes(`@[${upperNeedle}]`)) return true;
  if (upperBody.includes(`@${upperNeedle}`) || upperBody.includes(`$${upperNeedle}`)) return true;
  return extractTickers(body).some((entry) => entry.toUpperCase() === upperNeedle);
}

export function statusStyles(status) {
  switch (status) {
    case 'holds':
      return {
        underline: 'decoration-pe-positive text-pe-positive',
        chip: 'border-pe-positive/25 bg-pe-positive/8 text-pe-positive',
        label: 'Holds',
        dot: 'bg-pe-positive',
      };
    case 'exited':
      return {
        underline: 'decoration-pe-negative text-pe-negative',
        chip: 'border-pe-negative/25 bg-pe-negative/8 text-pe-negative',
        label: 'Exited',
        dot: 'bg-pe-negative',
      };
    case 'watchlist':
      return {
        underline: 'decoration-pe-warning text-pe-warning',
        chip: 'border-pe-warning/25 bg-pe-warning/8 text-pe-warning',
        label: 'Watchlist',
        dot: 'bg-pe-warning',
      };
    default:
      return {
        underline: 'decoration-pe-accent text-pe-accent',
        chip: 'border-pe-accent/25 bg-pe-accent/8 text-pe-accent',
        label: 'No position',
        dot: 'bg-pe-accent',
      };
  }
}

/** Active @query in a textarea, if any (no spaces — legacy single-token). */
export function getActiveMention(text, cursor) {
  const upto = String(text ?? '').slice(0, Math.max(0, cursor ?? 0));
  const at = upto.lastIndexOf('@');
  if (at < 0) return null;

  const before = at === 0 ? '' : upto[at - 1];
  if (before && /[A-Za-z0-9\]]$/.test(before)) return null;

  const fragment = upto.slice(at + 1);
  if (fragment.includes('\n')) return null;
  if (fragment.startsWith('[')) return null;
  if (/\s/.test(fragment)) return null;

  return {
    start: at,
    end: cursor,
    query: fragment,
  };
}

/** Mention search session started at `start` (@ index); query may include spaces. */
export function getMentionSessionQuery(text, cursor, start) {
  if (start == null || start < 0) return null;
  const value = String(text ?? '');
  if (value[start] !== '@') return null;
  const end = Math.max(start + 1, Math.min(cursor ?? value.length, value.length));
  if (end <= start) return null;
  return {
    start,
    end,
    query: value.slice(start + 1, end),
  };
}

export function replaceMentionSession(text, session, insertText) {
  if (!session) return { text, cursor: String(text ?? '').length };
  const value = String(text ?? '');
  const next = `${value.slice(0, session.start)}${insertText}${value.slice(session.end)}`;
  const nextCursor = session.start + insertText.length;
  return { text: next, cursor: nextCursor };
}

export function replaceActiveMention(text, cursor, insertText) {
  const active = getActiveMention(text, cursor);
  if (!active) {
    return { text, cursor };
  }
  return replaceMentionSession(text, active, insertText);
}

/** Pixel offset of caret inside a textarea (relative to textarea top-left). */
export function getTextareaCaretOffset(textarea, position) {
  if (!textarea) return { top: 0, left: 0, height: 20 };

  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  const properties = [
    'boxSizing',
    'width',
    'height',
    'overflowX',
    'overflowY',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontSizeAdjust',
    'lineHeight',
    'fontFamily',
    'textAlign',
    'textTransform',
    'textIndent',
    'textDecoration',
    'letterSpacing',
    'wordSpacing',
    'tabSize',
    'whiteSpace',
    'wordWrap',
    'wordBreak',
  ];

  mirror.setAttribute('aria-hidden', 'true');
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';

  for (const prop of properties) {
    mirror.style[prop] = style[prop];
  }

  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.height = 'auto';
  mirror.style.overflow = 'hidden';

  const value = textarea.value;
  const before = value.slice(0, position);
  mirror.textContent = before;

  const marker = document.createElement('span');
  marker.textContent = value.slice(position) || '.';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const top =
    marker.offsetTop -
    textarea.scrollTop +
    Number.parseFloat(style.borderTopWidth || '0');
  const left =
    marker.offsetLeft -
    textarea.scrollLeft +
    Number.parseFloat(style.borderLeftWidth || '0');
  const height = marker.offsetHeight || Number.parseFloat(style.lineHeight) || 20;

  document.body.removeChild(mirror);
  return { top, left, height };
}
