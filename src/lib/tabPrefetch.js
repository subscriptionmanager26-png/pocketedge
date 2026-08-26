import { getAppCurrentUserId } from './socialIdentity';
import { NEWS_ALL_PORTFOLIOS_ID } from './newsFilters';

const prefetchedChunks = new Set();

function prefetchChunk(importer, key) {
  if (prefetchedChunks.has(key)) return;
  prefetchedChunks.add(key);
  importer().catch(() => {
    prefetchedChunks.delete(key);
  });
}

/** Warm Ideas, Portfolio, Profile chunks + default tab data after auth. */
export function prefetchAppTabData(ownerId = getAppCurrentUserId()) {
  prefetchTab('ideas', ownerId);
  prefetchTab('news', ownerId);
  prefetchTab('portfolio', ownerId);
  prefetchTab('profile', ownerId);
}

export function prefetchTab(tab, ownerId = getAppCurrentUserId()) {
  switch (tab) {
    case 'news':
      prefetchChunk(() => import('../pages/NewsPage'), 'news');
      import('../lib/socialPostApi')
        .then(async (m) => {
          const items = await m.fetchNewsPosts?.({ limit: 20 });
          if (!Array.isArray(items)) return;
          const { newsFilterKey, writeCachedNews } = await import('../lib/newsCache');
          writeCachedNews({
            filterKey: newsFilterKey({ guestMode: false, scope: 'global' }),
            items,
            filterUi: {
              scope: 'global',
              selectedPortfolioId: NEWS_ALL_PORTFOLIOS_ID,
              customDim: 'company',
              companies: [],
              companyLabels: {},
              types: [],
              industries: [],
            },
          });
        })
        .catch(() => {});
      break;
    case 'ideas':
      prefetchChunk(() => import('../pages/IdeasPage'), 'ideas');
      prefetchChunk(() => import('../pages/StockInvestmentPage'), 'stock-detail');
      prefetchChunk(() => import('../pages/InvestmentPage'), 'fund-detail');
      prefetchChunk(() => import('../pages/IndexDetailPage'), 'index-detail');
      prefetchChunk(() => import('../pages/CommodityDetailPage'), 'commodity-detail');
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
