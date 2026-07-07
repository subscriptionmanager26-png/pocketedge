/** Shared blur-backdrop content — identical on every stock and mutual fund page. */

export const PREVIEW_REVIEWS = [
  {
    id: 'blur_rev_1',
    authorId: 'u1',
    rating: 5,
    body: 'Strong conviction pick for a 5-year horizon. Management quality and capital allocation have been consistent through cycles.',
    createdAt: '2026-06-28T10:00:00.000Z',
    agreeCount: 42,
    disagreeCount: 3,
    shareCount: 8,
    comments: [{ id: 'blur_rc_1', authorId: 'u2', body: 'Agree — this is a core holding for me too.', createdAt: '2026-06-28T14:00:00.000Z' }],
  },
  {
    id: 'blur_rev_2',
    authorId: 'u4',
    rating: 4,
    body: 'Good risk-reward at current levels, though near-term volatility is likely. Would add on meaningful dips.',
    createdAt: '2026-06-25T09:30:00.000Z',
    agreeCount: 28,
    disagreeCount: 6,
    shareCount: 4,
    comments: [],
  },
  {
    id: 'blur_rev_3',
    authorId: 'u2',
    rating: 5,
    body: 'One of the cleaner franchises in the space. Cash flows are predictable and the moat is underappreciated.',
    createdAt: '2026-06-22T11:00:00.000Z',
    agreeCount: 35,
    disagreeCount: 5,
    shareCount: 5,
    comments: [],
  },
];

export const PREVIEW_DISCUSSIONS = [
  {
    id: 'blur_disc_1',
    authorId: 'u1',
    body: 'Adding on dips — thesis unchanged. This remains a core position in my portfolio and I am happy to hold through volatility.',
    likes: 86,
    comments: [{ id: 'blur_dc_1', authorId: 'u2', body: 'Same view here. Patience is the edge.', createdAt: '2026-07-02T11:00:00+05:30' }],
  },
  {
    id: 'blur_disc_2',
    authorId: 'u3',
    body: 'Watching the next two quarters closely. If execution holds, this could re-rate. Not increasing size until we see delivery.',
    likes: 54,
    comments: [],
  },
  {
    id: 'blur_disc_3',
    authorId: 'u4',
    body: 'Trimmed a small portion into strength but still overweight. Happy to discuss the bear case in comments — always learning.',
    likes: 41,
    comments: [{ id: 'blur_dc_2', authorId: 'u5', body: 'Fair trim. I am holding full size.', createdAt: '2026-06-30T10:00:00+05:30' }],
  },
];


export const PREVIEW_HOLDERS = [
  { userId: 'u1', detail: '120 shares · +12.4% P&L' },
  { userId: 'u2', detail: '40 shares · +14.2% P&L' },
  { userId: 'u3', detail: '200 shares · +22.1% P&L' },
  { userId: 'u4', detail: '50 shares · +9.2% P&L' },
  { userId: 'u5', detail: 'Holds in portfolio' },
];

export const PREVIEW_NEWS = [
  { id: 'blur_n1', title: 'Brokerages maintain positive outlook after quarterly results', source: 'Mint', time: '2h' },
  { id: 'blur_n2', title: 'Institutional investors increase stake in latest shareholding pattern', source: 'Economic Times', time: '5h' },
  { id: 'blur_n3', title: 'Sector tailwinds remain intact, say analysts in preview notes', source: 'Moneycontrol', time: '8h' },
  { id: 'blur_n4', title: 'Management guides for steady growth amid macro uncertainty', source: 'Business Standard', time: '1d' },
  { id: 'blur_n5', title: 'Stock among top discussed names on social investing platforms this week', source: 'Reuters', time: '2d' },
];
