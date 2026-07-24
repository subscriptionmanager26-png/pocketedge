/** Sector / theme tags for AMFI "Sectoral/ Thematic" equity funds. */

export const SECTORAL_SUBCATEGORY = 'Sectoral/ Thematic';

/** Display order for sector filter chips (stable, high-count first). */
export const SECTOR_THEME_ORDER = [
  'Financial',
  'Healthcare',
  'Technology',
  'Consumption',
  'Infrastructure',
  'Energy & Resources',
  'ESG',
  'PSU',
  'MNC',
  'Manufacturing',
  'Transport & Logistics',
  'Housing & Realty',
  'Defence',
  'International',
  'Factor / Quant',
  'IPO',
  'Thematic',
  'Other thematic',
];

/** Upvaly schemeCategory → UI sector tag. */
const UPVALY_SECTOR_MAP = {
  'Sector - Financial Services': 'Financial',
  'Sector - Healthcare': 'Healthcare',
  'Sector - Technology': 'Technology',
  'Sector - Energy': 'Energy & Resources',
  'Sector - FMCG': 'Consumption',
  'Equity - Consumption': 'Consumption',
  'Equity - Infrastructure': 'Infrastructure',
  'Equity - ESG': 'ESG',
};

/**
 * Name heuristics for Equity - Other / Global - Other / missing Upvaly category.
 * First match wins — order matters.
 */
const NAME_SECTOR_RULES = [
  [/bank(?:ing)?|financial\s+services|bfsi|fintech/i, 'Financial'],
  [/pharma|health\s*care|healthcare|medical/i, 'Healthcare'],
  [/\b(?:technology|digital|software|it\b|innovation)\b/i, 'Technology'],
  [/consum(?:ption|er)|fmcg|\bretail\b/i, 'Consumption'],
  [/infra(?:structure)?|power\s*&\s*infra|tig\.?\s*e\.?\s*r|build\s+india/i, 'Infrastructure'],
  [/\besg\b|ethical|sustainab/i, 'ESG'],
  [/\bpsu\b/i, 'PSU'],
  [
    /energy|natural\s+resources?|resources\s*&\s*energy|commodit(?:y|ies)|comma\b|\boil\b|power(?!\s*&\s*infra)/i,
    'Energy & Resources',
  ],
  [/\bmnc\b|multinational/i, 'MNC'],
  [/manufactur|make\s+in\s+india|manufacture\s+in\s+india/i, 'Manufacturing'],
  [/transport|logistics|\bauto(?:mobile)?\b|mobility/i, 'Transport & Logistics'],
  [/hous(?:e|ing)|realty|real\s+estate/i, 'Housing & Realty'],
  [/defen[cs]e|aerospace/i, 'Defence'],
  [/multi[-\s]?factor|\bquant\b|momentum|quality|minimum\s+variance|quantamental/i, 'Factor / Quant'],
  [
    /global|international|\bus\b|japan|taiwan|asia(?:n)?|overseas|world|us\s+bluechip|us\s+equity/i,
    'International',
  ],
  [/\bipo\b|recently\s+listed/i, 'IPO'],
  [/agro|agri(?:culture)?|\brural\b/i, 'Agriculture'],
  [
    /business\s+cycle|special\s+opportunit|opportunit(?:y|ies)|pioneer|services\s+fund|exports|conglomerate|multi\s*sector|sector\s+rotation|thematic/i,
    'Thematic',
  ],
];

export function isSectoralSubCategory(subCategory) {
  return String(subCategory ?? '').trim() === SECTORAL_SUBCATEGORY;
}

/**
 * Resolve a sector/theme tag for a fund. Non-sectoral AMFI categories return null.
 */
export function resolveSectorTheme({ name, schemeCategory, subCategory } = {}) {
  if (!isSectoralSubCategory(subCategory)) return null;

  const upvaly = String(schemeCategory ?? '').trim();
  if (upvaly && UPVALY_SECTOR_MAP[upvaly]) return UPVALY_SECTOR_MAP[upvaly];

  const needsNameFallback =
    !upvaly ||
    upvaly === 'Equity - Other' ||
    upvaly === 'Global - Other' ||
    upvaly === 'Index Funds' ||
    upvaly === 'Flexi Cap';

  if (needsNameFallback) {
    const hay = String(name ?? '');
    for (const [re, tag] of NAME_SECTOR_RULES) {
      if (re.test(hay)) return tag;
    }
  } else if (/^(Sector|Equity|Global)\s+-\s+/i.test(upvaly)) {
    return upvaly.replace(/^(Sector|Equity|Global)\s+-\s+/i, '').trim() || 'Other thematic';
  }

  return 'Other thematic';
}

export function sortSectorThemes(themes) {
  const order = new Map(SECTOR_THEME_ORDER.map((t, i) => [t, i]));
  return [...themes].sort((a, b) => {
    const ai = order.has(a) ? order.get(a) : 999;
    const bi = order.has(b) ? order.get(b) : 999;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
}
