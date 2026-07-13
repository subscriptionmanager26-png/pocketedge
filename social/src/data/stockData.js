/** Stock-specific reviews, holders, and news for investment pages. */

import { isDevMockMode } from '../lib/appMode';
import { formatNewsDate } from '../lib/format';
import { AUTHOR_POSITIONS, PORTFOLIO_UPDATES, STOCKS } from './mockData';

export const SEED_STOCK_REVIEWS = [
  {
    id: 'rev_stock_1',
    stockTicker: 'RELIANCE',
    authorId: 'u4',
    rating: 4,
    body: 'Retail + Jio + O2C optionality - still a core compounder despite premium valuations.',
    createdAt: '2026-06-27T10:00:00.000Z',
    agreeCount: 31,
    disagreeCount: 8,
    shareCount: 6,
    comments: [
      {
        id: 'rc_st1',
        authorId: 'u3',
        body: 'Energy margin cycle makes this trickier than 2020.',
        parentId: null,
        createdAt: '2026-06-27T14:00:00.000Z',
      },
    ],
  },
  {
    id: 'rev_stock_2',
    stockTicker: 'RELIANCE',
    authorId: 'u1',
    rating: 5,
    body: 'Best risk-reward among large caps for a 5-year SIP - management execution is underappreciated.',
    createdAt: '2026-06-22T09:00:00.000Z',
    agreeCount: 44,
    disagreeCount: 5,
    shareCount: 9,
    comments: [],
  },
  {
    id: 'rev_stock_3',
    stockTicker: 'HDFCBANK',
    authorId: 'u1',
    rating: 5,
    body: 'Private bank leader - every dip in the last decade has been a gift.',
    createdAt: '2026-06-24T11:30:00.000Z',
    agreeCount: 38,
    disagreeCount: 4,
    shareCount: 7,
    comments: [
      {
        id: 'rc_st2',
        authorId: 'u2',
        body: 'Agree, but watch unsecured retail stress in the next 2 quarters.',
        parentId: null,
        createdAt: '2026-06-25T08:00:00.000Z',
      },
    ],
  },
  {
    id: 'rev_stock_4',
    stockTicker: 'TCS',
    authorId: 'u2',
    rating: 4,
    body: 'Quality franchise, but growth has slowed - hold for stability not upside.',
    createdAt: '2026-06-19T16:00:00.000Z',
    agreeCount: 22,
    disagreeCount: 6,
    shareCount: 3,
    comments: [],
  },
  {
    id: 'rev_stock_5',
    stockTicker: 'TATAMOTORS',
    authorId: 'u3',
    rating: 5,
    body: 'JLR turnaround + domestic SUV mix = multi-year earnings upgrade story.',
    createdAt: '2026-06-16T12:00:00.000Z',
    agreeCount: 27,
    disagreeCount: 9,
    shareCount: 4,
    comments: [],
  },
];

export function getStock(ticker) {
  const data = STOCKS[ticker];
  if (!data) return null;
  return { ticker, ...data };
}

export function getStockHolders(ticker) {
  return Object.entries(AUTHOR_POSITIONS)
    .filter(([, positions]) => positions[ticker]?.status === 'holds')
    .map(([userId]) => userId);
}

/** Demo-only news; production uses stockNewsApi. */
export function getStockNews(ticker) {
  if (!isDevMockMode()) return [];

  return (PORTFOLIO_UPDATES[ticker] ?? [])
    .filter((u) => u.type === 'news')
    .map((u) => ({
      id: u.id,
      title: u.title,
      summary: u.summary ?? '',
      publishedAt: u.publishedAt,
      time: u.publishedAt ? formatNewsDate(u.publishedAt) : u.time,
    }));
}

export function averageStockRating(ticker, reviews) {
  const list = reviews ?? [];
  if (!list.length) return null;
  const sum = list.reduce((s, r) => s + r.rating, 0);
  return (sum / list.length).toFixed(1);
}
