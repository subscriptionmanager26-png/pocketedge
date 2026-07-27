/**
 * Mutual-fund Day's PnL is NAV-date based, not intraday.
 * AMFI NAVs typically land ~9:30–10:10 PM IST; until today's NAV is in the DB,
 * fund contributions to Day's PnL are treated as 0.
 */

/** Calendar date in Asia/Kolkata as YYYY-MM-DD. */
export function istDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function isFundHolding(holding) {
  const type = String(holding?.assetType ?? holding?.kind ?? '').toLowerCase();
  if (type === 'fund') return true;
  // AMFI scheme codes are numeric strings (6+ digits).
  return /^\d{6,}$/.test(String(holding?.ticker ?? '').trim());
}

/**
 * True when this fund quote's NAV date is today's IST calendar date —
 * i.e. today's NAV has been published and ingested.
 */
export function isFundNavForToday(asOfDate, date = new Date()) {
  if (asOfDate == null || asOfDate === '') return false;
  return String(asOfDate).slice(0, 10) === istDateString(date);
}

/**
 * Day-change % to use for portfolio Day's PnL.
 * Stocks/ETFs/etc. keep their live changePct; funds only count after today's NAV.
 */
export function dayChangePctForPnl(holding, date = new Date()) {
  const raw = Number(holding?.changePct ?? holding?.dayChangePct);
  const changePct = Number.isFinite(raw) ? raw : 0;
  if (!isFundHolding(holding)) return changePct;

  const asOf =
    holding?.asOfDate ?? holding?.navDate ?? holding?.as_of_date ?? holding?.nav_date ?? null;
  return isFundNavForToday(asOf, date) ? changePct : 0;
}

/** Evening window when AMFI NAVs are expected (IST). */
export function isInFundNavPublishWindow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  const mins = hour * 60 + minute;
  // Poll through the evening NAV window so the UI picks up fresh NAVs.
  return mins >= 21 * 60 + 15 && mins <= 23 * 60 + 45;
}
