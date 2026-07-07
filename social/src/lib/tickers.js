/** Stock ticker parsing and display — mentions use @TICKER (uppercase). */

const STOCK_MENTION_RE = /@([A-Z][A-Z0-9]{1,11})\b/g;
const LEGACY_CASH_TAG_RE = /\$([A-Z][A-Z0-9]{1,11})\b/g;

export function formatTicker(ticker) {
  return ticker ?? '';
}

export function extractTickers(text = '') {
  const found = new Set();
  for (const match of text.matchAll(STOCK_MENTION_RE)) {
    found.add(match[1]);
  }
  for (const match of text.matchAll(LEGACY_CASH_TAG_RE)) {
    found.add(match[1]);
  }
  return [...found];
}

export function bodyMentionsTicker(body = '', ticker) {
  return body.includes(`@${ticker}`) || body.includes(`$${ticker}`);
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
        underline: 'decoration-pe-link text-pe-link',
        chip: 'border-pe-link/20 bg-pe-link/8 text-pe-link',
        label: 'No position',
        dot: 'bg-pe-link',
      };
  }
}
