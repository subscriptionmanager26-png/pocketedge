/** Mutual fund catalogue, seed reviews, holders, and news for investment pages. */

export const FUND_CATEGORIES = ['Flexi Cap', 'Mid Cap', 'Small Cap'];

export const FUNDS = {
  fund_ppfas_flexi: {
    id: 'fund_ppfas_flexi',
    name: 'PPFAS Flexi Cap Fund',
    category: 'Flexi Cap',
    amc: 'PPFAS Mutual Fund',
    return1Y: 19.4,
    return3Y: 23.1,
    risk: 'Very High',
    aum: '₹8,200 Cr',
  },
  fund_parag_flexi: {
    id: 'fund_parag_flexi',
    name: 'Parag Parikh Flexi Cap Fund',
    category: 'Flexi Cap',
    amc: 'PPFAS Mutual Fund',
    return1Y: 22.8,
    return3Y: 25.6,
    risk: 'Very High',
    aum: '₹1,12,000 Cr',
  },
  fund_hdfc_flexi: {
    id: 'fund_hdfc_flexi',
    name: 'HDFC Flexi Cap Fund',
    category: 'Flexi Cap',
    amc: 'HDFC Mutual Fund',
    return1Y: 17.2,
    return3Y: 20.8,
    risk: 'Very High',
    aum: '₹54,000 Cr',
  },
  fund_motilal_mid: {
    id: 'fund_motilal_mid',
    name: 'Motilal Oswal Midcap Fund',
    category: 'Mid Cap',
    amc: 'Motilal Oswal AMC',
    return1Y: 28.6,
    return3Y: 31.2,
    risk: 'Very High',
    aum: '₹32,000 Cr',
  },
  fund_axis_mid: {
    id: 'fund_axis_mid',
    name: 'Axis Midcap Fund',
    category: 'Mid Cap',
    amc: 'Axis Mutual Fund',
    return1Y: 24.1,
    return3Y: 26.4,
    risk: 'Very High',
    aum: '₹28,500 Cr',
  },
  fund_kotak_mid: {
    id: 'fund_kotak_mid',
    name: 'Kotak Emerging Equity Fund',
    category: 'Mid Cap',
    amc: 'Kotak Mutual Fund',
    return1Y: 21.3,
    return3Y: 24.0,
    risk: 'Very High',
    aum: '₹41,000 Cr',
  },
  fund_nippon_small: {
    id: 'fund_nippon_small',
    name: 'Nippon India Small Cap Fund',
    category: 'Small Cap',
    amc: 'Nippon India AMC',
    return1Y: 32.4,
    return3Y: 35.8,
    risk: 'Very High',
    aum: '₹48,000 Cr',
  },
  fund_sbi_small: {
    id: 'fund_sbi_small',
    name: 'SBI Small Cap Fund',
    category: 'Small Cap',
    amc: 'SBI Mutual Fund',
    return1Y: 29.7,
    return3Y: 33.1,
    risk: 'Very High',
    aum: '₹36,000 Cr',
  },
  fund_quant_small: {
    id: 'fund_quant_small',
    name: 'Quant Small Cap Fund',
    category: 'Small Cap',
    amc: 'Quant Mutual Fund',
    return1Y: 38.2,
    return3Y: 42.5,
    risk: 'Very High',
    aum: '₹9,800 Cr',
  },
};

export function getFund(fundId) {
  return FUNDS[fundId] ?? null;
}

export function getFundsByCategory(category) {
  return Object.values(FUNDS).filter((f) => f.category === category);
}

export function pickRandomCategory() {
  return FUND_CATEGORIES[Math.floor(Math.random() * FUND_CATEGORIES.length)];
}

/** Seed community reviews — initial content database */
export const SEED_FUND_REVIEWS = [
  {
    id: 'rev_seed_1',
    fundId: 'fund_parag_flexi',
    authorId: 'u1',
    rating: 5,
    body: 'Consistent philosophy, low churn, and global diversification make this my core flexi holding.',
    createdAt: '2026-06-28T10:00:00.000Z',
    agreeCount: 42,
    disagreeCount: 3,
    shareCount: 8,
    comments: [
      {
        id: 'rc_s1',
        authorId: 'u2',
        body: 'Agree on the global sleeve — rare among Indian flexi funds.',
        parentId: null,
        createdAt: '2026-06-28T14:00:00.000Z',
      },
    ],
  },
  {
    id: 'rev_seed_2',
    fundId: 'fund_parag_flexi',
    authorId: 'u4',
    rating: 4,
    body: 'Valuation discipline is real, but cash drag hurts in sharp rallies.',
    createdAt: '2026-06-25T09:30:00.000Z',
    agreeCount: 28,
    disagreeCount: 11,
    shareCount: 4,
    comments: [],
  },
  {
    id: 'rev_seed_3',
    fundId: 'fund_motilal_mid',
    authorId: 'u2',
    rating: 5,
    body: 'High conviction midcap bets — volatile but aligned with 5Y horizon.',
    createdAt: '2026-06-20T11:00:00.000Z',
    agreeCount: 35,
    disagreeCount: 6,
    shareCount: 5,
    comments: [
      {
        id: 'rc_s2',
        authorId: 'u3',
        body: 'Drawdowns are brutal — only for investors who can stomach 30% cuts.',
        parentId: null,
        createdAt: '2026-06-21T08:00:00.000Z',
      },
      {
        id: 'rc_s3',
        authorId: 'u2',
        body: 'Fair point — size of SIP matters more here than in large caps.',
        parentId: 'rc_s2',
        createdAt: '2026-06-21T10:00:00.000Z',
      },
    ],
  },
  {
    id: 'rev_seed_4',
    fundId: 'fund_nippon_small',
    authorId: 'u3',
    rating: 4,
    body: 'Liquidity risk is underpriced — great returns but watch exit loads.',
    createdAt: '2026-06-18T16:00:00.000Z',
    agreeCount: 19,
    disagreeCount: 4,
    shareCount: 2,
    comments: [],
  },
  {
    id: 'rev_seed_5',
    fundId: 'fund_hdfc_flexi',
    authorId: 'u5',
    rating: 3,
    body: 'Solid house brand, but feels like a closet index vs true flexi peers.',
    createdAt: '2026-06-15T12:00:00.000Z',
    agreeCount: 14,
    disagreeCount: 9,
    shareCount: 1,
    comments: [],
  },
];

/** Funds on the current user's watchlist (demo). */
export const MY_FUND_WATCHLIST = ['fund_motilal_mid'];

export const FUND_HOLDERS = {
  fund_parag_flexi: ['u1', 'u2', 'u5', 'u_me'],
  fund_ppfas_flexi: ['u4'],
  fund_motilal_mid: ['u2', 'u3'],
  fund_axis_mid: ['u1'],
  fund_nippon_small: ['u3', 'u4'],
  fund_sbi_small: ['u5'],
  fund_quant_small: ['u3'],
  fund_hdfc_flexi: ['u5', 'u1'],
  fund_kotak_mid: ['u4', 'u2'],
};

export const FUND_NEWS = {
  fund_parag_flexi: [
    { id: 'fn1', title: 'Parag Parikh Flexi Cap adds to cash amid global volatility', source: 'Economic Times', time: '2d' },
    { id: 'fn2', title: 'Overseas allocation in flexi caps: what changed in Q1', source: 'Mint', time: '5d' },
  ],
  fund_motilal_mid: [
    { id: 'fn3', title: 'Motilal Oswal Midcap tops peer returns over 3 years', source: 'Moneycontrol', time: '1d' },
  ],
  fund_nippon_small: [
    { id: 'fn4', title: 'Small cap inflows hit record — AMFI data', source: 'Business Standard', time: '3d' },
    { id: 'fn5', title: 'Nippon India Small Cap restricts lump sum above ₹2L', source: 'Livemint', time: '1w' },
  ],
};

export function getFundHolders(fundId) {
  return FUND_HOLDERS[fundId] ?? [];
}

export function getFundNews(fundId) {
  return FUND_NEWS[fundId] ?? [];
}

export function averageRating(fundId, reviews) {
  const list = reviews ?? [];
  if (!list.length) return null;
  const sum = list.reduce((s, r) => s + r.rating, 0);
  return (sum / list.length).toFixed(1);
}
