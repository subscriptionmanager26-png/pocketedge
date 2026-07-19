import { supabase } from './supabase';

const ONBOARDING_PREFIX = 'pe_social_onboarding';
const ONBOARDING_COOKIE_PREFIX = 'pe_onboarded_';

function sharedCookieDomain() {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  if (host === 'localhost' || host.endsWith('.localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null;
  }
  if (host.endsWith('pocketedge.in')) return '.pocketedge.in';
  return null;
}

function readOnboardingCookie(userId) {
  if (typeof document === 'undefined' || !userId) return false;
  const name = `${ONBOARDING_COOKIE_PREFIX}${userId}`;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) === '1' : false;
}

function writeOnboardingCookie(userId, value) {
  if (typeof document === 'undefined' || !userId) return;
  const name = `${ONBOARDING_COOKIE_PREFIX}${userId}`;
  const domain = sharedCookieDomain();
  let cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${400 * 86400}; SameSite=Lax`;
  if (domain) cookie += `; domain=${domain}`;
  if (window.location.protocol === 'https:') cookie += '; Secure';
  document.cookie = cookie;
}

function deleteOnboardingCookie(userId) {
  if (typeof document === 'undefined' || !userId) return;
  const name = `${ONBOARDING_COOKIE_PREFIX}${userId}`;
  const domain = sharedCookieDomain();
  let cookie = `${name}=; path=/; max-age=0`;
  if (domain) cookie += `; domain=${domain}`;
  document.cookie = cookie;
}

export function skipAuthForDev() {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get('skipAuth') === '1';
}

export function getOnboardingKey(userId) {
  return userId ? `${ONBOARDING_PREFIX}_${userId}` : ONBOARDING_PREFIX;
}

export function isOnboardingComplete(userId) {
  if (skipAuthForDev()) return true;
  if (!userId) return false;
  if (localStorage.getItem(getOnboardingKey(userId)) === '1') return true;
  // Cookie survives subdomain moves (social. → www.).
  if (readOnboardingCookie(userId)) {
    localStorage.setItem(getOnboardingKey(userId), '1');
    return true;
  }
  return false;
}

export function setOnboardingComplete(userId) {
  if (!userId) return;
  localStorage.setItem(getOnboardingKey(userId), '1');
  writeOnboardingCookie(userId, '1');
}

export function clearOnboarding(userId) {
  if (userId) {
    localStorage.removeItem(getOnboardingKey(userId));
    deleteOnboardingCookie(userId);
  }
}

/** Durable server check: published portfolio means onboarding already happened. */
export async function userHasPublishedPortfolio(userId) {
  if (!supabase || !userId) return false;
  try {
    const { data, error } = await supabase.rpc('list_user_portfolios', {
      p_owner_id: userId,
    });
    if (error) return false;
    const rows = Array.isArray(data) ? data : [];
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Sync hint only — may be wrong after a domain move until
 * {@link resolveAuthViewForUserAsync} runs.
 */
export function resolveAuthViewForUser(user) {
  if (skipAuthForDev()) return 'app';
  if (!user) return 'landing';
  if (isOnboardingComplete(user.id)) return 'app';
  return 'onboarding';
}

/** Preferred: local/cookie flag, else portfolio on the server. */
export async function resolveAuthViewForUserAsync(user) {
  if (skipAuthForDev()) return 'app';
  if (!user) return 'landing';
  if (isOnboardingComplete(user.id)) return 'app';

  if (await userHasPublishedPortfolio(user.id)) {
    setOnboardingComplete(user.id);
    return 'app';
  }

  return 'onboarding';
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

/** @deprecated mock session — kept for dev fallback only */
export function clearSession() {
  if (skipAuthForDev()) return;
  clearOnboarding(null);
}
