import { getChallengeProgress } from '../challengeEligibility';

export const REFERRALS_DEMO_USER = {
  id: 'demo-referrals-5',
  email: 'alex.investor@example.com',
  user_metadata: { full_name: 'Alex Investor' },
};

export const REFERRALS_DEMO_WAITLIST = {
  waitlist_number: 1284,
  effective_rank: 1234,
  referral_count: 5,
  referred_by: null,
  next_rank_update_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  access_confirmed: false,
};

export const REFERRALS_DEMO_BASKETS = [
  {
    id: 'demo-basket-india-tech',
    name: 'India Tech Conviction',
    shortDescription: 'High-growth Indian tech names with global revenue exposure.',
    description: 'A thematic basket built for the challenge.',
    imageGradient: 'from-violet-600 to-cyan-500',
    type: 'Thematic',
    tags: ['Tech', 'India'],
    weightingType: 'equal',
    rebalanceFrequency: 'quarterly',
    constituents: [
      { symbol: 'INFY', name: 'Infosys', weight: 25, segment: 'Largecap' },
      { symbol: 'TCS', name: 'TCS', weight: 25, segment: 'Largecap' },
      { symbol: 'WIT', name: 'Wipro', weight: 25, segment: 'Largecap' },
      { symbol: 'HCLTECH', name: 'HCL Tech', weight: 25, segment: 'Largecap' },
    ],
    stats: { cagr: 18.4, minInvestAmount: 5000, volatility: 'Medium Volatility', constituents: 4 },
    creatorName: 'Alex Investor',
    createdAt: '2026-05-01T00:00:00.000Z',
  },
];

export function getReferralsDemoProgress() {
  return getChallengeProgress({
    user: REFERRALS_DEMO_USER,
    userBaskets: REFERRALS_DEMO_BASKETS,
    waitlistStatus: REFERRALS_DEMO_WAITLIST,
  });
}
