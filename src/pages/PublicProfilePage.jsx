import { useEffect, useState } from 'react';
import Avatar from '../components/Avatar';
import { ensureSupabase, signInWithGoogle } from '../lib/supabase';
import { fetchPublicProfile } from '../lib/socialProfileApi';

export default function PublicProfilePage({ username }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    ensureSupabase()
      .then(() => fetchPublicProfile(username))
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message ?? 'Could not load profile');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  const handleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message ?? 'Sign-in failed');
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-pe-canvas text-sm text-pe-text-secondary">
        Loading profile…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-pe-canvas px-6 text-center">
        <p className="text-lg font-semibold text-pe-text">Profile not found</p>
        <p className="text-sm text-pe-text-secondary">@{username} doesn&apos;t exist on PocketEdge Social.</p>
      </div>
    );
  }

  const displayName = profile.display_name || profile.username;

  return (
    <div className="min-h-dvh bg-pe-canvas">
      <header className="border-b border-pe-border px-4 py-4">
        <p className="text-sm font-semibold text-pe-accent">PocketEdge Social</p>
      </header>

      <main className="mx-auto max-w-lg px-4 py-10">
        <div className="flex flex-col items-center text-center">
          <Avatar
            person={{
              name: displayName,
              avatar: (displayName || '?').charAt(0).toUpperCase(),
              avatarUrl: profile.avatar_url ?? null,
            }}
            size="xl"
          />
          <h1 className="mt-4 text-2xl font-bold text-pe-text">{displayName}</h1>
          <p className="mt-1 text-[15px] text-pe-text-muted">@{profile.username}</p>
        </div>

        <div className="mt-10 rounded-[12px] border border-pe-border bg-pe-surface px-5 py-6 text-center">
          <p className="text-[15px] font-semibold text-pe-text">Sign in to see more</p>
          <p className="mt-2 text-sm leading-6 text-pe-text-secondary">
            Portfolios, posts, followers, and discussions are available to signed-in members.
            Profile name and username are public.
          </p>
          <button
            type="button"
            onClick={handleSignIn}
            disabled={signingIn}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg bg-pe-accent px-4 text-sm font-bold text-white transition hover:bg-pe-accent-pressed disabled:opacity-60"
          >
            {signingIn ? 'Redirecting…' : 'Continue with Google'}
          </button>
          {error ? <p className="mt-3 text-sm text-pe-negative">{error}</p> : null}
        </div>
      </main>
    </div>
  );
}
