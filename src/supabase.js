import { createClient } from '@supabase/supabase-js';

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

/** OAuth callback must use query params — hash breaks PKCE code exchange */
export function getWaitlistRedirectUrl() {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('waitlist', '1');
  return url.toString();
}

export function cleanOAuthCallbackUrl() {
  const url = new URL(window.location.href);
  const hadOAuthParams =
    url.searchParams.has('code') ||
    url.searchParams.has('error') ||
    url.searchParams.has('error_description');

  if (!hadOAuthParams) return;

  url.searchParams.delete('code');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  url.searchParams.set('waitlist', '1');
  url.hash = '';
  window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`);
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase is not configured');

  const ref = new URLSearchParams(window.location.search).get('ref');
  if (ref) sessionStorage.setItem('waitlist_ref', ref);

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getWaitlistRedirectUrl(),
      queryParams: { prompt: 'select_account' },
    },
  });

  if (error) throw error;
}

export async function enrollWaitlistMember() {
  if (!supabase) throw new Error('Supabase is not configured');

  const referralCode = sessionStorage.getItem('waitlist_ref');
  const { data, error } = await supabase.rpc('enroll_waitlist_member', {
    p_referral_code: referralCode,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
  sessionStorage.removeItem('waitlist_ref');
}
