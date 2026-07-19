/**
 * Anonymous blur-backdrop shapes only.
 * Never reference demo user ids / names / handles — production must not paint people.
 */

export const PREVIEW_REVIEWS = [
  {
    id: 'blur_rev_1',
    authorId: null,
    rating: 5,
    body: 'Strong conviction pick for a longer horizon. Execution and capital allocation have stayed consistent.',
    createdAt: '2026-06-28T10:00:00.000Z',
    agreeCount: 42,
    disagreeCount: 3,
    shareCount: 8,
    comments: [],
  },
  {
    id: 'blur_rev_2',
    authorId: null,
    rating: 4,
    body: 'Solid risk-reward here, though near-term swings are likely. Prefer adding on meaningful dips.',
    createdAt: '2026-06-25T09:30:00.000Z',
    agreeCount: 28,
    disagreeCount: 6,
    shareCount: 4,
    comments: [],
  },
  {
    id: 'blur_rev_3',
    authorId: null,
    rating: 5,
    body: 'One of the cleaner setups in the space. Cash flows look durable and the moat is still underappreciated.',
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
    authorId: null,
    body: 'Adding on dips — thesis unchanged. Still treating this as a core sleeve through volatility.',
    likes: 86,
    comments: [],
  },
  {
    id: 'blur_disc_2',
    authorId: null,
    body: 'Watching the next couple of quarters. If delivery holds, this could re-rate. Not sizing up yet.',
    likes: 54,
    comments: [],
  },
  {
    id: 'blur_disc_3',
    authorId: null,
    body: 'Trimmed a little into strength but still overweight. Open to the bear case — always learning.',
    likes: 41,
    comments: [],
  },
];

/** Anonymous silhouette rows — no names, handles, or demo user ids. */
export const PREVIEW_HOLDERS = [
  { label: 'Disclosed holder', detail: 'Holds in portfolio' },
  { label: 'Disclosed holder', detail: 'Holds in portfolio' },
  { label: 'Disclosed holder', detail: 'Holds in portfolio' },
  { label: 'Disclosed holder', detail: 'Holds in portfolio' },
];

export const PREVIEW_NEWS = [
  {
    id: 'blur_n1',
    title: 'Recent coverage after the latest results print',
    publishedAt: '2026-07-10T08:00:00.000Z',
    summary: 'Analyst notes cite execution and margins, with most houses keeping an accumulate stance.',
  },
  {
    id: 'blur_n2',
    title: 'Shareholding update shows modest institutional interest',
    publishedAt: '2026-07-09T12:00:00.000Z',
    summary: 'Quarterly filings pointed to small adds from mutual funds and overseas investors.',
  },
  {
    id: 'blur_n3',
    title: 'Sector preview notes remain constructive',
    publishedAt: '2026-07-08T09:30:00.000Z',
    summary: 'Demand visibility and pricing power still listed as supports despite macro noise.',
  },
];
