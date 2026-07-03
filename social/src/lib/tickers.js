const TICKER_RE = /\$([A-Z][A-Z0-9]{1,11})\b/g;

export function extractTickers(text = '') {
  const found = new Set();
  for (const match of text.matchAll(TICKER_RE)) {
    found.add(match[1]);
  }
  return [...found];
}

export function statusStyles(status) {
  switch (status) {
    case 'holds':
      return {
        underline: 'decoration-pe-positive',
        chip: 'border-pe-positive/40 bg-pe-positive/10 text-pe-positive',
        label: 'Holds',
        dot: 'bg-pe-positive',
      };
    case 'exited':
      return {
        underline: 'decoration-pe-negative',
        chip: 'border-pe-negative/40 bg-pe-negative/10 text-pe-negative',
        label: 'Exited',
        dot: 'bg-pe-negative',
      };
    case 'watchlist':
      return {
        underline: 'decoration-pe-warning',
        chip: 'border-pe-warning/40 bg-pe-warning/10 text-pe-warning',
        label: 'Watchlist',
        dot: 'bg-pe-warning',
      };
    default:
      return {
        underline: 'decoration-pe-ticker',
        chip: 'border-pe-ticker/40 bg-pe-ticker/10 text-pe-ticker',
        label: 'No position',
        dot: 'bg-pe-ticker',
      };
  }
}
