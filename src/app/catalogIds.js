/** Stable UUIDs for catalog baskets (seeded in Supabase). */
export const CATALOG_BASKET_IDS = {
  'ai-data-center': 'c0100001-0001-4001-8001-000000000001',
  'us-tech-giants': 'c0100001-0001-4001-8001-000000000002',
  'global-ev': 'c0100001-0001-4001-8001-000000000003',
  'dividend-quality': 'c0100001-0001-4001-8001-000000000004',
};

export const CATALOG_OWNER_ID = 'b5db5a37-926e-4c9a-bee7-80430d98d35f';

export function resolveCatalogBasketId(idOrSlug) {
  if (!idOrSlug) return null;
  if (Object.values(CATALOG_BASKET_IDS).includes(idOrSlug)) return idOrSlug;
  return CATALOG_BASKET_IDS[idOrSlug] ?? idOrSlug;
}
