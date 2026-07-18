import { createSharedAuthStorage } from './authStorage';
import { isOnboardingComplete, skipAuthForDev } from './sessionStore';

/**
 * Synchronously read the last Supabase session user from shared storage.
 * Used to paint the app shell before getSession() resolves.
 */
export function peekCachedAuthSession() {
  if (skipAuthForDev()) {
    return {
      user: { id: 'u_me', email: 'demo@pocketedge.in' },
      view: 'app',
    };
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const ref = new URL(supabaseUrl).hostname.split('.')[0];
    const storage = createSharedAuthStorage();
    const raw = storage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const user = parsed?.user ?? parsed?.currentSession?.user ?? null;
    if (!user?.id) return null;

    // Expired access token still lets us optimistic-render; refresh happens async.
    // Only claim "app" when the durable flag is set. Otherwise bootstrap until
    // the server confirms whether this account already has a portfolio.
    const view = isOnboardingComplete(user.id) ? 'app' : 'bootstrapping';
    return { user, view };
  } catch {
    return null;
  }
}
