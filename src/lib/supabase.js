import { createClient } from '@supabase/supabase-js';
import {
  clearPostAuthRedirect,
  createSharedAuthStorage,
  setPostAuthRedirect,
} from './authStorage';
import { getSocialOrigin } from './siteUrl';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          detectSessionInUrl: true,
          persistSession: true,
          flowType: 'pkce',
          storage: createSharedAuthStorage(),
        },
      })
    : null;

export function isSupabaseConfigured() {
  return Boolean(supabase);
}

/** OAuth callback URL — must not include a hash (PKCE code lands in query). */
function getOAuthRedirectUrl() {
  const url = new URL(window.location.pathname + window.location.search, getSocialOrigin());
  url.hash = '';
  return url.toString();
}

export function cleanOAuthCallbackUrl() {
  const url = new URL(window.location.href);
  const hadOAuthParams =
    url.searchParams.has('code') ||
    url.searchParams.has('error') ||
    url.searchParams.has('error_description');
  if (!hadOAuthParams) return;

  clearPostAuthRedirect();

  url.searchParams.delete('code');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  url.hash = '';
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Sign-in is not configured yet.');

  const redirectTo = getOAuthRedirectUrl();
  sessionStorage.setItem('post_auth_redirect', redirectTo);
  setPostAuthRedirect(redirectTo);

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { prompt: 'select_account' },
    },
  });

  if (error) throw error;
}

export async function signOutFromSupabase() {
  if (!supabase) return;
  await supabase.auth.signOut();
  sessionStorage.removeItem('post_auth_redirect');
  clearPostAuthRedirect();
}
