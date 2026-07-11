/**
 * Stock news summaries from Supabase often use wire-service formatting rather than
 * valid markdown (inline bullets padded with spaces, ** segment ** delimiters).
 */
export function normalizeNewsSummaryMarkdown(raw) {
  if (!raw?.trim()) return '';

  let text = raw.replace(/\r\n/g, '\n').trim();

  // "line one          * line two" -> separate bullet lines
  text = text.replace(/\s{2,}\*\s+/g, '\n* ');

  const delimiterCount = (text.match(/\*\*/g) ?? []).length;
  if (text.startsWith('**') && delimiterCount >= 4) {
    text = normalizeBoldDelimitedBullets(text);
  }

  return text.trim();
}

function normalizeBoldDelimitedBullets(text) {
  const parts = text
    .split(/\*\*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return text;

  const lines = [];
  for (const part of parts) {
    const [headline, ...footerLines] = part.split('\n').map((line) => line.trim()).filter(Boolean);
    if (headline) lines.push(`- **${headline}**`);
    if (footerLines.length) {
      lines.push('', footerLines.join('\n'));
    }
  }

  return lines.join('\n');
}
