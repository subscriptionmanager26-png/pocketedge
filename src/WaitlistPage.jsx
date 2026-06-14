import React, { useEffect, useState } from 'react';
import { Copy, Check, Users, Clock } from 'lucide-react';
import SiteHeader from './components/SiteHeader';
import { edgeX } from './designTokens';
import {
  supabase,
  enrollWaitlistMember,
  getWaitlistStatus,
  getReferralLink,
  signInWithGoogle,
  signOut,
} from './supabase';
import { posthog, isPostHogEnabled } from './posthog';

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
    <div className="w-full bg-neutral-900/5 border-b border-neutral-200/60">
      <div className={`${edgeX} py-3 flex items-center justify-center gap-2 text-sm`}>
        <Clock className="w-4 h-4 text-neutral-600 shrink-0" />
        <span className="text-neutral-700">
          Rank update in{' '}
          <span className="font-semibold text-neutral-900 tabular-nums">
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
        const hadReferral = Boolean(sessionStorage.getItem('waitlist_ref'));
        const enrollment = await enrollWaitlistMember();
        if (isPostHogEnabled && enrollment?.status === 'joined') {
          posthog.capture('waitlist_joined', { referred_by_code: hadReferral });
        }
        const data = await getWaitlistStatus();
        if (mounted) setStatus(data);
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to join waitlist.');
        if (isPostHogEnabled) posthog.captureException(err);
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
    if (isPostHogEnabled) {
      posthog.capture('sign_in_started');
    }
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
      if (isPostHogEnabled) {
        posthog.capture('referral_link_copied', {
          source: 'waitlist',
          referral_count: status?.referral_count ?? 0,
        });
      }
    } catch {
      setError('Could not copy link. Please copy it manually.');
    }
  };

  const referralLink = user ? getReferralLink(user.id) : '';
  const spotsMoved = status ? status.referral_count * 10 : 0;

  return (
    <div className="pe-page">

      {user && status?.next_rank_update_at && (
        <RankUpdateTimer nextUpdateAt={status.next_rank_update_at} />
      )}

      <SiteHeader logoHref="/" />

      <main className={`flex items-center justify-center ${edgeX} py-12 sm:py-20 min-h-[calc(100vh-4.5rem)]`}>
        <div className="w-full max-w-md">
          {loading && (
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-neutral-600">Setting up your spot...</p>
            </div>
          )}

          {!loading && !user && (
            <div className="pe-card rounded-3xl p-8 text-center">
              <h1 className="text-2xl font-semibold mb-3">Join the waitlist</h1>
              <p className="text-neutral-600 mb-8 font-light">
                Sign in with Google to request your invite and get your waitlist number.
              </p>
              <button
                onClick={handleSignIn}
                className="w-full pe-btn-primary py-4 text-base"
              >
                Continue with Google
              </button>
              {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
            </div>
          )}

          {!loading && user && status && (
            <div className="pe-card rounded-3xl p-8 relative overflow-hidden">
              <h1 className="text-2xl font-semibold mb-2">You&apos;re on the list!</h1>
              <p className="text-neutral-600 mb-8 font-light">
                Thanks{user.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}. We&apos;re letting people in batches.
              </p>

              <div className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-6 mb-4 text-center">
                <p className="text-neutral-500 text-sm font-semibold uppercase tracking-widest mb-2">
                  Your Current Rank
                </p>
                <div className="text-5xl font-semibold text-neutral-900">
                  #{status.effective_rank.toLocaleString()}
                </div>
                {status.effective_rank !== status.waitlist_number && (
                  <p className="text-neutral-500 text-xs mt-2">
                    Started at #{status.waitlist_number.toLocaleString()}
                  </p>
                )}
              </div>

              <div className="bg-neutral-100 border border-neutral-200/80 rounded-2xl p-5 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-neutral-700" />
                  <h2 className="font-semibold text-sm">Refer &amp; move up the waitlist</h2>
                </div>
                <p className="text-neutral-600 text-sm font-light mb-4">
                  Each friend who signs up with your link moves you up{' '}
                  <span className="text-neutral-900 font-medium">10 spots</span> at the next rank update.
                  {status.referral_count > 0 && (
                    <>
                      {' '}You have{' '}
                      <span className="text-neutral-900 font-medium">{status.referral_count}</span>{' '}
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
                    className="flex-1 min-w-0 bg-neutral-50 border border-neutral-200/80 rounded-xl px-3 py-2.5 text-xs text-neutral-700 truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyReferral}
                    className="shrink-0 pe-btn-primary px-4 py-2.5 text-sm"
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

              <p className="text-neutral-500 text-sm text-center font-light">
                {status.access_confirmed
                  ? 'Your waitlist spot is confirmed — you can start using PocketEdge.'
                  : `We'll email you at ${user.email} when it's your turn.`}
              </p>

              {status.access_confirmed && (
                <a
                  href="/?tab=dashboard"
                  className="mt-6 block w-full text-center pe-btn-primary py-3 text-sm"
                >
                  Open PocketEdge
                </a>
              )}

              {import.meta.env.DEV && !status.access_confirmed && (
                <a
                  href="/?app=1&tab=dashboard"
                  className="mt-6 block w-full text-center pe-btn-secondary py-3 text-sm"
                >
                  Open app preview (local only)
                </a>
              )}

              <button
                onClick={handleSignOut}
                className="mt-8 w-full text-neutral-600 hover:text-neutral-900 text-sm transition-colors"
              >
                Sign out
              </button>
            </div>
          )}

          {!loading && user && !status && error && (
            <div className="bg-white border border-rose-500/30 rounded-3xl p-8 text-center">
              <p className="text-rose-400 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-neutral-900 hover:text-neutral-600 text-sm font-medium"
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
