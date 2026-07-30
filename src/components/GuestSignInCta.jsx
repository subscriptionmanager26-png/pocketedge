import { Link } from 'react-router-dom';
import { signInWithGoogle } from '../lib/supabase';
import { useState } from 'react';

/** Soft gate CTA for guest market detail pages. */
export default function GuestSignInCta({ action = 'join the conversation' }) {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="mx-4 my-6 rounded-xl border border-pe-border bg-pe-surface px-4 py-5 text-center">
      <p className="text-sm text-pe-text-secondary">
        Sign in to {action} on PocketEdge.
      </p>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={loading}
        className="mt-3 rounded-md bg-pe-accent px-4 py-2 text-sm font-bold text-white hover:bg-pe-accent-pressed disabled:opacity-60"
      >
        {loading ? 'Redirecting…' : 'Sign in with Google'}
      </button>
      <p className="mt-2 text-xs text-pe-text-muted">
        Or explore{' '}
        <Link to="/markets" className="font-semibold text-pe-accent hover:underline">
          Markets
        </Link>
        .
      </p>
    </div>
  );
}
