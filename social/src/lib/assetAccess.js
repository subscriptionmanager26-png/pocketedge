import { FUND_HOLDERS, MY_FUND_WATCHLIST } from '../data/fundData';
import { AUTHOR_POSITIONS, CURRENT_USER } from '../data/mockData';
import { getReviewsForFund } from './reviewStore';
import { getWatchlists } from './watchlistStore';

/** User holds or watches this stock. */
export function hasStockAccess(ticker) {
  const position = AUTHOR_POSITIONS[CURRENT_USER.id]?.[ticker];
  if (position?.status === 'holds' || position?.status === 'watchlist') return true;
  return getWatchlists().some((list) => list.tickers.includes(ticker));
}

/** User holds, watches, or has reviewed this fund. */
export function hasFundAccess(fundId) {
  if ((FUND_HOLDERS[fundId] ?? []).includes(CURRENT_USER.id)) return true;
  if (MY_FUND_WATCHLIST.includes(fundId)) return true;
  return getReviewsForFund(fundId).some((r) => r.authorId === CURRENT_USER.id);
}
