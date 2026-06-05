import React, { useEffect, useState } from 'react';
import { Briefcase, Copy, Check, Users, Clock } from 'lucide-react';
import {
  supabase,
  enrollWaitlistMember,
  getWaitlistStatus,
  getReferralLink,
  signInWithGoogle,
  signOut,
} from './supabase';

function formatCountdown(ms) {
  if (ms <= 0) return 'Updating ranks...';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function RankUpdateTimer({ nextUpdateAt }) {
  const [remaining, setRemaining] = useState(() =>
    nextUpdateAt ? new Date(nextUpdateAt).getTime() - Date.now() : 0
  );

  useEffect(() => {
    if (!nextUpdateAt) return undefined;

    const tick = () => {
      setRemaining(new Date(nextUpdateAt).getTime() - Date.now());
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextUpdateAt]);

  if (!nextUpdateAt) return null;

  return (
    <div className="relative z-20 bg-emerald-500/10 border-b border-emerald-500/20">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-center gap-2 text-sm">
        <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-zinc-300">
          Rank update in{' '}
          <span className="font-semibold text-emerald-400 tabular-nums">
            {formatCountdown(remaining)}
          </span>
        </span>
      </div>
    </div>
  );
}

export default function WaitlistPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadWaitlist = async (session) => {
      if (!mounted || !session) return;

      setUser(session.user);
      setLoading(true);
      setError('');

      try {
        await enrollWaitlistMember();
        const data = await getWaitlistStatus();
        if (mounted) setStatus(data);
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to join waitlist.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const bootstrap = async () => {
      if (!supabase) {
        setError('Supabase is not configured.');
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (session) {
        await loadWaitlist(session);
      } else {
        setLoading(false);
      }
    };

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        loadWaitlist(session);
      }
      if (event === 'SIGNED_OUT' && mounted) {
        setUser(null);
        setStatus(null);
        setLoading(false);
      }
    });

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
  };

  const handleCopyReferral = async () => {
    if (!user) return;
    const link = getReferralLink(user.id);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy link. Please copy it manually.');
    }
  };

  const referralLink = user ? getReferralLink(user.id) : '';
  const spotsMoved = status
    ? Math.min(status.referral_count * 10, status.waitlist_number - 5001)
    : 0;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/10 blur-[120px] rounded-full" />
      </div>

      {user && status?.next_rank_update_at && (
        <RankUpdateTimer nextUpdateAt={status.next_rank_update_at} />
      )}

      <header className="relative z-10 px-6 py-6 max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-emerald-500 to-emerald-400 p-2 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <Briefcase className="w-5 h-5 text-black" />
          </div>
          <span className="font-semibold text-xl tracking-tighter">
            Pocket<span className="text-emerald-400">Edge</span>
          </span>
        </div>
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

          {!loading && user && status && (
            <div className="bg-[#111111] border border-emerald-500/30 rounded-3xl p-8 shadow-[0_0_40px_rgba(16,185,129,0.15)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-cyan-400" />
              <h1 className="text-2xl font-bold mb-2">You&apos;re on the list!</h1>
              <p className="text-zinc-400 mb-8 font-light">
                Thanks{user.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}. We&apos;re letting people in batches.
              </p>

              <div className="bg-black/50 border border-white/5 rounded-2xl p-6 mb-4 text-center">
                <p className="text-zinc-500 text-sm font-semibold uppercase tracking-widest mb-2">
                  Your Current Rank
                </p>
                <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                  #{status.effective_rank.toLocaleString()}
                </div>
                {status.effective_rank !== status.waitlist_number && (
                  <p className="text-zinc-500 text-xs mt-2">
                    Started at #{status.waitlist_number.toLocaleString()}
                  </p>
                )}
              </div>

              <div className="bg-black/30 border border-white/5 rounded-2xl p-5 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <h2 className="font-semibold text-sm">Refer &amp; move up the waitlist</h2>
                </div>
                <p className="text-zinc-400 text-sm font-light mb-4">
                  Each friend who signs up with your link moves you up{' '}
                  <span className="text-emerald-400 font-medium">10 spots</span> at the next rank update.
                  {status.referral_count > 0 && (
                    <>
                      {' '}You have{' '}
                      <span className="text-white font-medium">{status.referral_count}</span>{' '}
                      referral{status.referral_count === 1 ? '' : 's'} pending
                      {spotsMoved > 0 && (
                        <> (up to {spotsMoved} spots)</>
                      )}.
                    </>
                  )}
                </p>

                <div className="flex gap-2">
                  <input
                    readOnly
                    value={referralLink}
                    className="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-zinc-300 truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyReferral}
                    className="shrink-0 inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" /> Copy
                      </>
                    )}
                  </button>
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

          {!loading && user && !status && error && (
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
