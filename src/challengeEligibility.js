import { MAX_USER_BASKETS } from './app/basketStore';

export const REQUIRED_REFERRALS = 5;

const ENTERED_KEY = 'pocketedge_challenge_entered';

export function getChallengeProgress({ user, userBaskets = [], waitlistStatus = null }) {
  const referralCount = waitlistStatus?.referral_count ?? 0;

  return {
    registered: !!user,
    hasBaskets: userBaskets.length >= 1,
    basketCount: userBaskets.length,
    maxBaskets: MAX_USER_BASKETS,
    referralCount,
    referralsMet: referralCount >= REQUIRED_REFERRALS,
  };
}

export function isChallengeEligible(progress) {
  return progress.registered && progress.hasBaskets && progress.referralsMet;
}

export function getChallengeStepsRemaining(progress) {
  return [progress.registered, progress.hasBaskets, progress.referralsMet].filter(
    (done) => !done
  ).length;
}

export function getLoggedInChallengeBanner(progress) {
  const remaining = getChallengeStepsRemaining(progress);

  if (remaining === 0) {
    return {
      message: 'See your current ranking in leaderboard',
      href: '/?tab=leaderboard',
    };
  }

  const stepLabel = remaining === 1 ? 'step' : 'steps';
  return {
    message: `${remaining} ${stepLabel} away from winning grand prize of INR 50K`,
    href: '/?tab=leaderboard',
  };
}

export function hasEnteredChallenge() {
  try {
    return localStorage.getItem(ENTERED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markChallengeEntered() {
  localStorage.setItem(ENTERED_KEY, '1');
}
