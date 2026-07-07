import { supabase } from './supabase';

const ONBOARDING_PREFIX = 'pe_social_onboarding';

export function skipAuthForDev() {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get('skipAuth') === '1';
}

export function getOnboardingKey(userId) {
  return userId ? `${ONBOARDING_PREFIX}_${userId}` : ONBOARDING_PREFIX;
}

export function isOnboardingComplete(userId) {
  if (skipAuthForDev()) return true;
  if (!userId) return false;
  return localStorage.getItem(getOnboardingKey(userId)) === '1';
}

export function setOnboardingComplete(userId) {
  if (!userId) return;
  localStorage.setItem(getOnboardingKey(userId), '1');
}

export function clearOnboarding(userId) {
  if (userId) localStorage.removeItem(getOnboardingKey(userId));
}

export async function getAuthUser() {
  if (skipAuthForDev()) {
    return {
      id: 'u_me',
      email: 'demo@pocketedge.in',
    };
  }
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export function resolveAuthViewForUser(user) {
  if (skipAuthForDev()) return 'app';
  if (!user) return 'landing';
  if (!isOnboardingComplete(user.id)) return 'onboarding';
  return 'app';
}

/** @deprecated mock session — kept for dev fallback only */
export function clearSession() {
  if (skipAuthForDev()) return;
  clearOnboarding(null);
}
