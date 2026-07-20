import { getAppCurrentUserId } from './socialIdentity';

const prefetchedChunks = new Set();

function prefetchChunk(importer, key) {
  if (prefetchedChunks.has(key)) return;
  prefetchedChunks.add(key);
  importer().catch(() => {
    prefetchedChunks.delete(key);
  });
}

/** Warm Markets, Portfolio, Profile chunks + default tab data after auth. */
export function prefetchAppTabData(ownerId = getAppCurrentUserId()) {
  prefetchTab('markets', ownerId);
  prefetchTab('portfolio', ownerId);
  prefetchTab('profile', ownerId);
}

export function prefetchTab(tab, ownerId = getAppCurrentUserId()) {
  switch (tab) {
    case 'markets':
      prefetchChunk(() => import('../pages/MarketsPage'), 'markets');
      import('../lib/marketDataApi')
        .then((m) => m.fetchMarketPreview('stocks'))
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
