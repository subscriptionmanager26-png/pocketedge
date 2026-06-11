/** Dev-only preview routes for product demos */
export function isReferralsDemoRoute() {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(window.location.search).get('demo') === 'referrals';
}

export function isChallengeDemoRoute() {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(window.location.search).get('demo') === 'challenge';
}

export function isStep2DemoRoute() {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(window.location.search).get('demo') === 'step2';
}
