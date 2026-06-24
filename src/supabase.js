import { createClient } from '@supabase/supabase-js';
import { isAppShellRoute, isLocalAppRoute } from './app/appRoute';
import { getSiteOrigin, isSameSiteUrl, toAbsoluteUrl } from './siteUrl';

const REFERRAL_REF_KEY = 'referral_ref';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          detectSessionInUrl: true,
          persistSession: true,
          flowType: 'pkce',
        },
      })
    : null;

export function isLeaderboardRoute() {
  const params = new URLSearchParams(window.location.search);
  return params.get('leaderboard') === '1';
}

export function getLeaderboardUrl() {
  const url = new URL(window.location.pathname || '/', window.location.origin);
  url.searchParams.set('leaderboard', '1');
  return url.pathname + url.search;
}

function getLeaderboardRedirectUrl() {
  const url = new URL('/', getSiteOrigin());
  url.searchParams.set('leaderboard', '1');
  return url.toString();
}

function getHomeRedirectUrl() {
  return new URL('/', getSiteOrigin()).toString();
}

function getCurrentAppRedirectUrl() {
  const url = new URL(window.location.href);
  url.hash = '';
  return url.toString();
}

/** OAuth callback URL — must not include a hash (PKCE code lands in query). */
export function getOAuthRedirectUrl() {
  if (isAppShellRoute()) return getCurrentAppRedirectUrl();
  if (isLeaderboardRoute()) return getLeaderboardRedirectUrl();

  const stored = sessionStorage.getItem('post_auth_redirect');
  if (stored && isSameSiteUrl(stored)) {
    const url = new URL(stored);
    url.hash = '';
    return url.toString();
  }

  return getHomeRedirectUrl();
}

function replaceUrlFromStoredRedirect(stored) {
  if (!isSameSiteUrl(stored)) return false;

  const parsed = new URL(stored, window.location.origin);
  if (parsed.origin !== window.location.origin) return false;

  window.history.replaceState({}, '', `${parsed.pathname}${parsed.search}`);
  return true;
}

export function cleanOAuthCallbackUrl() {
  const url = new URL(window.location.href);
  const hadOAuthParams =
    url.searchParams.has('code') ||
    url.searchParams.has('error') ||
    url.searchParams.has('error_description');

  if (!hadOAuthParams) return;

  const stored = sessionStorage.getItem('post_auth_redirect');
  sessionStorage.removeItem('post_auth_redirect');

  url.searchParams.delete('code');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  url.hash = '';

  if (stored && replaceUrlFromStoredRedirect(stored)) {
    return;
  }

  if (isLeaderboardRoute()) {
    url.search = '';
    url.searchParams.set('leaderboard', '1');
    window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`);
    return;
  }

  window.history.replaceState({}, '', url.pathname);
}

export async function signInWithGoogle({ afterAuthPath } = {}) {
  if (!supabase) throw new Error('Supabase is not configured');

  const ref = new URLSearchParams(window.location.search).get('ref');
  if (ref) sessionStorage.setItem(REFERRAL_REF_KEY, ref);

  if (!sessionStorage.getItem('post_auth_redirect')) {
    if (afterAuthPath) {
      sessionStorage.setItem('post_auth_redirect', toAbsoluteUrl(afterAuthPath));
    } else if (isAppShellRoute()) {
      sessionStorage.setItem('post_auth_redirect', getCurrentAppRedirectUrl());
    } else if (!isLeaderboardRoute()) {
      sessionStorage.setItem('post_auth_redirect', getHomeRedirectUrl());
    }
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getOAuthRedirectUrl(),
      queryParams: { prompt: 'select_account' },
    },
  });

  if (error) throw error;
}

export function captureReferralFromUrl() {
  const ref = new URLSearchParams(window.location.search).get('ref');
  if (ref) sessionStorage.setItem(REFERRAL_REF_KEY, ref);
}

export function getReferralLink(userId) {
  const url = new URL('/', getSiteOrigin());
  url.searchParams.set('ref', userId);
  return url.toString();
}

export async function recordAppSignup() {
  if (!supabase) throw new Error('Supabase is not configured');

  const referralCode = sessionStorage.getItem(REFERRAL_REF_KEY);
  const { data, error } = await supabase.rpc('record_app_signup', {
    p_referral_code: referralCode,
  });

  if (error) throw error;
  if (data?.status === 'joined') {
    sessionStorage.removeItem(REFERRAL_REF_KEY);
  }
  return data;
}

export async function getReferralStats() {
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase.rpc('get_my_referral_stats');
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
  sessionStorage.removeItem(REFERRAL_REF_KEY);
  sessionStorage.removeItem('post_auth_redirect');
}
