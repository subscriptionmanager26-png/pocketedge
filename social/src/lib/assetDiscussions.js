import { FUNDS } from '../data/fundData';
import { POSTS } from '../data/mockData';
import { isDevMockMode } from './appMode';
import { bodyMentionsTicker } from './tickers';

/** Fund-specific discussion posts (discussions = posts). */
export const FUND_DISCUSSION_POSTS = [
  {
    id: 'fdp_1',
    authorId: 'u1',
    type: 'text',
    body: 'Moved a chunk of my flexi allocation into Parag Parikh Flexi Cap. The global sleeve is the differentiator — not chasing every rally, but compounding quietly over 5+ years.',
    createdAt: '2026-07-02T10:00:00+05:30',
    likes: 86,
    comments: [{ id: 'fdc_1', authorId: 'u2', body: 'Same here. Cash drag is real but I sleep better.', createdAt: '2026-07-02T11:00:00+05:30' }],
    fundIds: ['fund_parag_flexi'],
  },
  {
    id: 'fdp_2',
    authorId: 'u2',
    type: 'text',
    body: 'Motilal Oswal Midcap is not for the faint-hearted. If you cannot handle 30% drawdowns, stick to flexi. If you can, the 5Y track record speaks for itself.',
    createdAt: '2026-07-01T14:30:00+05:30',
    likes: 54,
    comments: [],
    fundIds: ['fund_motilal_mid'],
  },
  {
    id: 'fdp_3',
    authorId: 'u3',
    type: 'text',
    body: 'Small cap SIP note: Nippon India Small Cap still my pick despite liquidity gates. Size your SIP — lump sums get restricted anyway.',
    createdAt: '2026-06-30T09:15:00+05:30',
    likes: 41,
    comments: [{ id: 'fdc_2', authorId: 'u4', body: 'Liquidity risk is the elephant in the room.', createdAt: '2026-06-30T10:00:00+05:30' }],
    fundIds: ['fund_nippon_small'],
  },
  {
    id: 'fdp_4',
    authorId: 'u5',
    type: 'text',
    body: 'HDFC Flexi Cap feels like a closet index at this point. Decent house, but I prefer PPFAS or Parag for true flexi behaviour.',
    createdAt: '2026-06-28T16:00:00+05:30',
    likes: 33,
    comments: [],
    fundIds: ['fund_hdfc_flexi', 'fund_ppfas_flexi', 'fund_parag_flexi'],
  },
  {
    id: 'fdp_5',
    authorId: 'u4',
    type: 'text',
    body: 'Axis Midcap vs Kotak Emerging Equity — both quality, but Axis feels more diversified. Anyone switching between the two this year?',
    createdAt: '2026-06-27T11:20:00+05:30',
    likes: 29,
    comments: [{ id: 'fdc_3', authorId: 'u1', body: 'Staying with Axis for now.', createdAt: '2026-06-27T12:00:00+05:30' }],
    fundIds: ['fund_axis_mid', 'fund_kotak_mid'],
  },
];

function sortByDate(posts) {
  return [...posts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getStockDiscussions(ticker) {
  if (!isDevMockMode()) return [];
  const fromFeed = POSTS.filter(
    (post) => post.trade?.ticker === ticker || bodyMentionsTicker(post.body, ticker)
  );
  return sortByDate(fromFeed).slice(0, 12);
}

export function getFundDiscussions(fundId) {
  if (!isDevMockMode()) return [];
  const fund = FUNDS[fundId];
  const fromFundPosts = FUND_DISCUSSION_POSTS.filter((post) =>
    post.fundIds?.includes(fundId)
  );
  if (fromFundPosts.length) return sortByDate(fromFundPosts);

  if (!fund) return [];

  const nameNeedle = fund.name.toLowerCase();
  const shortName = fund.name.split(' ').slice(0, 2).join(' ').toLowerCase();
  const fromFeed = POSTS.filter((post) => {
    const body = post.body?.toLowerCase() ?? '';
    return body.includes(nameNeedle) || body.includes(shortName);
  });

  return sortByDate(fromFeed.length ? fromFeed : fromFundPosts).slice(0, 12);
}

function bodyMentionsLabel(body, label) {
  if (!body || !label) return false;
  const needle = String(label).toLowerCase();
  return body.toLowerCase().includes(needle);
}

export function getIndexDiscussions(indexId, indexName) {
  if (!isDevMockMode()) return [];
  const fromFeed = POSTS.filter(
    (post) =>
      bodyMentionsTicker(post.body, indexId) ||
      bodyMentionsLabel(post.body, indexName) ||
      bodyMentionsLabel(post.body, indexId)
  );
  return sortByDate(fromFeed).slice(0, 12);
}

export function getCommodityDiscussions(commodityId, commodityName) {
  if (!isDevMockMode()) return [];
  const fromFeed = POSTS.filter(
    (post) =>
      bodyMentionsLabel(post.body, commodityName) ||
      bodyMentionsLabel(post.body, commodityId)
  );
  return sortByDate(fromFeed).slice(0, 12);
}
