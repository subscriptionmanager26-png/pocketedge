import React, { useEffect, useState } from 'react';
import { Briefcase, ArrowLeft } from 'lucide-react';
import { supabase, enrollWaitlistMember, signInWithGoogle, signOut } from './supabase';

export default function WaitlistPage({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [waitlistNumber, setWaitlistNumber] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!supabase) {
        setError('Supabase is not configured.');
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setLoading(false);
        return;
      }

      if (!mounted) return;
      setUser(session.user);

      try {
        const result = await enrollWaitlistMember();
        if (mounted) setWaitlistNumber(result?.waitlist_number ?? null);
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to join waitlist.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    const { data: { subscription } } = supabase?.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        load();
      } else {
        setUser(null);
        setWaitlistNumber(null);
      }
    }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async () => {
    setError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || 'Could not start Google sign-in.');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onBack?.();
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/10 blur-[120px] rounded-full" />
      </div>

      <header className="relative z-10 px-6 py-6 max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-emerald-500 to-emerald-400 p-2 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <Briefcase className="w-5 h-5 text-black" />
          </div>
          <span className="font-semibold text-xl tracking-tighter">
            Pocket<span className="text-emerald-400">Edge</span>
          </span>
        </div>
        <button
          onClick={onBack}
          className="text-sm font-medium text-zinc-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </header>

      <main className="relative z-10 flex items-center justify-center px-6 py-20 min-h-[calc(100vh-5rem)]">
        <div className="w-full max-w-md">
          {loading && (
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-zinc-400">Setting up your spot...</p>
            </div>
          )}

          {!loading && !user && (
            <div className="bg-[#111111] border border-white/10 rounded-3xl p-8 text-center">
              <h1 className="text-2xl font-bold mb-3">Join the waitlist</h1>
              <p className="text-zinc-400 mb-8 font-light">
                Sign in with Google to request your invite and get your waitlist number.
              </p>
              <button
                onClick={handleSignIn}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-4 rounded-xl transition-colors"
              >
                Continue with Google
              </button>
              {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
            </div>
          )}

          {!loading && user && waitlistNumber && (
            <div className="bg-[#111111] border border-emerald-500/30 rounded-3xl p-8 shadow-[0_0_40px_rgba(16,185,129,0.15)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-cyan-400" />
              <h1 className="text-2xl font-bold mb-2">You&apos;re on the list!</h1>
              <p className="text-zinc-400 mb-8 font-light">
                Thanks{user.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}. We&apos;re letting people in batches.
              </p>

              <div className="bg-black/50 border border-white/5 rounded-2xl p-6 mb-6 text-center">
                <p className="text-zinc-500 text-sm font-semibold uppercase tracking-widest mb-2">
                  Your Waitlist Number
                </p>
                <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                  #{waitlistNumber.toLocaleString()}
                </div>
              </div>

              <p className="text-zinc-500 text-sm text-center font-light">
                We&apos;ll email you at {user.email} when it&apos;s your turn.
              </p>

              <button
                onClick={handleSignOut}
                className="mt-8 w-full text-zinc-400 hover:text-white text-sm transition-colors"
              >
                Sign out
              </button>
            </div>
          )}

          {!loading && user && !waitlistNumber && error && (
            <div className="bg-[#111111] border border-rose-500/30 rounded-3xl p-8 text-center">
              <p className="text-rose-400 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-emerald-400 hover:text-emerald-300 text-sm"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
