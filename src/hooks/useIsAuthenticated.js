import { useEffect, useState } from 'react';
import { peekCachedAuthSession } from '../lib/peekAuthSession';
import { ensureSupabase, isSupabaseConfigured } from '../lib/supabase';

/** True when a Supabase (or dev-skip) session user is available. */
export function useIsAuthenticated() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(peekCachedAuthSession()?.user)
  );

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;

    let cancelled = false;
    let unsubscribe = () => {};

    (async () => {
      try {
        const client = await ensureSupabase();
        if (!client || cancelled) return;

        const { data } = await client.auth.getSession();
        if (!cancelled) setIsAuthenticated(Boolean(data.session?.user));

        const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
          setIsAuthenticated(Boolean(session?.user));
        });
        unsubscribe = () => listener.subscription.unsubscribe();
      } catch {
        /* keep peek-based guess */
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return isAuthenticated;
}
