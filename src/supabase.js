import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          detectSessionInUrl: true,
          persistSession: true,
        },
      })
    : null;

export function getWaitlistRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}#waitlist`;
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
