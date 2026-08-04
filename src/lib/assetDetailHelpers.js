import { formatNewsDate, formatPct, pnlClass } from './format';

/** Start of local calendar day in ms. */
export function startOfLocalDayMs(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function pickLatestInsight(insights) {
  return Array.isArray(insights) && insights.length ? insights[0] : null;
}

export function isInsightForToday(insight) {
  if (!insight?.asOfDate && !insight?.publishedAt) return false;
  const raw = String(insight.asOfDate || insight.publishedAt).slice(0, 10);
  const today = new Date();
  const ymd = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  return raw === ymd;
}

/** Plain-text blurb capped at maxChars (default 140). */
export function truncateSummary(text, maxChars = 140) {
  const raw = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return '';
  if (raw.length <= maxChars) return raw;
  return `${raw.slice(0, maxChars - 1).trimEnd()}…`;
}

/**
 * Split corporate actions into upcoming (soonest first) and past (newest first).
 */
export function splitCorporateActions(items) {
  const now = startOfLocalDayMs();
  const upcoming = [];
  const past = [];

  for (const item of items ?? []) {
    const ms = Number(item?.eventDateMs);
    if (Number.isFinite(ms) && ms >= now) upcoming.push(item);
    else past.push(item);
  }

  upcoming.sort((a, b) => Number(a.eventDateMs) - Number(b.eventDateMs));
  past.sort((a, b) => {
    const aMs = Number(a.eventDateMs) || 0;
    const bMs = Number(b.eventDateMs) || 0;
    if (bMs !== aMs) return bMs - aMs;
    return String(a.ticker || '').localeCompare(String(b.ticker || ''));
  });

  return {
    upcoming,
    past,
    next: upcoming[0] ?? null,
  };
}

/** Primary line for a corporate-action card (event name, not Start date noise). */
export function corporateActionTitle(item) {
  const eventType = String(item?.eventType ?? '').trim() || 'Other';
  const details = String(item?.details ?? '').trim();
  if (/^e-?voting$/i.test(eventType)) return eventType;
  // Details like "Start date: 2026-07-28" are metadata, not the event name.
  if (/^start\s*date\s*:/i.test(details)) return eventType;
  return details || eventType;
}

/** Secondary date line — prefers End Date label when present. */
export function corporateActionDateLine(item) {
  if (!item?.displayDate) return '';
  const label = String(item.dateLabel ?? '').trim();
  return label ? `${label}: ${item.displayDate}` : item.displayDate;
}

export function formatInsightChange(insight) {
  if (insight?.changePct == null || !Number.isFinite(Number(insight.changePct))) return null;
  return {
    text: formatPct(Number(insight.changePct)),
    className: pnlClass(Number(insight.changePct)),
  };
}
