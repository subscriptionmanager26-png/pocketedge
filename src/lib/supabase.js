import {
  clearPostAuthRedirect,
  createSharedAuthStorage,
  setPostAuthRedirect,
} from './authStorage';
import { getSocialOrigin } from './siteUrl';
import { peekCachedAuthSession } from './peekAuthSession';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Set after {@link ensureSupabase} resolves. */
export let supabase = null;

let clientPromise = null;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function hasOAuthCallbackParams() {
  if (typeof window === 'undefined') return false;
  const url = new URL(window.location.href);
  return url.searchParams.has('code') || url.searchParams.has('error');
}

/** True when auth/session work is likely — load the Supabase chunk early. */
export function shouldLoadSupabaseEarly() {
  if (!isSupabaseConfigured()) return false;
  return Boolean(peekCachedAuthSession()?.user) || hasOAuthCallbackParams();
}

/** Lazy-load @supabase/supabase-js and create the shared client. */
export async function ensureSupabase() {
  if (supabase) return supabase;
  if (!isSupabaseConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
      supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          detectSessionInUrl: true,
          persistSession: true,
          flowType: 'pkce',
          storage: createSharedAuthStorage(),
        },
      });
      return supabase;
    });
  }
  return clientPromise;
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
  const client = await ensureSupabase();
  if (!client) throw new Error('Sign-in is not configured yet.');

  const redirectTo = getOAuthRedirectUrl();
  sessionStorage.setItem('post_auth_redirect', redirectTo);
  setPostAuthRedirect(redirectTo);

  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { prompt: 'select_account' },
    },
  });

  if (error) throw error;
}

export async function signOutFromSupabase() {
  const client = supabase ?? (await ensureSupabase());
  if (!client) return;
  await client.auth.signOut();
  sessionStorage.removeItem('post_auth_redirect');
  clearPostAuthRedirect();
}
