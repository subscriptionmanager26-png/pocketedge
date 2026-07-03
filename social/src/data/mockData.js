/** Demo data for PocketEdge Social — skin-in-the-game disclosure throughout. */

export const CURRENT_USER = {
  id: 'u_me',
  name: 'Kushagra',
  handle: 'kushagra',
  avatar: 'K',
  xirr: 24.6,
  followers: 1284,
  following: 86,
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
    bio: 'Long-term compounder. Banks & quality compounders.',
  },
  {
    id: 'u2',
    name: 'Ananya Shah',
    handle: 'ananyas',
    avatar: 'A',
    xirr: 28.4,
    followers: 5120,
    following: 145,
    bio: 'IT + consumption. Writes weekly notes.',
  },
  {
    id: 'u3',
    name: 'Vikram Mehta',
    handle: 'vikramm',
    avatar: 'V',
    xirr: 19.8,
    followers: 2340,
    following: 98,
    bio: 'Smallcaps & special situations.',
  },
  {
    id: 'u4',
    name: 'Priya Nair',
    handle: 'priyan',
    avatar: 'P',
    xirr: 26.1,
    followers: 3890,
    following: 176,
    bio: 'Macro-aware equity. Energy & infra.',
  },
  {
    id: 'u5',
    name: 'Arjun Kapoor',
    handle: 'arjunk',
    avatar: 'A',
    xirr: 22.3,
    followers: 1560,
    following: 64,
    bio: 'Index + satellites. Low drama.',
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
  RELIANCE: { name: 'Reliance Industries', price: 2574.2, changePct: 1.24, spark: [2480, 2495, 2510, 2502, 2530, 2555, 2574] },
  HDFCBANK: { name: 'HDFC Bank', price: 1665.8, changePct: -0.42, spark: [1680, 1675, 1670, 1668, 1672, 1660, 1666] },
  ICICIBANK: { name: 'ICICI Bank', price: 1059.4, changePct: 0.88, spark: [1030, 1038, 1045, 1042, 1050, 1055, 1059] },
  TCS: { name: 'Tata Consultancy', price: 3940.0, changePct: 0.35, spark: [3880, 3895, 3910, 3900, 3925, 3935, 3940] },
  INFY: { name: 'Infosys', price: 1516.5, changePct: -0.18, spark: [1525, 1520, 1518, 1522, 1515, 1512, 1517] },
  TATAMOTORS: { name: 'Tata Motors', price: 879.2, changePct: 2.14, spark: [820, 835, 850, 845, 860, 870, 879] },
  ONGC: { name: 'ONGC', price: 233.1, changePct: 0.62, spark: [225, 228, 230, 229, 231, 232, 233] },
  NTPC: { name: 'NTPC', price: 368.4, changePct: -0.25, spark: [372, 370, 369, 371, 368, 367, 368] },
  IRCTC: { name: 'IRCTC', price: 812.0, changePct: 1.05, spark: [790, 795, 800, 798, 805, 810, 812] },
  WIPRO: { name: 'Wipro', price: 498.6, changePct: 0.12, spark: [495, 496, 497, 496, 498, 499, 499] },
  NIFTYBEES: { name: 'Nippon Nifty BeES', price: 258.2, changePct: 0.41, spark: [252, 253, 254, 255, 256, 257, 258] },
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

export const POSTS = [
  {
    id: 'p1',
    authorId: 'u1',
    type: 'text',
    body: 'Quiet accumulation in $HDFCBANK continues. Credit growth is steady and valuations are finally reasonable after the long consolidation. Still prefer it over $ICICIBANK for the franchise quality, but both belong in a core book.',
    image: null,
    createdAt: '2026-07-03T08:12:00+05:30',
    likes: 214,
    comments: [
      {
        id: 'c1',
        authorId: 'u2',
        body: 'Agree on franchise. I hold $TCS more than banks right now — different cycle.',
        createdAt: '2026-07-03T09:01:00+05:30',
      },
      {
        id: 'c2',
        authorId: 'u5',
        body: 'On my watchlist for a better entry. $HDFCBANK needs a pullback.',
        createdAt: '2026-07-03T10:22:00+05:30',
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
        body: 'Respect the conviction. I stay in $RELIANCE for energy exposure instead.',
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
    body: 'Weekly note: IT services commentary is cautious but $TCS and $INFY still print cash. I am not chasing — just holding through the noise.',
    image:
      'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80&auto=format&fit=crop',
    createdAt: '2026-07-02T21:15:00+05:30',
    likes: 156,
    comments: [
      {
        id: 'c4',
        authorId: 'u1',
        body: 'Exited $TCS earlier this year. Prefer banks at these levels.',
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
    body: 'Rate cycle is the only macro that matters for $HDFCBANK and $ICICIBANK over the next 4 quarters. Everything else is noise.',
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
    body: 'Boring works. $NIFTYBEES + a few satellites. Sleep well, compound quietly.',
    image: null,
    createdAt: '2026-07-01T19:45:00+05:30',
    likes: 44,
    comments: [],
    via: { kind: 'topic', label: '#Macro', reason: 'topic you follow' },
    topics: ['Macro'],
  },
  {
    id: 'p7',
    authorId: 'u3',
    type: 'text',
    body: 'Watching $IRCTC for a cleaner setup. Not in yet — liquidity and valuation both need to cooperate.',
    image: null,
    createdAt: '2026-07-01T11:20:00+05:30',
    likes: 38,
    comments: [],
    via: { kind: 'watchlist', label: 'IRCTC', reason: 'on your watchlist' },
    topics: ['Smallcaps'],
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

export function getPosition(authorId, ticker) {
  return AUTHOR_POSITIONS[authorId]?.[ticker] ?? { status: 'none' };
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
