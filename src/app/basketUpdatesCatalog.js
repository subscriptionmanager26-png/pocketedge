import { CATALOG_BASKET_IDS, resolveCatalogBasketId } from './catalogIds';

/** Mock rebalance / constituent change history for catalog baskets */

export const basketUpdatesCatalog = [
  {
    id: 'update-ai-q2',
    basketId: CATALOG_BASKET_IDS['ai-data-center'],
    date: '2026-05-28',
    title: 'Quarterly rebalance',
    summary:
      'Trimmed crowded large-cap software exposure and added to AI infrastructure leaders after relative strength review.',
    changes: [
      { symbol: 'MSFT', name: 'Microsoft', from: 10, to: 8, action: 'reduced' },
      { symbol: 'NVDA', name: 'NVIDIA', from: 12, to: 14, action: 'increased' },
      { symbol: 'SMCI', name: 'Super Micro', from: 8, to: 10, action: 'increased' },
      { symbol: 'ANET', name: 'Arista Networks', from: 7, to: 5, action: 'reduced' },
    ],
  },
  {
    id: 'update-ai-q1',
    basketId: CATALOG_BASKET_IDS['ai-data-center'],
    date: '2026-02-14',
    title: 'Constituent refresh',
    summary: 'Rotated out a lagging data-center REIT and increased TSMC weight after earnings momentum.',
    changes: [
      { symbol: 'DLR', name: 'Digital Realty', from: 7, to: 0, action: 'removed' },
      { symbol: 'TSM', name: 'TSMC', from: 10, to: 12, action: 'increased' },
      { symbol: 'VRT', name: 'Vertiv Holdings', from: 8, to: 9, action: 'increased' },
    ],
  },
  {
    id: 'update-tech-q2',
    basketId: CATALOG_BASKET_IDS['us-tech-giants'],
    date: '2026-05-20',
    title: 'Equal-weight rebalance',
    summary: 'Restored equal weights after price drift widened NVIDIA versus the rest of the basket.',
    changes: [
      { symbol: 'AAPL', name: 'Apple', from: 15, to: 20, action: 'increased' },
      { symbol: 'NVDA', name: 'NVIDIA', from: 30, to: 20, action: 'reduced' },
      { symbol: 'MSFT', name: 'Microsoft', from: 18, to: 20, action: 'increased' },
      { symbol: 'GOOGL', name: 'Alphabet', from: 17, to: 20, action: 'increased' },
      { symbol: 'AMZN', name: 'Amazon', from: 20, to: 20, action: 'unchanged' },
    ],
  },
  {
    id: 'update-ev-may',
    basketId: CATALOG_BASKET_IDS['global-ev'],
    date: '2026-05-10',
    title: 'EV supply chain tilt',
    summary: 'Reduced speculative small-cap EV exposure and reallocated to Tesla after delivery beat.',
    changes: [
      { symbol: 'RIVN', name: 'Rivian', from: 20, to: 15, action: 'reduced' },
      { symbol: 'LCID', name: 'Lucid', from: 20, to: 15, action: 'reduced' },
      { symbol: 'TSLA', name: 'Tesla', from: 20, to: 30, action: 'increased' },
      { symbol: 'NIO', name: 'NIO', from: 20, to: 20, action: 'unchanged' },
    ],
  },
];

export function getBasketUpdates(basketId) {
  const resolved = resolveCatalogBasketId(basketId);
  return basketUpdatesCatalog
    .filter(
      (update) =>
        update.basketId === resolved ||
        update.basketId === basketId ||
        resolveCatalogBasketId(update.basketId) === resolved
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function formatWeightChange(change) {
  const { symbol, name, from, to, action } = change;
  const label = name ? `${name} (${symbol})` : symbol;

  if (action === 'added') return `${label} added at ${to}%`;
  if (action === 'removed') return `${label} removed (was ${from}%)`;
  if (action === 'unchanged') return `${label} held at ${to}%`;
  if (to > from) return `${label} increased from ${from}% to ${to}%`;
  return `${label} reduced from ${from}% to ${to}%`;
}
