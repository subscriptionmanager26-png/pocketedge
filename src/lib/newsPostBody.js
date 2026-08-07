/**
 * PocketEdge News helpers — AI summaries (`via.source === 'mn_news_ai_summaries'`).
 *
 * Card hierarchy: Company Name → Title → Text → logo image.
 */

export function isNewsSocialPost(post) {
  return post?.via?.source === 'mn_news_ai_summaries' || post?.kind === 'news';
}

/**
 * Normalize PocketEdge News feed bodies so ticker + headline share one line,
 * then a blank line, then bullets.
 *
 * Legacy shape:
 *   @RELIANCE
 *
 *   Headline text
 *
 *   • bullet
 *
 * Desired:
 *   @RELIANCE Headline text
 *
 *   • bullet
 */
export function reshapeNewsFeedBody(text) {
  const raw = String(text ?? '');
  if (!raw.trim()) return raw;

  const lines = raw.split('\n');
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i += 1;
  if (i >= lines.length) return raw;

  const first = lines[i].trim();
  // Security tag alone: @RELIANCE / $RELIANCE (optional trailing colon)
  if (!/^[@$][A-Za-z0-9._-]+\s*:?$/.test(first)) return raw;

  let j = i + 1;
  while (j < lines.length && !lines[j].trim()) j += 1;
  if (j >= lines.length) return raw;

  const second = lines[j].trim();
  if (/^[•\-*]/.test(second)) return raw;

  let k = j + 1;
  while (k < lines.length && !lines[k].trim()) k += 1;

  const head = `${first.replace(/:$/, '')} ${second}`;
  const rest = lines.slice(k);
  if (!rest.length) return head;
  return `${head}\n\n${rest.join('\n')}`.replace(/\n+$/, '');
}

const TICKER_PREFIX_RE = /^[@$]([A-Za-z0-9._-]+)\s*:?\s*(.*)$/;

/**
 * Split a news social post into display parts.
 * @returns {{ symbol: string | null, title: string, text: string, assetType: string }}
 */
export function parseNewsSocialContent(post) {
  const via = post?.via ?? null;
  const assetType = String(via?.type ?? 'Stock')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '') || 'stock';

  const raw = String(post?.body ?? '');
  const lines = raw.split('\n');

  let symbol = String(via?.ticker ?? '')
    .trim()
    .toUpperCase() || null;
  let title = '';
  let bodyStart = 0;

  let i = 0;
  while (i < lines.length && !lines[i].trim()) i += 1;

  if (i < lines.length) {
    const first = lines[i].trim();
    const match = first.match(TICKER_PREFIX_RE);
    if (match) {
      if (!symbol) symbol = match[1].toUpperCase();
      const remainder = String(match[2] ?? '').trim();
      if (remainder) {
        title = remainder;
        bodyStart = i + 1;
      } else {
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j += 1;
        if (j < lines.length && !/^[•\-*]/.test(lines[j].trim())) {
          title = lines[j].trim();
          bodyStart = j + 1;
        } else {
          bodyStart = i + 1;
        }
      }
    } else if (!/^[•\-*]/.test(first)) {
      title = first;
      bodyStart = i + 1;
    } else {
      bodyStart = i;
    }
  }

  while (bodyStart < lines.length && !lines[bodyStart].trim()) bodyStart += 1;
  const text = lines.slice(bodyStart).join('\n').replace(/^\n+|\n+$/g, '');

  return {
    symbol,
    title,
    text,
    assetType: assetType === 'etf' ? 'etf' : 'stock',
  };
}
