import { isDevMockMode } from './appMode';
import {
  getFollowedTopicSlugs,
  getFollowingIds,
  getMyRecentFollowerEvents,
} from './socialGraphStore';
import {
  MY_PORTFOLIO,
  PORTFOLIO_CHANGES,
  PORTFOLIO_UPDATES,
  POSTS,
  USER_TRADES,
  getPerson,
} from '../data/mockData';
import { formatTicker } from './tickers';

function relativeToIso(time = '') {
  const now = Date.now();
  const match = String(time).match(/^(\d+)(m|h|d)$/);
  if (!match) return new Date(now).toISOString();
  const amount = Number(match[1]);
  const unit = match[2];
  const ms =
    unit === 'm' ? amount * 60_000 : unit === 'h' ? amount * 3_600_000 : amount * 86_400_000;
  return new Date(now - ms).toISOString();
}

function getPortfolioTickers() {
  return [...new Set(MY_PORTFOLIO.holdings.map((h) => h.ticker))];
}

function followingPostItems(followingIds) {
  return POSTS.filter(
    (post) => followingIds.has(post.authorId) && !(post.type === 'trade' && post.trade)
  ).map((post) => {
    const person = getPerson(post.authorId);
    return {
      id: `following_post_${post.id}`,
      category: 'following',
      type: 'post',
      authorId: post.authorId,
      ticker: null,
      createdAt: post.createdAt,
      title: `${person.name} posted`,
      body: post.body.slice(0, 140) + (post.body.length > 140 ? '…' : ''),
      meta: { postId: post.id },
    };
  });
}

function followingTradeItems(followingIds) {
  const items = [];
  for (const userId of followingIds) {
    for (const trade of USER_TRADES[userId] ?? []) {
      const person = getPerson(userId);
      items.push({
        id: `following_trade_${trade.id}`,
        category: 'following',
        type: 'trade',
        authorId: userId,
        ticker: trade.ticker,
        createdAt: trade.createdAt,
        title: `${person.name} ${trade.action === 'buy' ? 'bought' : 'sold'} ${formatTicker(trade.ticker)}`,
        body: `${trade.qty} shares @ portfolio “${trade.portfolioName}”`,
        meta: { trade, portfolioId: trade.portfolioId },
      });
    }
  }
  return items;
}

function followingPortfolioChangeItems(followingIds) {
  return PORTFOLIO_CHANGES.filter((change) => followingIds.has(change.userId)).map((change) => {
    const person = getPerson(change.userId);
    return {
      id: `following_portfolio_${change.id}`,
      category: 'following',
      type: 'portfolio_change',
      authorId: change.userId,
      ticker: change.ticker ?? null,
      createdAt: change.createdAt,
      title: `${person.name} updated “${change.portfolioName}”`,
      body: change.summary,
      meta: { portfolioId: change.portfolioId },
    };
  });
}

function portfolioStockItems() {
  const tickers = getPortfolioTickers();
  const items = [];

  for (const ticker of tickers) {
    for (const update of PORTFOLIO_UPDATES[ticker] ?? []) {
      if (update.type === 'news') continue;

      const authorId = update.authorId;
      if (!authorId) continue;

      const person = getPerson(authorId);
      const createdAt = relativeToIso(update.time);

      if (update.type === 'post') {
        items.push({
          id: `holding_post_${update.id}`,
          category: 'portfolio_stock',
          type: 'post',
          authorId,
          ticker,
          createdAt,
          title: `@${person.handle} on ${formatTicker(ticker)}`,
          body: update.snippet,
          meta: { postId: update.postId, ticker },
        });
      }

      if (update.type === 'buy' || update.type === 'sell') {
        items.push({
          id: `holding_trade_${update.id}`,
          category: 'portfolio_stock',
          type: 'trade',
          authorId,
          ticker,
          createdAt,
          title: `@${person.handle} ${update.type === 'buy' ? 'bought' : 'sold'} ${formatTicker(ticker)}`,
          body: `${update.qty} shares - significant community activity in a stock you hold`,
          meta: { trade: update, ticker },
        });
      }
    }
  }

  return items;
}

function newFollowerItems() {
  return getMyRecentFollowerEvents().map((event) => ({
    id: `follower_${event.followerId}_${event.createdAt ?? ''}`,
    category: 'followers',
    type: 'new_follower',
    authorId: event.followerId,
    ticker: null,
    createdAt: event.createdAt ?? new Date().toISOString(),
    title: 'started following you',
    body: '',
    meta: { followerId: event.followerId },
  }));
}

/** Activity from new followers + (in mock) followed people & holdings. */
export function getActivityFeed() {
  if (!isDevMockMode()) {
    return newFollowerItems().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  const followingIds = getFollowingIds();
  const items = [
    ...newFollowerItems(),
    ...followingPostItems(followingIds),
    ...followingTradeItems(followingIds),
    ...followingPortfolioChangeItems(followingIds),
    ...portfolioStockItems(),
  ];

  const seen = new Set();
  const deduped = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return deduped.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// re-export for tests - topic slugs unused here but kept for future filtering
export { getFollowedTopicSlugs };
