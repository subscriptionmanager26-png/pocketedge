/** Demo data for PocketEdge Social — skin-in-the-game disclosure throughout. */

export const CURRENT_USER = {
  id: 'u_me',
  name: 'Kushagra',
  handle: 'kushagra',
  avatar: 'K',
  xirr: 24.6,
  followers: 1284,
  following: 86,
  assetsInfluenced: 1_24_00_000,
  bio: 'Building in public. Skin in the game on every take.',
  location: 'Bengaluru, India',
  joinedAt: '2024-03-12',
  focus: 'Quality compounders · Banks · IT',
  /** What the public can see on your profile */
  portfolioPublic: true,
  showHoldingsPublic: true,
  showXirrPublic: true,
};

export const PEOPLE = [
  {
    id: 'u1',
    name: 'Rohan Verma',
    handle: 'rohanv',
    avatar: 'R',
    xirr: 31.2,
    followers: 8420,
    following: 210,
    assetsInfluenced: 3_85_00_000,
    bio: 'Long-term compounder. Banks & quality compounders.',
    location: 'Mumbai, India',
    joinedAt: '2023-08-01',
    focus: 'Banking · Quality compounders',
    portfolioPublic: true,
    showHoldingsPublic: true,
    showXirrPublic: true,
  },
  {
    id: 'u2',
    name: 'Ananya Shah',
    handle: 'ananyas',
    avatar: 'A',
    xirr: 28.4,
    followers: 5120,
    following: 145,
    assetsInfluenced: 98_50_000,
    bio: 'IT + consumption. Writes weekly notes.',
    location: 'Pune, India',
    joinedAt: '2023-11-20',
    focus: 'IT services · Consumption',
    portfolioPublic: true,
    showHoldingsPublic: true,
    showXirrPublic: true,
  },
  {
    id: 'u3',
    name: 'Vikram Mehta',
    handle: 'vikramm',
    avatar: 'V',
    xirr: 19.8,
    followers: 2340,
    following: 98,
    assetsInfluenced: 42_00_000,
    bio: 'Smallcaps & special situations.',
    location: 'Ahmedabad, India',
    joinedAt: '2024-01-05',
    focus: 'Smallcaps · Special situations',
    portfolioPublic: true,
    showHoldingsPublic: false,
    showXirrPublic: true,
  },
  {
    id: 'u4',
    name: 'Priya Nair',
    handle: 'priyan',
    avatar: 'P',
    xirr: 26.1,
    followers: 3890,
    following: 176,
    assetsInfluenced: 1_15_00_000,
    bio: 'Macro-aware equity. Energy & infra.',
    location: 'Chennai, India',
    joinedAt: '2023-06-15',
    focus: 'Energy · Infrastructure · Macro',
    portfolioPublic: true,
    showHoldingsPublic: true,
    showXirrPublic: true,
  },
  {
    id: 'u5',
    name: 'Arjun Kapoor',
    handle: 'arjunk',
    avatar: 'A',
    xirr: 22.3,
    followers: 1560,
    following: 64,
    assetsInfluenced: 18_50_000,
    bio: 'Index + satellites. Low drama.',
    location: 'Delhi, India',
    joinedAt: '2024-05-02',
    focus: 'Index core · Satellite picks',
    portfolioPublic: false,
    showHoldingsPublic: false,
    showXirrPublic: false,
  },
];

/** Position status for disclosure: holds | exited | watchlist | none */
export const AUTHOR_POSITIONS = {
  u1: {
    HDFCBANK: { status: 'holds', qty: 120, avg: 1482, pnlPct: 12.4 },
    ICICIBANK: { status: 'holds', qty: 80, avg: 980, pnlPct: 8.1 },
    RELIANCE: { status: 'watchlist' },
    TCS: { status: 'exited', exitPrice: 3920, exitDate: '2026-04-12', pnlPct: 18.2 },
  },
  u2: {
    TCS: { status: 'holds', qty: 40, avg: 3450, pnlPct: 14.2 },
    INFY: { status: 'holds', qty: 60, avg: 1420, pnlPct: 6.8 },
    HDFCBANK: { status: 'watchlist' },
    WIPRO: { status: 'exited', exitPrice: 480, exitDate: '2026-02-01', pnlPct: -4.2 },
  },
  u3: {
    TATAMOTORS: { status: 'holds', qty: 200, avg: 720, pnlPct: 22.1 },
    RELIANCE: { status: 'holds', qty: 30, avg: 2450, pnlPct: 5.4 },
    IRCTC: { status: 'watchlist' },
  },
  u4: {
    RELIANCE: { status: 'holds', qty: 50, avg: 2380, pnlPct: 9.2 },
    ONGC: { status: 'holds', qty: 400, avg: 210, pnlPct: 11.0 },
    NTPC: { status: 'watchlist' },
  },
  u5: {
    NIFTYBEES: { status: 'holds', qty: 500, avg: 240, pnlPct: 7.5 },
    HDFCBANK: { status: 'watchlist' },
  },
  u_me: {
    RELIANCE: { status: 'holds', qty: 25, avg: 2410, pnlPct: 6.8 },
    HDFCBANK: { status: 'holds', qty: 40, avg: 1520, pnlPct: 9.1 },
    TCS: { status: 'watchlist' },
    INFY: { status: 'watchlist' },
  },
};

export const STOCKS = {
  RELIANCE: { name: 'Reliance Industries', price: 2574.2, changePct: 1.24, return3M: 8.4, spark: [2480, 2495, 2510, 2502, 2530, 2555, 2574] },
  HDFCBANK: { name: 'HDFC Bank', price: 1665.8, changePct: -0.42, return3M: 4.1, spark: [1680, 1675, 1670, 1668, 1672, 1660, 1666] },
  ICICIBANK: { name: 'ICICI Bank', price: 1059.4, changePct: 0.88, return3M: 6.2, spark: [1030, 1038, 1045, 1042, 1050, 1055, 1059] },
  TCS: { name: 'Tata Consultancy', price: 3940.0, changePct: 0.35, return3M: -2.8, spark: [3880, 3895, 3910, 3900, 3925, 3935, 3940] },
  INFY: { name: 'Infosys', price: 1516.5, changePct: -0.18, return3M: -1.4, spark: [1525, 1520, 1518, 1522, 1515, 1512, 1517] },
  TATAMOTORS: { name: 'Tata Motors', price: 879.2, changePct: 2.14, return3M: 14.6, spark: [820, 835, 850, 845, 860, 870, 879] },
  ONGC: { name: 'ONGC', price: 233.1, changePct: 0.62, return3M: 5.5, spark: [225, 228, 230, 229, 231, 232, 233] },
  NTPC: { name: 'NTPC', price: 368.4, changePct: -0.25, return3M: 3.2, spark: [372, 370, 369, 371, 368, 367, 368] },
  IRCTC: { name: 'IRCTC', price: 812.0, changePct: 1.05, return3M: 9.8, spark: [790, 795, 800, 798, 805, 810, 812] },
  WIPRO: { name: 'Wipro', price: 498.6, changePct: 0.12, return3M: -3.1, spark: [495, 496, 497, 496, 498, 499, 499] },
  NIFTYBEES: { name: 'Nippon Nifty BeES', price: 258.2, changePct: 0.41, return3M: 5.0, spark: [252, 253, 254, 255, 256, 257, 258] },
};

export const TOPICS = [
  { id: 't1', name: 'Banking', slug: 'Banking', postsThisWeek: 428, followers: 12400, followed: true },
  { id: 't2', name: 'IT Services', slug: 'ITServices', postsThisWeek: 312, followers: 9800, followed: true },
  { id: 't3', name: 'Energy', slug: 'Energy', postsThisWeek: 186, followers: 5400, followed: false },
  { id: 't4', name: 'Smallcaps', slug: 'Smallcaps', postsThisWeek: 540, followers: 15200, followed: false },
  { id: 't5', name: 'Macro', slug: 'Macro', postsThisWeek: 210, followers: 8700, followed: true },
  { id: 't6', name: 'IPOs', slug: 'IPOs', postsThisWeek: 95, followers: 6200, followed: false },
];

export const FOLLOWING_IDS = new Set(['u1', 'u2', 'u4']);

/** Who each user follows — `u_me` is overridden at runtime by socialGraphStore. */
export const USER_FOLLOWING_SEED = {
  u_me: ['u1', 'u2', 'u4'],
  u1: ['u2', 'u4', 'u_me'],
  u2: ['u1', 'u3', 'u_me'],
  u3: ['u1', 'u5'],
  u4: ['u1', 'u2', 'u_me'],
  u5: ['u2', 'u4'],
};

export const MY_PORTFOLIO = {
  totalValue: 4_82_450,
  invested: 4_12_800,
  todayPnl: 3840,
  todayPnlPct: 0.8,
  totalPnl: 69_650,
  totalPnlPct: 16.87,
  xirr: 24.6,
  holdings: [
    {
      ticker: 'RELIANCE',
      qty: 25,
      avg: 2410,
      price: 2574.2,
      value: 64_355,
      pnl: 4105,
      pnlPct: 6.8,
      spark: STOCKS.RELIANCE.spark,
    },
    {
      ticker: 'HDFCBANK',
      qty: 40,
      avg: 1520,
      price: 1665.8,
      value: 66_632,
      pnl: 5832,
      pnlPct: 9.1,
      spark: STOCKS.HDFCBANK.spark,
    },
    {
      ticker: 'ICICIBANK',
      qty: 55,
      avg: 980,
      price: 1059.4,
      value: 58_267,
      pnl: 4367,
      pnlPct: 8.1,
      spark: STOCKS.ICICIBANK.spark,
    },
    {
      ticker: 'TATAMOTORS',
      qty: 80,
      avg: 720,
      price: 879.2,
      value: 70_336,
      pnl: 12_736,
      pnlPct: 22.1,
      spark: STOCKS.TATAMOTORS.spark,
    },
  ],
  watchlists: [
    {
      id: 'wl1',
      name: 'Tech picks',
      tickers: ['TCS', 'INFY', 'WIPRO'],
    },
    {
      id: 'wl2',
      name: 'Smallcaps',
      tickers: ['IRCTC', 'TATAMOTORS'],
    },
  ],
};

function buildHoldingsFromPositions(userId, tickers) {
  return tickers
    .map((ticker) => {
      const p = AUTHOR_POSITIONS[userId]?.[ticker];
      if (!p || p.status !== 'holds') return null;
      const stock = STOCKS[ticker];
      const price = stock?.price ?? p.avg ?? 0;
      const value = (p.qty ?? 0) * price;
      return {
        ticker,
        qty: p.qty,
        avg: p.avg,
        price,
        value,
        pnlPct: p.pnlPct ?? stock?.changePct ?? 0,
      };
    })
    .filter(Boolean);
}

const DEMO_25_STOCK_NAMES = [
  'Reliance Industries',
  'HDFC Bank',
  'ICICI Bank',
  'Tata Consultancy',
  'Infosys',
  'Tata Motors',
  'ONGC',
  'NTPC',
  'IRCTC',
  'Wipro',
  'Nippon Nifty BeES',
  'Asian Paints',
  'Bajaj Finance',
  'Hindustan Unilever',
  'ITC',
  'Larsen & Toubro',
  'Axis Bank',
  'State Bank of India',
  'Maruti Suzuki',
  'Sun Pharma',
  'Kotak Mahindra Bank',
  'Titan Company',
  'Nestle India',
  'HCL Technologies',
  'Power Grid',
];

function buildDemo25Holdings() {
  return DEMO_25_STOCK_NAMES.map((name, i) => {
    const ticker = `D${String(i + 1).padStart(2, '0')}`;
    const qty = 18 + i * 2;
    const price = 220 + i * 72;
    const avg = Number((price * 0.9).toFixed(2));
    const value = Number((qty * price).toFixed(2));
    if (!STOCKS[ticker]) {
      STOCKS[ticker] = {
        name,
        price,
        changePct: Number((((i % 7) - 3) * 0.8).toFixed(2)),
        return3M: Number(((i % 9) - 4).toFixed(1)),
        spark: [price * 0.96, price * 0.98, price * 0.99, price, price * 1.01, price * 1.02, price],
      };
    }
    return {
      ticker,
      qty,
      avg,
      price,
      value,
      pnlPct: Number((((i % 7) - 3) * 1.1).toFixed(1)),
    };
  });
}

/** A user may publish multiple portfolios on their profile. */
export const USER_PORTFOLIOS = {
  u_me: [
    {
      id: 'pf_main',
      kind: 'live',
      name: 'Main portfolio',
      objective: 'Core long-term holdings across banks and energy.',
      thesis: 'Quality franchises with pricing power and steady compounding.',
      totalValue: 4_82_450,
      invested: 4_12_800,
      totalPnlPct: 16.87,
      return1M: 2.4,
      xirr: 24.6,
      holdings: MY_PORTFOLIO.holdings,
    },
    {
      id: 'pf_diversified',
      kind: 'live',
      name: 'Diversified 25',
      objective: 'Broad market exposure across sectors.',
      thesis: 'Core satellite split with 25 names — demo for paginated holdings.',
      totalValue: 12_50_000,
      invested: 10_80_000,
      totalPnlPct: 15.7,
      return1M: 2.1,
      xirr: 22.4,
      holdings: buildDemo25Holdings(),
    },
    {
      id: 'pf_dividend',
      kind: 'live',
      name: 'Dividend income',
      objective: 'Banks and steady compounders for yield.',
      thesis: 'High dividend yield with sustainable payout ratios.',
      totalValue: 1_89_200,
      invested: 1_72_400,
      totalPnlPct: 9.7,
      return1M: 1.1,
      xirr: 18.2,
      holdings: [
        MY_PORTFOLIO.holdings.find((h) => h.ticker === 'HDFCBANK'),
        MY_PORTFOLIO.holdings.find((h) => h.ticker === 'ICICIBANK'),
      ].filter(Boolean),
    },
    {
      id: 'pf_tactical',
      kind: 'live',
      name: 'Tactical trades',
      objective: 'Higher-beta ideas with shorter holding periods.',
      thesis: 'Cyclical recovery plays with clear catalysts.',
      totalValue: 70_336,
      invested: 57_600,
      totalPnlPct: 22.1,
      return1M: 4.8,
      xirr: 31.4,
      holdings: [MY_PORTFOLIO.holdings.find((h) => h.ticker === 'TATAMOTORS')].filter(Boolean),
    },
    {
      id: 'pf_copy_banks',
      kind: 'live',
      name: 'Banking book',
      objective: 'Private banks and financials.',
      thesis: 'Copied allocation to track a peer portfolio alongside my own book.',
      sourcePortfolioId: 'pf_banks',
      sourcePortfolioName: 'Banking book',
      sourceUserId: 'u1',
      sourceUserName: 'Ananya S.',
      totalValue: 3_24_000,
      invested: 2_85_000,
      totalPnlPct: 13.7,
      return1M: 1.8,
      xirr: 28.4,
      holdings: buildHoldingsFromPositions('u1', ['HDFCBANK', 'ICICIBANK']),
    },
    {
      id: 'wl_tech',
      kind: 'watchlist',
      name: 'Tech picks',
      objective: 'Track IT names before adding to live portfolios.',
      thesis: 'Quality IT services names with improving demand visibility.',
      tickers: ['TCS', 'INFY', 'WIPRO'],
      return1M: -0.9,
      holdings: [],
    },
    {
      id: 'wl_copy_growth',
      kind: 'watchlist',
      name: 'Growth watch',
      objective: 'High-growth names to track before sizing live.',
      thesis: 'Copied from Ananya — monitoring before adding to live book.',
      sourcePortfolioId: 'wl_growth',
      sourcePortfolioName: 'Growth watch',
      sourceUserId: 'u1',
      sourceUserName: 'Ananya S.',
      tickers: ['RELIANCE', 'TCS'],
      return1M: 1.4,
      holdings: [],
    },
    {
      id: 'wl_smallcaps',
      kind: 'watchlist',
      name: 'Smallcaps',
      objective: 'Monitor high-volatility opportunities.',
      thesis: 'Wait for cleaner setups and momentum confirmation.',
      tickers: ['IRCTC', 'TATAMOTORS'],
      return1M: 3.2,
      holdings: [],
    },
  ],
  u1: [
    {
      id: 'pf_banks',
      kind: 'live',
      name: 'Banking book',
      description: 'Private banks and financials.',
      totalValue: 3_24_000,
      totalPnlPct: 14.2,
      return1M: 1.8,
      xirr: 31.2,
      holdings: buildHoldingsFromPositions('u1', ['HDFCBANK', 'ICICIBANK']),
    },
    {
      id: 'pf_compounders',
      kind: 'live',
      name: 'Compounders',
      description: 'Quality names held for the long run.',
      totalValue: 1_12_000,
      totalPnlPct: 11.8,
      return1M: 2.1,
      xirr: 26.4,
      holdings: buildHoldingsFromPositions('u1', ['RELIANCE']),
    },
    {
      id: 'wl_growth',
      kind: 'watchlist',
      name: 'Growth watch',
      objective: 'High-growth names to track before sizing live.',
      thesis: 'Quality compounders with long runway.',
      tickers: ['RELIANCE', 'TCS'],
      return1M: 1.4,
      holdings: [],
    },
  ],
  u2: [
    {
      id: 'pf_it',
      kind: 'live',
      name: 'IT portfolio',
      description: 'Large-cap IT services.',
      totalValue: 2_68_000,
      totalPnlPct: 12.5,
      return1M: 0.6,
      xirr: 28.4,
      holdings: buildHoldingsFromPositions('u2', ['TCS', 'INFY']),
    },
  ],
  u3: [
    {
      id: 'pf_smallcap',
      kind: 'live',
      name: 'Smallcap sleeve',
      description: 'Higher-risk growth and special situations.',
      totalValue: 1_95_000,
      totalPnlPct: 18.6,
      return1M: 5.2,
      xirr: 19.8,
      holdings: buildHoldingsFromPositions('u3', ['TATAMOTORS', 'RELIANCE']),
    },
  ],
  u4: [
    {
      id: 'pf_energy',
      kind: 'live',
      name: 'Energy & infra',
      description: 'Macro-aware energy exposure.',
      totalValue: 2_41_000,
      totalPnlPct: 10.4,
      return1M: 1.4,
      xirr: 26.1,
      holdings: buildHoldingsFromPositions('u4', ['RELIANCE', 'ONGC']),
    },
  ],
  u5: [
    {
      id: 'pf_index',
      kind: 'live',
      name: 'Index core',
      description: 'Passive core with minimal turnover.',
      totalValue: 1_29_100,
      totalPnlPct: 7.5,
      return1M: 0.9,
      xirr: 22.3,
      holdings: buildHoldingsFromPositions('u5', ['NIFTYBEES']),
    },
  ],
};

/** Followed-user portfolio edits surfaced in Activity. */
export const PORTFOLIO_CHANGES = [
  {
    id: 'pc_u1_1',
    userId: 'u1',
    portfolioId: 'pf_banks',
    portfolioName: 'Banking book',
    ticker: 'ICICIBANK',
    summary: 'Added ICICIBANK and rebalanced weights across private banks.',
    createdAt: '2026-07-04T11:20:00+05:30',
  },
  {
    id: 'pc_u2_1',
    userId: 'u2',
    portfolioId: 'pf_it',
    portfolioName: 'IT portfolio',
    summary: 'Updated investment thesis — cautious on near-term deal wins.',
    createdAt: '2026-07-03T16:45:00+05:30',
  },
  {
    id: 'pc_u4_1',
    userId: 'u4',
    portfolioId: 'pf_energy',
    portfolioName: 'Energy & infra',
    ticker: 'RELIANCE',
    summary: 'Trimmed RELIANCE after strength; redeploying into ONGC.',
    createdAt: '2026-07-02T18:35:00+05:30',
  },
];

export const POSTS = [
  {
    id: 'p1',
    authorId: 'u1',
    type: 'text',
    body: 'Quiet accumulation in @HDFCBANK continues. Credit growth is steady and valuations are finally reasonable after the long consolidation. Still prefer it over @ICICIBANK for the franchise quality, but both belong in a core book.\n\nWhat changed my mind over the last two quarters is deposit franchise quality and the pace of unsecured cleanup. The market keeps pricing private banks as if the rate cycle is the only variable. It is not. Operating leverage on a cleaner book matters more from here.\n\nI am not adding aggressively — just letting SIP-style buys work through dips. If we get a 5–7% pullback without a credit event, I will lean in. Until then, patience is the edge.',
    image: null,
    createdAt: '2026-07-03T08:12:00+05:30',
    likes: 214,
    comments: [
      {
        id: 'c1',
        authorId: 'u2',
        body: 'Agree on franchise. I hold @TCS more than banks right now — different cycle.',
        createdAt: '2026-07-03T09:01:00+05:30',
      },
      {
        id: 'c2',
        authorId: 'u5',
        body: 'On my watchlist for a better entry. @HDFCBANK needs a pullback.',
        createdAt: '2026-07-03T10:22:00+05:30',
      },
      {
        id: 'c1b',
        authorId: 'u4',
        body: 'Solid write-up. I stay away from banks — no position in either name.',
        createdAt: '2026-07-03T11:10:00+05:30',
      },
    ],
    via: { kind: 'topic', label: '#Banking', reason: 'topic you follow' },
    topics: ['Banking'],
  },
  {
    id: 'p2',
    authorId: 'u3',
    type: 'trade',
    body: 'Adding on strength. Auto cycle still has legs — rural demand + EV optionality.',
    trade: {
      action: 'buy',
      ticker: 'TATAMOTORS',
      qty: 50,
      price: 872.4,
      pnlPct: null,
    },
    image: null,
    createdAt: '2026-07-03T07:40:00+05:30',
    likes: 89,
    comments: [
      {
        id: 'c3',
        authorId: 'u4',
        body: 'Respect the conviction. I stay in @RELIANCE for energy exposure instead.',
        createdAt: '2026-07-03T08:05:00+05:30',
      },
    ],
    via: { kind: 'portfolio', label: 'TATAMOTORS', reason: 'in your portfolio' },
    topics: ['Smallcaps'],
  },
  {
    id: 'p3',
    authorId: 'u2',
    type: 'text',
    body: 'Weekly note: IT services commentary is cautious but @TCS and @INFY still print cash. I am not chasing — just holding through the noise.',
    image:
      'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80&auto=format&fit=crop',
    createdAt: '2026-07-02T21:15:00+05:30',
    likes: 156,
    comments: [
      {
        id: 'c4',
        authorId: 'u1',
        body: 'Exited @TCS earlier this year. Prefer banks at these levels.',
        createdAt: '2026-07-02T22:00:00+05:30',
      },
    ],
    via: { kind: 'person', label: '@ananyas', reason: 'person you follow' },
    topics: ['ITServices'],
  },
  {
    id: 'p4',
    authorId: 'u4',
    type: 'trade',
    body: 'Trimming into strength. Booked partial profits — still long the name.',
    trade: {
      action: 'sell',
      ticker: 'RELIANCE',
      qty: 10,
      price: 2568.0,
      pnlPct: 7.9,
    },
    image: null,
    createdAt: '2026-07-02T18:30:00+05:30',
    likes: 67,
    comments: [],
    via: { kind: 'portfolio', label: 'RELIANCE', reason: 'in your portfolio' },
    topics: ['Energy'],
  },
  {
    id: 'p5',
    authorId: 'u1',
    type: 'text',
    body: 'Rate cycle is the only macro that matters for @HDFCBANK and @ICICIBANK over the next 4 quarters. Everything else is noise.',
    image: null,
    createdAt: '2026-07-02T14:00:00+05:30',
    likes: 301,
    comments: [],
    via: { kind: 'person', label: '@rohanv', reason: 'person you follow' },
    topics: ['Banking', 'Macro'],
  },
  {
    id: 'p6',
    authorId: 'u5',
    type: 'text',
    body: 'Boring works. @NIFTYBEES + a few satellites. Sleep well, compound quietly.',
    image: null,
    createdAt: '2026-07-01T19:45:00+05:30',
    likes: 44,
    comments: [
      {
        id: 'c6',
        authorId: 'u1',
        body: 'This is the way. Core beta, satellite alpha.',
        createdAt: '2026-07-01T20:10:00+05:30',
      },
    ],
    via: { kind: 'topic', label: '#Macro', reason: 'topic you follow' },
    topics: ['Macro'],
  },
  {
    id: 'p7',
    authorId: 'u3',
    type: 'text',
    body: 'Watching @IRCTC for a cleaner setup. Not in yet — liquidity and valuation both need to cooperate.',
    image: null,
    createdAt: '2026-07-01T11:20:00+05:30',
    likes: 38,
    comments: [
      {
        id: 'c7',
        authorId: 'u5',
        body: 'Same. No position — just on the radar.',
        createdAt: '2026-07-01T12:00:00+05:30',
      },
    ],
    via: { kind: 'watchlist', label: 'IRCTC', reason: 'on your watchlist' },
    topics: ['Smallcaps'],
  },
  // Author talks about names they do NOT hold (blue "No position" disclosure)
  {
    id: 'p8',
    authorId: 'u5',
    type: 'text',
    body: 'Hot take I do not own: @RELIANCE looks fine on a 5-year view, but I am not buying here. Same for @TATAMOTORS — great narrative, not my risk budget. Happy to be wrong; just no position.',
    image: null,
    createdAt: '2026-07-03T12:30:00+05:30',
    likes: 52,
    comments: [
      {
        id: 'c8',
        authorId: 'u3',
        body: 'I do hold @TATAMOTORS — different risk tolerance.',
        createdAt: '2026-07-03T13:00:00+05:30',
      },
      {
        id: 'c8b',
        authorId: 'u4',
        body: 'Fair. I hold @RELIANCE and that is enough energy for me.',
        createdAt: '2026-07-03T13:40:00+05:30',
      },
    ],
    via: { kind: 'topic', label: '#Macro', reason: 'topic you follow' },
    topics: ['Macro', 'Energy'],
  },
  // Long post + mix of held / not held tickers (u2 holds TCS+INFY, not RELIANCE or TATAMOTORS)
  {
    id: 'p9',
    authorId: 'u2',
    type: 'text',
    body: 'A longer note on what I am actually doing versus what I am merely watching.\n\n@TCS and @INFY remain core holds. Cash conversion is intact, and I would rather own boring compounders than chase narrative stocks into strength. That does not mean the narratives are wrong — only that they are not in my book.\n\nOn @RELIANCE and @TATAMOTORS I have no position. I read every thread, I respect the bulls, and I still will not force a buy just to participate in the conversation. Skin in the game only counts when it is real capital, not vibes.\n\nIf you are long those names, great — disclose it. If you are not, say so. The feed is more useful when opinions come with that context. I will keep writing weekly notes either way; open this post for the full argument and the comment thread.',
    image: null,
    createdAt: '2026-07-03T16:00:00+05:30',
    likes: 188,
    comments: [
      {
        id: 'c9',
        authorId: 'u1',
        body: 'This is the standard. I hold banks, not autos — and I say so.',
        createdAt: '2026-07-03T16:30:00+05:30',
      },
      {
        id: 'c9b',
        authorId: 'u5',
        body: 'No position in @RELIANCE or @TATAMOTORS either. Watching only.',
        createdAt: '2026-07-03T17:05:00+05:30',
      },
      {
        id: 'c9c',
        authorId: 'u3',
        body: 'I hold @TATAMOTORS — so my bias is obvious.',
        createdAt: '2026-07-03T17:45:00+05:30',
      },
    ],
    via: { kind: 'person', label: '@ananyas', reason: 'person you follow' },
    topics: ['ITServices', 'Macro'],
  },
];

export const PORTFOLIO_UPDATES = {
  RELIANCE: [
    {
      id: 'u_r1',
      type: 'news',
      title: 'Jio platforms ARPU trends remain supportive, say brokerages',
      source: 'Mint',
      time: '2h',
    },
    {
      id: 'u_r2',
      type: 'post',
      postId: 'p4',
      authorId: 'u4',
      snippet: 'Trimming into strength. Booked partial profits — still long the name.',
      time: '5h',
    },
    {
      id: 'u_r3',
      type: 'sell',
      authorId: 'u4',
      qty: 10,
      price: 2568,
      pnlPct: 7.9,
      time: '5h',
    },
    {
      id: 'u_r4',
      type: 'post',
      authorId: 'u3',
      snippet: 'Still prefer energy exposure via Reliance over pure upstream names.',
      time: '1d',
    },
  ],
  HDFCBANK: [
    {
      id: 'u_h1',
      type: 'post',
      postId: 'p1',
      authorId: 'u1',
      snippet: 'Quiet accumulation in HDFCBANK continues…',
      time: '3h',
    },
    {
      id: 'u_h2',
      type: 'news',
      title: 'Private banks see stable NIMs in Q1 previews',
      source: 'ET',
      time: '6h',
    },
    {
      id: 'u_h3',
      type: 'buy',
      authorId: 'u1',
      qty: 20,
      price: 1658,
      pnlPct: null,
      time: '1d',
    },
  ],
  ICICIBANK: [
    {
      id: 'u_i1',
      type: 'news',
      title: 'ICICI Bank retail book growth remains ahead of peers',
      source: 'Bloomberg',
      time: '4h',
    },
    {
      id: 'u_i2',
      type: 'post',
      authorId: 'u1',
      snippet: 'Both HDFC and ICICI belong in a core book.',
      time: '3h',
    },
  ],
  TATAMOTORS: [
    {
      id: 'u_t1',
      type: 'buy',
      authorId: 'u3',
      qty: 50,
      price: 872.4,
      pnlPct: null,
      time: '4h',
    },
    {
      id: 'u_t2',
      type: 'post',
      postId: 'p2',
      authorId: 'u3',
      snippet: 'Adding on strength. Auto cycle still has legs…',
      time: '4h',
    },
  ],
  TCS: [
    {
      id: 'u_tc1',
      type: 'post',
      postId: 'p3',
      authorId: 'u2',
      snippet: 'IT services commentary is cautious but TCS still prints cash.',
      time: '1d',
    },
    {
      id: 'u_tc2',
      type: 'news',
      title: 'Deal wins steady; margin outlook cautious for IT majors',
      source: 'Reuters',
      time: '8h',
    },
  ],
  INFY: [
    {
      id: 'u_in1',
      type: 'post',
      authorId: 'u2',
      snippet: 'Holding INFY through the noise — cash generation intact.',
      time: '1d',
    },
  ],
  WIPRO: [
    {
      id: 'u_w1',
      type: 'news',
      title: 'Wipro focuses on large deal pipeline in Americas',
      source: 'Business Standard',
      time: '12h',
    },
  ],
  IRCTC: [
    {
      id: 'u_ir1',
      type: 'post',
      postId: 'p7',
      authorId: 'u3',
      snippet: 'Watching IRCTC for a cleaner setup. Not in yet.',
      time: '2d',
    },
  ],
};

export function getPerson(id) {
  if (id === CURRENT_USER.id) return CURRENT_USER;
  return PEOPLE.find((p) => p.id === id) ?? PEOPLE[0];
}

export function normalizeHandle(handle) {
  return String(handle ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
}

export function getPersonByHandle(handle) {
  const normalized = normalizeHandle(handle);
  if (!normalized) return null;
  if (normalizeHandle(CURRENT_USER.handle) === normalized) return CURRENT_USER;
  return PEOPLE.find((p) => normalizeHandle(p.handle) === normalized) ?? null;
}

export function getHandleForUserId(userId) {
  return getPerson(userId).handle;
}

export function getUserIdForHandle(handle) {
  return getPersonByHandle(handle)?.id ?? null;
}

export function getPosition(authorId, ticker) {
  return AUTHOR_POSITIONS[authorId]?.[ticker] ?? { status: 'none' };
}

/** Author's weight in a ticker as % of their held portfolio value. Null if not held. */
export function getPortfolioWeightPct(authorId, ticker) {
  const positions = AUTHOR_POSITIONS[authorId] ?? {};
  const holdings = Object.entries(positions).filter(([, p]) => p.status === 'holds' && p.qty);
  if (!holdings.length) return null;

  let total = 0;
  let target = 0;
  for (const [t, p] of holdings) {
    const price = STOCKS[t]?.price ?? p.avg ?? 0;
    const value = p.qty * price;
    total += value;
    if (t === ticker) target = value;
  }
  if (!total || !target) return null;
  return (target / total) * 100;
}


/** Profile trade log — portfolio edits append here automatically. */
export const USER_TRADES = {
  u_me: [
    {
      id: 't_me_1',
      portfolioId: 'pf_tactical',
      portfolioName: 'Tactical trades',
      action: 'buy',
      ticker: 'TATAMOTORS',
      qty: 20,
      price: 850,
      createdAt: '2026-06-28T10:00:00+05:30',
    },
  ],
  u3: [
    {
      id: 't_u3_1',
      portfolioId: 'pf_smallcap',
      portfolioName: 'Smallcap sleeve',
      action: 'buy',
      ticker: 'TATAMOTORS',
      qty: 50,
      price: 872.4,
      createdAt: '2026-07-03T07:40:00+05:30',
    },
  ],
  u4: [
    {
      id: 't_u4_1',
      portfolioId: 'pf_energy',
      portfolioName: 'Energy & infra',
      action: 'sell',
      ticker: 'RELIANCE',
      qty: 10,
      price: 2568,
      pnlPct: 7.9,
      createdAt: '2026-07-02T18:30:00+05:30',
    },
  ],
};

export function getUserTrades(userId) {
  return [...(USER_TRADES[userId] ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function recordPortfolioTrade(userId, trade) {
  if (!USER_TRADES[userId]) USER_TRADES[userId] = [];
  USER_TRADES[userId].unshift({
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    ...trade,
  });
}

export function recalcHolding(holding) {
  const stock = STOCKS[holding.ticker];
  const price = holding.price ?? stock?.price ?? holding.avg ?? 0;
  const qty = Number(holding.qty) || 0;
  const avg = Number(holding.avg) || 0;
  const value = qty * price;
  const cost = qty * avg;
  const pnl = value - cost;
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
  return {
    ...holding,
    qty,
    avg,
    price,
    value,
    pnl,
    pnlPct,
    spark: stock?.spark ?? holding.spark ?? [],
  };
}

export function recalcPortfolioTotals(holdings) {
  const rows = holdings.map(recalcHolding);
  const totalValue = rows.reduce((sum, h) => sum + (h.value ?? 0), 0);
  const invested = rows.reduce((sum, h) => sum + (h.qty ?? 0) * (h.avg ?? 0), 0);
  const totalPnlPct = invested > 0 ? ((totalValue - invested) / invested) * 100 : 0;
  return { holdings: rows, totalValue, invested, totalPnlPct };
}

function syncTradesFromHoldingsDiff(userId, portfolio, oldHoldings, newHoldings) {
  const oldMap = new Map(oldHoldings.map((h) => [h.ticker, h]));
  const newMap = new Map(newHoldings.map((h) => [h.ticker, h]));

  for (const [ticker, next] of newMap) {
    const prev = oldMap.get(ticker);
    const price = next.price ?? STOCKS[ticker]?.price ?? next.avg ?? 0;
    if (!prev) {
      recordPortfolioTrade(userId, {
        portfolioId: portfolio.id,
        portfolioName: portfolio.name,
        action: 'buy',
        ticker,
        qty: next.qty,
        price,
      });
      continue;
    }
    if (next.qty > prev.qty) {
      recordPortfolioTrade(userId, {
        portfolioId: portfolio.id,
        portfolioName: portfolio.name,
        action: 'buy',
        ticker,
        qty: next.qty - prev.qty,
        price,
      });
    } else if (next.qty < prev.qty) {
      const sellQty = prev.qty - next.qty;
      const pnlPct = prev.avg ? ((price - prev.avg) / prev.avg) * 100 : null;
      recordPortfolioTrade(userId, {
        portfolioId: portfolio.id,
        portfolioName: portfolio.name,
        action: 'sell',
        ticker,
        qty: sellQty,
        price,
        pnlPct,
      });
    }
  }

  for (const [ticker, prev] of oldMap) {
    if (newMap.has(ticker)) continue;
    const price = prev.price ?? STOCKS[ticker]?.price ?? prev.avg ?? 0;
    const pnlPct = prev.avg ? ((price - prev.avg) / prev.avg) * 100 : null;
    recordPortfolioTrade(userId, {
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      action: 'sell',
      ticker,
      qty: prev.qty,
      price,
      pnlPct,
    });
  }
}

export function applyPortfolioHoldingsUpdate(userId, portfolioId, nextHoldings, meta = {}) {
  const list = USER_PORTFOLIOS[userId];
  if (!list) return null;
  const idx = list.findIndex((p) => p.id === portfolioId);
  if (idx < 0) return null;

  const portfolio = list[idx];
  syncTradesFromHoldingsDiff(userId, portfolio, portfolio.holdings ?? [], nextHoldings);

  const { holdings, totalValue, invested, totalPnlPct } = recalcPortfolioTotals(nextHoldings);
  list[idx] = {
    ...portfolio,
    ...meta,
    holdings,
    totalValue,
    invested,
    totalPnlPct,
  };
  return list[idx];
}

/** All portfolios a user has published (respects privacy for visitors). */
function estimateReturns(portfolio) {
  const base1M =
    typeof portfolio.return1M === 'number'
      ? portfolio.return1M
      : (() => {
          const tickers =
            portfolio.tickers ??
            (portfolio.holdings ?? []).map((h) => h?.ticker).filter(Boolean);
          if (!tickers.length) return 0;
          const avg =
            tickers.reduce((sum, ticker) => sum + (STOCKS[ticker]?.changePct ?? 0), 0) /
            tickers.length;
          return Number((avg * 8).toFixed(1));
        })();

  const fromData = portfolio.returns ?? {};
  return {
    '1D': fromData['1D'] ?? Number((base1M / 20).toFixed(1)),
    '1W': fromData['1W'] ?? Number((base1M / 4).toFixed(1)),
    '1M': fromData['1M'] ?? base1M,
    '1Y': fromData['1Y'] ?? Number((base1M * 8).toFixed(1)),
  };
}

export function getPortfolioReturn(portfolio, period = '1M') {
  const returns = portfolio?.returns ?? estimateReturns(portfolio ?? {});
  return returns[period] ?? returns['1M'] ?? 0;
}

export function getUserPortfolios(userId) {
  return (USER_PORTFOLIOS[userId] ?? []).map((portfolio) => {
    const returns = estimateReturns(portfolio);
    return {
      ...portfolio,
      kind: portfolio.kind ?? 'live',
      objective: portfolio.objective ?? portfolio.description ?? '',
      thesis: portfolio.thesis ?? portfolio.description ?? '',
      tickers:
        portfolio.tickers ??
        (portfolio.holdings ?? []).map((h) => h?.ticker).filter(Boolean),
      holdingsCount: (portfolio.holdings ?? []).length,
      return1M: returns['1M'],
      returns,
    };
  });
}

export function getUserPortfolio(userId, portfolioId) {
  return getUserPortfolios(userId).find((p) => p.id === portfolioId) ?? null;
}

export function addUserPortfolio(userId, portfolio) {
  if (!USER_PORTFOLIOS[userId]) USER_PORTFOLIOS[userId] = [];
  USER_PORTFOLIOS[userId].push(portfolio);
  return portfolio;
}

export function isCopiedPortfolio(portfolio) {
  return Boolean(portfolio?.sourcePortfolioId);
}

export function copyPortfolioForUser(userId, source, { sourceUserId = null, sourceUserName = null } = {}) {
  const priorCopies = getUserPortfolios(userId).filter((p) => p.sourcePortfolioId === source.id);
  const name =
    priorCopies.length > 0 ? `${source.name} ${priorCopies.length + 1}` : source.name;
  const created = addUserPortfolio(userId, {
    id: `pf_copy_${Date.now()}`,
    kind: source.kind ?? 'live',
    name,
    objective: source.objective ?? '',
    thesis: source.thesis ?? '',
    sourcePortfolioId: source.id,
    sourcePortfolioName: source.name,
    sourceUserId,
    sourceUserName,
    holdings: (source.holdings ?? []).map((h) => ({ ...h })),
    tickers: [...(source.tickers ?? [])],
    watchlistBaseInvestment: source.watchlistBaseInvestment,
    totalValue: source.totalValue ?? 0,
    invested: source.invested ?? 0,
    totalPnlPct: source.totalPnlPct ?? 0,
    return1M: source.return1M,
    xirr: source.xirr ?? 0,
  });
  return created;
}

export function deleteUserPortfolio(userId, portfolioId) {
  const list = USER_PORTFOLIOS[userId];
  if (!list) return false;
  const idx = list.findIndex((p) => p.id === portfolioId);
  if (idx < 0) return false;
  list.splice(idx, 1);
  return true;
}

export const WATCHLIST_BASE_INVESTMENT = 10_000;

/** Build holdings for watchlists from tickers or stored weights (₹10k assumed at creation). */
export function resolveWatchlistHoldings(portfolio) {
  const base = portfolio.watchlistBaseInvestment ?? WATCHLIST_BASE_INVESTMENT;
  const existing = portfolio.holdings ?? [];
  if (existing.length) return existing.map(recalcHolding);

  const tickers = portfolio.tickers ?? [];
  if (!tickers.length) return [];

  const weight = 100 / tickers.length;
  return tickers.map((ticker) => {
    const price = STOCKS[ticker]?.price ?? 0;
    const invested = base * (weight / 100);
    const qty = price > 0 ? invested / price : 0;
    return recalcHolding({ ticker, qty, avg: price, price, weightPct: weight });
  });
}

/** Metrics for Portfolio tab — live and watchlist share the same layout. */
export function computePortfolioDisplayMetrics(portfolio) {
  const isWatchlist = portfolio.kind === 'watchlist';
  const holdings = isWatchlist
    ? resolveWatchlistHoldings(portfolio)
    : (portfolio.holdings ?? []).map(recalcHolding);

  const totalValue = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0);
  const invested = isWatchlist
    ? portfolio.watchlistBaseInvestment ?? WATCHLIST_BASE_INVESTMENT
    : holdings.reduce((sum, h) => sum + (h.qty ?? 0) * (h.avg ?? 0), 0);
  const totalPnl = totalValue - invested;
  const totalPnlPct = invested > 0 ? (totalPnl / invested) * 100 : 0;
  const todayPnl = holdings.reduce((sum, h) => {
    const changePct = STOCKS[h.ticker]?.changePct ?? 0;
    return sum + (h.value ?? 0) * (changePct / 100);
  }, 0);
  const todayPnlPct = totalValue > 0 ? (todayPnl / totalValue) * 100 : 0;

  const distribution = holdings
    .map((h) => ({
      ticker: h.ticker,
      weight: totalValue > 0 ? ((h.value ?? 0) / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.weight - a.weight);

  return {
    kind: 'portfolio',
    totalValue,
    invested,
    totalPnl,
    totalPnlPct,
    todayPnl,
    todayPnlPct,
    xirr: portfolio.xirr ?? totalPnlPct,
    count: holdings.length,
    distribution,
    holdings,
  };
}

export function updateUserPortfolio(userId, portfolioId, patch) {
  const list = USER_PORTFOLIOS[userId];
  if (!list) return null;
  const idx = list.findIndex((p) => p.id === portfolioId);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...patch };
  return list[idx];
}

/** Public portfolio snapshot for any user (qty/avg hidden for non-self). */
export function getPublicPortfolio(userId) {
  const person = getPerson(userId);
  const positions = AUTHOR_POSITIONS[userId] ?? {};
  const holdings = Object.entries(positions)
    .filter(([, p]) => p.status === 'holds')
    .map(([ticker, p]) => {
      const stock = STOCKS[ticker];
      const price = stock?.price ?? p.avg ?? 0;
      const value = (p.qty ?? 0) * price;
      return {
        ticker,
        qty: p.qty,
        avg: p.avg,
        price,
        value,
        pnlPct: p.pnlPct ?? stock?.changePct ?? 0,
        spark: stock?.spark ?? [],
      };
    });

  const isSelf = userId === CURRENT_USER.id;
  return {
    holdings,
    xirr: person.xirr,
    portfolioPublic: isSelf ? CURRENT_USER.portfolioPublic !== false : person.portfolioPublic !== false,
    showHoldingsPublic: isSelf
      ? CURRENT_USER.showHoldingsPublic !== false
      : person.showHoldingsPublic !== false,
    showXirrPublic: isSelf
      ? CURRENT_USER.showXirrPublic !== false
      : person.showXirrPublic !== false,
    watchlistCount: Object.values(positions).filter((p) => p.status === 'watchlist').length,
  };
}

export function primaryHoldingsLabel(authorId) {
  const positions = AUTHOR_POSITIONS[authorId] ?? {};
  const holds = Object.entries(positions)
    .filter(([, p]) => p.status === 'holds')
    .map(([t]) => t.replace('BANK', '').slice(0, 6));
  if (!holds.length) return 'No position';
  const shown = holds.slice(0, 2).join(', ');
  return holds.length > 2 ? `Holds ${shown}…` : `Holds ${shown}`;
}
