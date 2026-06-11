export const CHALLENGE_NAME = 'The Market Whisperer Challenge';

export const CHALLENGE_WINDOW = 'Win Grand Prize of INR 50K';

export const CHALLENGE_PRIZE_HEADLINE = 'Grand Prize of INR 50K awaits you';

export const CHALLENGE_BASKETS_HINT =
  'Make 5 baskets to maximise your chances of winning';

export const CHALLENGE_START_LABEL = 'Challenge starts 1 July';

export function getChallengeBannerHref() {
  if (typeof window === 'undefined') return '#challenge';

  const params = new URLSearchParams(window.location.search);

  if (params.get('leaderboard') === '1') {
    return null;
  }

  if (params.get('tab') === 'leaderboard' || params.get('app') === '1') {
    return '/?tab=leaderboard';
  }

  if (params.get('waitlist') === '1') {
    return '/?leaderboard=1';
  }

  return '#challenge';
}
