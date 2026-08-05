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
