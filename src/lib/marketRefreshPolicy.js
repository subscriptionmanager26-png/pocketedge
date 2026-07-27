import {
  fetchMarketPreview,
  resolveMarketCommodity,
  resolveMarketFund,
  resolveMarketIndex,
  resolveMarketStock,
  searchMarketTab,
} from './marketDataApi';
import { isInFundNavPublishWindow } from './fundDayPnl';

/** @typedef {'index'|'stock'|'etf'|'bond'|'commodity'|'fund'} MarketAssetType */

const TAB_TO_ASSET_TYPE = {
  stocks: 'stock',
  etf: 'etf',
  mutual_funds: 'fund',
  commodity: 'commodity',
  indices: 'index',
};

const POLL_INTERVAL_MS = {
  index: 60_000,
  stock: 15_000,
  etf: 15_000,
  bond: 15_000,
  commodity: 300_000,
  fund: 21_600_000,
};

const RESOLVE_FN = {
  index: resolveMarketIndex,
  stock: resolveMarketStock,
  etf: resolveMarketStock,
  bond: resolveMarketStock,
  commodity: resolveMarketCommodity,
  fund: resolveMarketFund,
};

/** @returns {MarketAssetType|null} */
export function tabToAssetType(tab) {
  return TAB_TO_ASSET_TYPE[tab] ?? null;
}

/** @returns {number|null} null = no polling (mount-only). */
export function getPollIntervalMs(assetType) {
  if (!assetType) return null;
  return POLL_INTERVAL_MS[assetType] ?? null;
}

export function getResolveFn(assetType) {
  return RESOLVE_FN[assetType] ?? null;
}

function getIstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const pick = (type) => parts.find((part) => part.type === type)?.value;
  return {
    weekday: pick('weekday'),
    hour: Number(pick('hour')),
    minute: Number(pick('minute')),
  };
}

function isWeekday(weekday) {
  return weekday !== 'Sat' && weekday !== 'Sun';
}

function minutesSinceMidnight(hour, minute) {
  return hour * 60 + minute;
}

/** NSE-linked assets (indices, stocks, ETFs, bonds): Mon–Fri 09:00–16:00 IST. */
export function isInNseSession(date = new Date()) {
  const { weekday, hour, minute } = getIstParts(date);
  if (!isWeekday(weekday)) return false;
  const mins = minutesSinceMidnight(hour, minute);
  return mins >= 9 * 60 && mins <= 16 * 60;
}

/** MCX session: Mon–Fri 09:00–23:30 IST. */
export function isInMcxSession(date = new Date()) {
  const { weekday, hour, minute } = getIstParts(date);
  if (!isWeekday(weekday)) return false;
  const mins = minutesSinceMidnight(hour, minute);
  return mins >= 9 * 60 && mins <= 23 * 60 + 30;
}

function isInSessionForAsset(assetType, date = new Date()) {
  if (!assetType || assetType === 'fund') return true;
  if (assetType === 'commodity') return isInMcxSession(date);
  // index, stock, etf, bond share NSE hours
  return isInNseSession(date);
}

function isDocumentVisible() {
  if (typeof document === 'undefined') return true;
  return !document.hidden;
}

/**
 * Whether FE should poll Supabase for fresh quotes.
 * Respects IST session windows and Page Visibility.
 */
export function shouldPollMarket(assetType, { date = new Date(), visible = isDocumentVisible() } = {}) {
  if (!visible) return false;
  if (!getPollIntervalMs(assetType)) return false;
  return isInSessionForAsset(assetType, date);
}

/** Policy entry for a markets tab or asset type. */
export function getMarketRefreshPolicy({ tab, assetType: rawAssetType } = {}) {
  const assetType = rawAssetType ?? tabToAssetType(tab);
  const intervalMs = getPollIntervalMs(assetType);
  const resolveFn = getResolveFn(assetType);
  const session =
    assetType === 'commodity' ? 'mcx' : assetType === 'fund' ? 'anytime' : 'nse';

  return {
    assetType,
    tab,
    intervalMs,
    session,
    resolveFn,
    shouldPoll: (opts) => shouldPollMarket(assetType, opts),
    previewFn: tab ? () => fetchMarketPreview(tab) : null,
    searchFn: tab ? (query) => searchMarketTab(tab, query) : null,
  };
}

/** Portfolio holdings may span classes — poll during NSE/MCX or the evening fund NAV window. */
export function shouldPollPortfolioRefresh(date = new Date()) {
  if (!isDocumentVisible()) return false;
  return isInNseSession(date) || isInMcxSession(date) || isInFundNavPublishWindow(date);
}

export const PORTFOLIO_POLL_INTERVAL_MS = 60_000;
