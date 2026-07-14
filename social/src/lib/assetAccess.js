import { FUND_HOLDERS, MY_FUND_WATCHLIST } from '../data/fundData';
import { AUTHOR_POSITIONS } from '../data/mockData';
import { isDevMockMode } from './appMode';
import { getAppCurrentUserId } from './socialIdentity';
import { getReviewsForFund, hasCommunityReviewsAccess } from './reviewStore';
import { getWatchlists } from './watchlistStore';

/** User has unlocked community features (e.g. indices, commodities). */
export function hasMarketAssetAccess() {
  return hasCommunityReviewsAccess();
}

/** User holds or watches this stock. */
export function hasStockAccess(ticker) {
  if (!ticker) return false;

  // Production: only live watchlists — never demo AUTHOR_POSITIONS.
  if (!isDevMockMode()) {
    return getWatchlists().some((list) => (list.tickers ?? []).includes(ticker));
  }

  const me = getAppCurrentUserId();
  const position = AUTHOR_POSITIONS[me]?.[ticker] ?? AUTHOR_POSITIONS.u_me?.[ticker];
  if (position?.status === 'holds' || position?.status === 'watchlist') return true;
  return getWatchlists().some((list) => (list.tickers ?? []).includes(ticker));
}

/** User holds, watches, or has reviewed this fund. */
export function hasFundAccess(fundId) {
  if (!fundId) return false;
  const me = getAppCurrentUserId();

  if (!isDevMockMode()) {
    // Production: only the live user's own review unlocks fund community data.
    return getReviewsForFund(fundId).some((r) => r.authorId === me);
  }

  if ((FUND_HOLDERS[fundId] ?? []).includes(me) || (FUND_HOLDERS[fundId] ?? []).includes('u_me')) {
    return true;
  }
  if (MY_FUND_WATCHLIST.includes(fundId)) return true;
  return getReviewsForFund(fundId).some((r) => r.authorId === me || r.authorId === 'u_me');
}
