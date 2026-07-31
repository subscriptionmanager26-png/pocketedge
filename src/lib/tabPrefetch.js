import { getAppCurrentUserId } from './socialIdentity';

const prefetchedChunks = new Set();

function prefetchChunk(importer, key) {
  if (prefetchedChunks.has(key)) return;
  prefetchedChunks.add(key);
  importer().catch(() => {
    prefetchedChunks.delete(key);
  });
}

/** Warm Explore, Ideas, Portfolio, Profile chunks + default tab data after auth. */
export function prefetchAppTabData(ownerId = getAppCurrentUserId()) {
  prefetchTab('explore', ownerId);
  prefetchTab('ideas', ownerId);
  prefetchTab('portfolio', ownerId);
  prefetchTab('profile', ownerId);
}

export function prefetchTab(tab, ownerId = getAppCurrentUserId()) {
  switch (tab) {
    case 'explore':
    case 'markets':
      prefetchChunk(() => import('../pages/ExplorePage'), 'explore');
      prefetchChunk(() => import('../pages/MarketsPage'), 'markets');
      prefetchChunk(() => import('../pages/StockInvestmentPage'), 'stock-detail');
      prefetchChunk(() => import('../pages/InvestmentPage'), 'fund-detail');
      prefetchChunk(() => import('../pages/IndexDetailPage'), 'index-detail');
      prefetchChunk(() => import('../pages/CommodityDetailPage'), 'commodity-detail');
      import('../lib/marketDataApi')
        .then((m) => m.fetchMarketPreview('stocks'))
        .catch(() => {});
      break;
    case 'ideas':
      prefetchChunk(() => import('../pages/IdeasPage'), 'ideas');
      import('../lib/socialPortfolioApi')
        .then((m) => m.fetchDiscoverPortfolios({ limit: 20 }))
        .catch(() => {});
      break;
    case 'portfolio':
      prefetchChunk(() => import('../pages/PortfolioPage'), 'portfolio');
      if (ownerId) {
        import('../lib/socialPortfolioApi')
          .then((m) => m.fetchUserPortfolios(ownerId))
          .catch(() => {});
      }
      break;
    case 'profile':
      prefetchChunk(() => import('../pages/ProfilePage'), 'profile');
      if (ownerId) {
        import('../lib/socialPortfolioApi')
          .then((m) => m.fetchUserPortfolios(ownerId))
          .catch(() => {});
      }
      break;
    default:
      break;
  }
}
