/**
 * Mutual-fund Day's PnL is NAV-date based, not intraday.
 *
 * AMFI NAVs for calendar day D mostly land night D / morning D+1.
 * Portfolio Day's PnL on calendar day D therefore uses the fund move for
 * as_of_date = D-1 (yesterday IST). Stocks/ETFs/bonds stay same-day.
 *
 * After ~23:30 IST many funds already publish same-day NAV. In that case the
 * live quote's as_of_date is today, and Day's PnL must come from the previous
 * NAV observation (previousAsOfDate / previousChangePct) returned by the API.
 *
 * Backend fetch slots (IST): 23:00, 23:30, 00:30, 10:00, 10:30.
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

/** Yesterday's calendar date in Asia/Kolkata as YYYY-MM-DD. */
export function istYesterdayString(date = new Date()) {
  // Walk back ~26h then format in IST so DST-less Asia/Kolkata stays correct.
  const probe = new Date(date.getTime() - 26 * 60 * 60 * 1000);
  const today = istDateString(date);
  for (let i = 0; i < 48; i += 1) {
    const candidate = new Date(probe.getTime() + i * 60 * 60 * 1000);
    const label = istDateString(candidate);
    if (label < today) return label;
  }
  // Fallback: UTC-day arithmetic (sufficient for IST which has no DST).
  const [y, m, d] = today.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return utc.toISOString().slice(0, 10);
}

function isFundHolding(holding) {
  const type = String(holding?.assetType ?? holding?.kind ?? '').toLowerCase();
  if (type === 'fund') return true;
  // AMFI scheme codes are numeric strings (6+ digits).
  return /^\d{6,}$/.test(String(holding?.ticker ?? '').trim());
}

/**
 * True when this fund quote's NAV date is today's IST calendar date.
 * @deprecated Prefer isFundNavForPnlDay for Day's PnL; kept for callers checking publish status.
 */
export function isFundNavForToday(asOfDate, date = new Date()) {
  if (asOfDate == null || asOfDate === '') return false;
  return String(asOfDate).slice(0, 10) === istDateString(date);
}

/**
 * True when this fund NAV date should count toward Day's PnL on `date`
 * (as_of_date === yesterday IST).
 */
export function isFundNavForPnlDay(asOfDate, date = new Date()) {
  if (asOfDate == null || asOfDate === '') return false;
  return String(asOfDate).slice(0, 10) === istYesterdayString(date);
}

/**
 * Day-change % to use for portfolio Day's PnL.
 * Stocks/ETFs/bonds keep live changePct; funds use yesterday's NAV date move.
 *
 * After ~23:30 IST many funds already expose same-day NAV (asOfDate = today).
 * In that case use previousChangePct when previousAsOfDate is yesterday.
 */
export function dayChangePctForPnl(holding, date = new Date()) {
  const raw = Number(holding?.changePct ?? holding?.dayChangePct);
  const changePct = Number.isFinite(raw) ? raw : 0;
  if (!isFundHolding(holding)) return changePct;

  const asOf =
    holding?.asOfDate ?? holding?.navDate ?? holding?.as_of_date ?? holding?.nav_date ?? null;
  if (isFundNavForPnlDay(asOf, date)) return changePct;

  const previousAsOf =
    holding?.previousAsOfDate ??
    holding?.previous_as_of_date ??
    holding?.previousNavDate ??
    holding?.previous_nav_date ??
    null;
  if (!isFundNavForPnlDay(previousAsOf, date)) return 0;

  const previousRaw = Number(holding?.previousChangePct ?? holding?.previous_change_pct);
  return Number.isFinite(previousRaw) ? previousRaw : 0;
}

/**
 * Windows around backend AMFI fetch slots (IST), with a few minutes of slack
 * so the UI treats quotes as "live" near each poll.
 */
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
  const inBand = (center, radius = 20) => Math.abs(mins - center) <= radius
    || Math.abs(mins + 24 * 60 - center) <= radius
    || Math.abs(mins - (center + 24 * 60)) <= radius;

  // Slots: 23:00, 23:30, 00:30, 10:00, 10:30
  return (
    inBand(23 * 60) ||
    inBand(23 * 60 + 30) ||
    inBand(30) ||
    inBand(10 * 60) ||
    inBand(10 * 60 + 30)
  );
}
