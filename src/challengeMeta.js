export const CHALLENGE_NAME = 'The Market Whisperer Challenge';

export const CHALLENGE_WINDOW = 'Win Grand Prize of INR 50K';

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
