import posthog from 'posthog-js';
import { isPostHogEnabled } from './posthog';
import { isChallengeEligible } from './challengeEligibility';

function pathContext() {
  if (typeof window === 'undefined') return {};
  return { app_path: `${window.location.pathname}${window.location.search}` };
}

export function capture(event, properties = {}) {
  if (!isPostHogEnabled) return;
  posthog.capture(event, { ...pathContext(), ...properties });
}

export function captureScreen(screen, properties = {}) {
  capture('screen_viewed', { screen, ...properties });
}

export function syncUserWaitlistTraits(user, status) {
  if (!isPostHogEnabled || !user?.id) return;
  posthog.identify(user.id, {
    email: user.email ?? undefined,
    access_confirmed: status?.access_confirmed ?? false,
    waitlist_rank: status?.effective_rank ?? null,
    waitlist_number: status?.waitlist_number ?? null,
    referral_count: status?.referral_count ?? 0,
  });
}

export function captureAuthStarted(source) {
  try {
    sessionStorage.setItem('ph_sign_in_source', source);
  } catch {
    // ignore
  }
  capture('sign_in_started', { source });
}

export function captureAuthCompleted({ source, isNewWaitlistMember = false } = {}) {
  let resolvedSource = source;
  if (!resolvedSource) {
    try {
      resolvedSource = sessionStorage.getItem('ph_sign_in_source') || 'unknown';
      sessionStorage.removeItem('ph_sign_in_source');
    } catch {
      resolvedSource = 'unknown';
    }
  }
  capture('sign_in_completed', {
    source: resolvedSource,
    is_new_waitlist_member: isNewWaitlistMember,
  });
}

export function captureAuthFailed({ source, error } = {}) {
  const message = typeof error === 'string' ? error : error?.message;
  capture('sign_in_failed', {
    source,
    error_message: message?.slice(0, 200) ?? 'unknown',
  });
}

export function captureOAuthCallbackError() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error_description') || params.get('error');
  if (error) captureAuthFailed({ source: 'oauth_callback', error });
}

export function captureWaitlistJoined({ referredByCode = false } = {}) {
  capture('waitlist_joined', { referred_by_code: referredByCode });
}

export function captureWaitlistJoinFailed(error) {
  capture('waitlist_join_failed', {
    error_message: (error?.message || String(error)).slice(0, 200),
  });
}

export function captureUserSessionStarted({ accessConfirmed, waitlistStatus, challengeProgress }) {
  capture('user_session_started', {
    access_confirmed: accessConfirmed,
    waitlist_rank: waitlistStatus?.effective_rank ?? null,
    referral_count: waitlistStatus?.referral_count ?? 0,
    basket_count: challengeProgress?.basketCount ?? 0,
    challenge_eligible: challengeProgress ? isChallengeEligible(challengeProgress) : false,
  });
}

export function captureChallengeProgress(progress, trigger) {
  capture('challenge_progress_updated', {
    trigger,
    basket_count: progress.basketCount,
    referral_count: progress.referralCount,
    challenge_eligible: isChallengeEligible(progress),
    registered: progress.registered,
    has_baskets: progress.hasBaskets,
    referrals_met: progress.referralsMet,
  });
}

export function captureAppTabViewed(tab, { accessLimited = false, basketId = null, createMode = null } = {}) {
  capture('app_tab_viewed', {
    tab,
    access_limited: accessLimited,
    basket_id: basketId,
    create_mode: createMode,
  });
}

export function captureCreateFlowStarted({ mode = 'new' } = {}) {
  capture('create_flow_started', { mode });
}

export function captureCreateStepViewed(stepId, stepIndex, totalSteps) {
  capture('create_step_viewed', {
    step_id: stepId,
    step_index: stepIndex,
    total_steps: totalSteps,
  });
}

export function captureChallengeTaskClicked(taskId, actionLabel) {
  capture('challenge_task_clicked', { task_id: taskId, action_label: actionLabel });
}

export function captureChallengeEntered({ referralCount = 0, basketCount = 0 } = {}) {
  capture('challenge_entered', { referral_count: referralCount, basket_count: basketCount });
}

export function captureReferralLinkCopied(source, referralCount = 0) {
  capture('referral_link_copied', { source, referral_count: referralCount });
}

export function captureFaqItemOpened(question, index) {
  capture('faq_item_opened', { question, faq_index: index });
}

export function captureSignOut() {
  capture('sign_out');
}

export function captureBasketDetailTabViewed(basketId, tab, { isOwn = false } = {}) {
  capture('basket_detail_tab_viewed', { basket_id: basketId, tab, is_own: isOwn });
}

export function captureFollowPanelOpened(basketId, { source = 'mobile_cta' } = {}) {
  capture('follow_panel_opened', { basket_id: basketId, source });
}

export function captureCreateFlowAbandoned({ mode, lastStepId, lastStepIndex, totalSteps }) {
  capture('create_flow_abandoned', {
    mode,
    last_step_id: lastStepId,
    last_step_index: lastStepIndex,
    total_steps: totalSteps,
  });
}

export { posthog, isPostHogEnabled };
