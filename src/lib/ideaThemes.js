/**
 * Idea theme catalog for the Ideas hub.
 * Portfolios are matched by keywords in name / objective / thesis.
 */

export const IDEA_THEMES = [
  {
    id: 'ai',
    label: 'AI',
    blurb: 'AI, semis, and digital platforms',
    keywords: ['ai', 'artificial intelligence', 'semiconductor', 'tech', 'digital', 'software'],
  },
  {
    id: 'small-cap',
    label: 'Small Cap',
    blurb: 'Higher-beta small-cap baskets',
    keywords: ['small cap', 'smallcap', 'small-cap'],
  },
  {
    id: 'mid-cap',
    label: 'Mid Cap',
    blurb: 'Mid-cap growth and quality',
    keywords: ['mid cap', 'midcap', 'mid-cap'],
  },
  {
    id: 'large-cap',
    label: 'Large Cap',
    blurb: 'Blue-chip and large-cap cores',
    keywords: ['large cap', 'largecap', 'large-cap', 'bluechip', 'blue chip'],
  },
  {
    id: 'power-utilities',
    label: 'Power & Utilities',
    blurb: 'Power, utilities, and energy',
    keywords: ['power', 'utilit', 'energy', 'renewable', 'infra'],
  },
  {
    id: 'dividend',
    label: 'Dividend Income',
    blurb: 'Income and dividend strategies',
    keywords: ['dividend', 'income', 'yield'],
  },
  {
    id: 'momentum',
    label: 'Momentum',
    blurb: 'Price and earnings momentum',
    keywords: ['momentum', 'trend'],
  },
  {
    id: 'growth',
    label: 'Growth',
    blurb: 'Growth-oriented portfolios',
    keywords: ['growth'],
  },
  {
    id: 'value',
    label: 'Value',
    blurb: 'Value and deep-value ideas',
    keywords: ['value', 'contrarian'],
  },
  {
    id: 'low-vol',
    label: 'Low Volatility',
    blurb: 'Quality and lower-vol sleeves',
    keywords: ['low volatility', 'low vol', 'volatility', 'quality', 'defensive'],
  },
  {
    id: 'all-weather',
    label: 'All Weather',
    blurb: 'Balanced, multi-asset sleeves',
    keywords: ['all weather', 'all-weather', 'balanced', 'multi asset', 'multi-asset', 'hybrid'],
  },
  {
    id: 'pharma',
    label: 'Pharma & Healthcare',
    blurb: 'Pharma, healthcare, diagnostics',
    keywords: ['pharma', 'health', 'diagnostic', 'hospital'],
  },
  {
    id: 'manufacturing',
    label: 'Manufacturing',
    blurb: 'Industrial and manufacturing themes',
    keywords: ['manufactur', 'industrial', 'capex'],
  },
  {
    id: 'consumption',
    label: 'Consumption',
    blurb: 'Consumer and consumption plays',
    keywords: ['consumption', 'consumer', 'fmcg', 'retail'],
  },
];

export function getIdeaTheme(themeId) {
  return IDEA_THEMES.find((t) => t.id === themeId) ?? null;
}

function portfolioSearchText(portfolio) {
  return [portfolio?.name, portfolio?.objective, portfolio?.thesis]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Themes that match a portfolio (can be multiple). */
export function matchIdeaThemes(portfolio) {
  const hay = portfolioSearchText(portfolio);
  if (!hay) return [];
  return IDEA_THEMES.filter((theme) =>
    theme.keywords.some((kw) => hay.includes(kw.toLowerCase()))
  );
}

export function portfolioMatchesTheme(portfolio, themeId) {
  const theme = getIdeaTheme(themeId);
  if (!theme) return false;
  const hay = portfolioSearchText(portfolio);
  return theme.keywords.some((kw) => hay.includes(kw.toLowerCase()));
}

export function countThemesForRows(rows) {
  const counts = Object.fromEntries(IDEA_THEMES.map((t) => [t.id, 0]));
  for (const row of rows ?? []) {
    const matched = matchIdeaThemes(row.portfolio);
    for (const theme of matched) {
      counts[theme.id] += 1;
    }
  }
  return counts;
}

function engagementScore(row) {
  const social = row.social ?? {};
  const likes = Number(social.likes) || 0;
  const copies = Number(social.copies) || 0;
  const shares = Number(social.shares) || 0;
  const updated = new Date(row.portfolio?.updatedAt ?? 0).getTime() || 0;
  // Recency in days (newer → higher), plus soft engagement signal.
  const daysAgo = Math.max(0, (Date.now() - updated) / 86_400_000);
  const recency = Math.max(0, 30 - daysAgo);
  return likes * 4 + copies * 6 + shares * 2 + recency;
}

/** Trending: engagement + recency. */
export function rankTrendingIdeas(rows, limit = 6) {
  return [...(rows ?? [])]
    .sort((a, b) => engagementScore(b) - engagementScore(a))
    .slice(0, limit);
}

/** Most watched: likes / copies first, then recency. */
export function rankMostWatchedIdeas(rows, limit = 6) {
  return [...(rows ?? [])]
    .sort((a, b) => {
      const aw =
        (Number(a.social?.likes) || 0) * 3 +
        (Number(a.social?.copies) || 0) * 5 +
        (Number(a.social?.shares) || 0);
      const bw =
        (Number(b.social?.likes) || 0) * 3 +
        (Number(b.social?.copies) || 0) * 5 +
        (Number(b.social?.shares) || 0);
      if (bw !== aw) return bw - aw;
      return (
        new Date(b.portfolio?.updatedAt ?? 0).getTime() -
        new Date(a.portfolio?.updatedAt ?? 0).getTime()
      );
    })
    .slice(0, limit);
}
