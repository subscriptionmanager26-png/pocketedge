import { createClient } from '@supabase/supabase-js';
import { isAppShellRoute, isLocalAppRoute } from './app/appRoute';

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

export function isWaitlistRoute() {
  const params = new URLSearchParams(window.location.search);
  return params.get('waitlist') === '1';
}

export function isLeaderboardRoute() {
  const params = new URLSearchParams(window.location.search);
  return params.get('leaderboard') === '1';
}

export function getLeaderboardUrl() {
  const url = new URL(window.location.origin);
  url.searchParams.set('leaderboard', '1');
  return url.pathname + url.search;
}

function getLeaderboardRedirectUrl() {
  const url = new URL(window.location.origin);
  url.searchParams.set('leaderboard', '1');
  return url.toString();
}

/** OAuth callback must use query params — hash breaks PKCE code exchange */
export function getWaitlistRedirectUrl() {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('waitlist', '1');
  return url.toString();
}

function getHomeRedirectUrl() {
  return new URL(window.location.origin).toString();
}

/** OAuth callback URL — must not include a hash (PKCE code lands in query). */
export function getOAuthRedirectUrl() {
  if (isAppShellRoute()) {
    const url = new URL(window.location.href);
    url.hash = '';
    return url.toString();
  }
  if (isLeaderboardRoute()) return getLeaderboardRedirectUrl();
  if (isWaitlistRoute()) return getWaitlistRedirectUrl();

  const stored = sessionStorage.getItem('post_auth_redirect');
  if (stored) {
    const url = new URL(stored);
    url.hash = '';
    return url.toString();
  }

  return getHomeRedirectUrl();
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

  if (stored) {
    window.history.replaceState({}, '', stored);
    return;
  }

  if (isLeaderboardRoute()) {
    url.search = '';
    url.searchParams.set('leaderboard', '1');
    window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`);
    return;
  }

  if (isWaitlistRoute()) {
    url.search = '';
    url.searchParams.set('waitlist', '1');
    window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`);
    return;
  }

  window.history.replaceState({}, '', url.pathname);
}

export async function signInWithGoogle({ afterAuthPath } = {}) {
  if (!supabase) throw new Error('Supabase is not configured');

  const ref = new URLSearchParams(window.location.search).get('ref');
  if (ref) sessionStorage.setItem('waitlist_ref', ref);

  if (!sessionStorage.getItem('post_auth_redirect')) {
    if (afterAuthPath) {
      sessionStorage.setItem(
        'post_auth_redirect',
        new URL(afterAuthPath, window.location.origin).toString()
      );
    } else if (isAppShellRoute()) {
      const url = new URL(window.location.href);
      url.hash = '';
      sessionStorage.setItem('post_auth_redirect', url.toString());
    } else if (!isWaitlistRoute() && !isLeaderboardRoute()) {
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
  if (ref) sessionStorage.setItem('waitlist_ref', ref);
}

export function getReferralLink(userId) {
  const url = new URL(window.location.origin);
  url.searchParams.set('ref', userId);
  return url.toString();
}

export async function enrollWaitlistMember() {
  if (!supabase) throw new Error('Supabase is not configured');

  const referralCode = sessionStorage.getItem('waitlist_ref');
  const { data, error } = await supabase.rpc('enroll_waitlist_member', {
    p_referral_code: referralCode,
  });

  if (error) throw error;
  if (data?.status === 'joined') {
    sessionStorage.removeItem('waitlist_ref');
  }
  return data;
}

export async function getWaitlistStatus() {
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase.rpc('get_my_waitlist_status');
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
  sessionStorage.removeItem('waitlist_ref');
}
