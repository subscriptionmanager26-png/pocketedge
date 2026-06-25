const AUM_FLOOR_USD = 10_000_000;

export const INDEX_CATEGORIES = [
  { id: 'us', label: 'US equity' },
  { id: 'global', label: 'Global equity' },
  { id: 'europe', label: 'Europe equity' },
  { id: 'asia', label: 'Asia Pacific equity' },
  { id: 'em', label: 'Emerging markets equity' },
  { id: 'gov_bonds', label: 'Government bonds' },
  { id: 'corp_bonds', label: 'Corporate & credit bonds' },
  { id: 'other_bonds', label: 'Other fixed income' },
  { id: 'commodities', label: 'Commodities' },
  { id: 'real_estate', label: 'Real estate' },
  { id: 'thematic', label: 'Sector & thematic' },
  { id: 'other', label: 'Other / unclassified' },
];

const INDEX_CATEGORY_RULES = [
  {
    id: 'us',
    test: /s&p 500|s&p 400|s&p 600|nasdaq|russell|msci usa|dow jones|us equity|usa\b|nyse|wilshire us/i,
  },
  {
    id: 'global',
    test: /msci world|msci acwi|ftse all-world|ftse all world|global equity|developed world|stoxx.*global|world equity/i,
  },
  {
    id: 'europe',
    test: /msci europe|stoxx|euro stoxx|dax\b|cac 40|ftse 100|ftse 250|ftse mib|aex\b|smi\b|bel 20|ibex|europe equity|eurozone|emu\b|euro area|developed europe|uk equity|britain/i,
  },
  {
    id: 'asia',
    test: /msci japan|msci china|msci india|msci pacific|msci asia|ftse china|nikkei|topix|hang seng|kospi|taiwan|singapore|australia|asia ex|japan equity|china equity|india equity|nifty|csi /i,
  },
  {
    id: 'em',
    test: /emerging market|msci em\b|em equity|frontier|efm africa|bric\b/i,
  },
  {
    id: 'gov_bonds',
    test: /government bond|govt bond|gilt|treasury|sovereign|treasuries|inflation-linked|tips\b|iboxx.*sovereign|eurozone sovereign/i,
  },
  {
    id: 'corp_bonds',
    test: /corporate bond|corp bond|credit|investment grade|aggregate bond|euro aggregate|global aggregate|liquid corp|ibonds/i,
  },
  {
    id: 'other_bonds',
    test: /high yield|floating rate|money market|cash active|short duration|ultra-short|bond ucits|fixed income|emerging market.*bond|em bond/i,
  },
  {
    id: 'commodities',
    test: /gold|silver|copper|oil|crude|commodity|wti|brent|precious|platinum|uranium|energy roll|metals enhanced/i,
  },
  {
    id: 'real_estate',
    test: /reit|real estate|epra|nareit|property/i,
  },
  {
    id: 'thematic',
    test: /artificial intelligence|semiconductor|cyber|cloud|genomic|innovation|automation|robotics|clean energy|renewable|hydrogen|water|health|biotech|defense|infrastructure|dividend|value|momentum|quality|esg|sri|factor|thematic|technology|healthcare|utilities|financials|energy select/i,
  },
];

export function formatAumUsd(fund) {
  const raw = fund?.aum;
  if (raw == null || !Number.isFinite(raw)) return '—';
  if (raw < AUM_FLOOR_USD) return '<10M';

  const abs = Math.abs(raw);
  if (abs >= 1e12) return `${Math.round(raw / 1e12)}T`;
  if (abs >= 1e9) return `${Math.round(raw / 1e9)}B`;
  return `${Math.round(raw / 1e6)}M`;
}

export function formatAumDisplay(fund) {
  const formatted = formatAumUsd(fund);
  return formatted === '—' ? '—' : `${formatted} USD`;
}

export function getIndexCategory(trackedIndex) {
  const text = String(trackedIndex || '').trim();
  if (!text) return 'other';

  for (const rule of INDEX_CATEGORY_RULES) {
    if (rule.test.test(text)) return rule.id;
  }
  return 'other';
}

export function getIndexCategoryLabel(categoryId) {
  return INDEX_CATEGORIES.find((c) => c.id === categoryId)?.label ?? 'Other';
}

export function fundMatchesIndexCategories(fund, selectedCategoryIds) {
  if (!selectedCategoryIds?.length) return true;
  const category = getIndexCategory(fund.trackedIndex);
  return selectedCategoryIds.includes(category);
}

export function compareFundsByAum(a, b, direction = 'desc') {
  const aAum = a.aum ?? null;
  const bAum = b.aum ?? null;
  if (aAum == null && bAum == null) return 0;
  if (aAum == null) return 1;
  if (bAum == null) return -1;
  return direction === 'asc' ? aAum - bAum : bAum - aAum;
}
