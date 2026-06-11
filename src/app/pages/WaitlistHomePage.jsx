import React, { useEffect, useState } from 'react';
import { Copy, Check, Users, Clock, Trophy } from 'lucide-react';
import AppPageLayout from '../components/AppPageLayout';
import ChallengeEntryPanel from '../../components/ChallengeEntryPanel';
import { CHALLENGE_WINDOW } from '../../challengeMeta';
import { getReferralLink } from '../../supabase';
import { navigateApp } from '../appRoute';
import { hasEnteredChallenge } from '../../challengeEligibility';
import ChallengeWelcomeCard from '../components/ChallengeWelcomeCard';

function formatCountdown(ms) {
  if (ms <= 0) return 'Updating ranks…';
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
    const tick = () => setRemaining(new Date(nextUpdateAt).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextUpdateAt]);

  if (!nextUpdateAt) return null;

  return (
    <div className="flex items-center justify-center gap-2 rounded-full border border-neutral-200/80 bg-white px-4 py-2 text-sm text-neutral-600 w-fit mx-auto">
      <Clock className="w-4 h-4 shrink-0" aria-hidden />
      <span>
        Rank update in{' '}
        <span className="font-semibold text-neutral-900 tabular-nums">{formatCountdown(remaining)}</span>
      </span>
    </div>
  );
}

export default function WaitlistHomePage({
  user,
  waitlistStatus,
  challengeProgress,
  challengePersistEntered = true,
}) {
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  if (!waitlistStatus) {
    return (
      <AppPageLayout narrow center className="max-w-3xl">
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-600 text-sm">Loading your waitlist spot…</p>
        </div>
      </AppPageLayout>
    );
  }

  const referralLink = getReferralLink(user.id);
  const spotsMoved = waitlistStatus.referral_count * 10;
  const firstName = user.user_metadata?.full_name?.split(' ')[0];
  const challengeEntered = hasEnteredChallenge();

  const handleCopyReferral = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <AppPageLayout narrow center className="max-w-4xl">
      <header className="text-center space-y-3">
        <h1 className="pe-title text-2xl sm:text-3xl">
          {firstName ? `${firstName}, you're` : "You're"} on the list
        </h1>
        <p className="pe-body max-w-md mx-auto">
          We&apos;ll email <span className="text-neutral-900 font-medium">{user.email}</span> when your
          spot opens. Until then, compete in the challenge below.
        </p>
        <RankUpdateTimer nextUpdateAt={waitlistStatus.next_rank_update_at} />
      </header>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Waitlist */}
        <section
          id="waitlist-status"
          className="pe-card overflow-hidden flex flex-col"
        >
          <div className="bg-neutral-900 text-white px-6 py-8 sm:py-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Your current rank
            </p>
            <p className="font-display text-5xl sm:text-6xl font-semibold tabular-nums mt-2 tracking-tight">
              #{waitlistStatus.effective_rank.toLocaleString()}
            </p>
            {waitlistStatus.effective_rank !== waitlistStatus.waitlist_number && (
              <p className="text-sm text-neutral-400 mt-2">
                Started at #{waitlistStatus.waitlist_number.toLocaleString()}
              </p>
            )}
          </div>

          <div id="waitlist-referral" className="p-5 sm:p-6 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-neutral-700" aria-hidden />
              <h2 className="font-semibold text-sm text-neutral-900">Move up faster</h2>
            </div>
            <p className="text-sm text-neutral-600 leading-relaxed mb-4">
              Each friend who joins with your link moves you up{' '}
              <span className="font-medium text-neutral-900">10 spots</span> at the next rank update.
              {waitlistStatus.referral_count > 0 && (
                <>
                  {' '}
                  <span className="font-medium text-neutral-900">{waitlistStatus.referral_count}</span>{' '}
                  referral{waitlistStatus.referral_count === 1 ? '' : 's'} pending
                  {spotsMoved > 0 && <> · up to {spotsMoved} spots</>}.
                </>
              )}
            </p>

            <div className="mt-auto space-y-2">
              <label className="sr-only" htmlFor="referral-link">
                Referral link
              </label>
              <input
                id="referral-link"
                readOnly
                value={referralLink}
                className="w-full pe-input text-xs py-2.5"
              />
              <button
                type="button"
                onClick={handleCopyReferral}
                className="w-full pe-btn-primary py-3 text-sm justify-center"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" /> Copied link
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy referral link
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Challenge */}
        <section className="pe-card flex flex-col overflow-hidden">
          <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-pe-border/80">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400/15 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-amber-600" aria-hidden />
              </div>
              <div>
                <p className="pe-eyebrow !normal-case !tracking-wide text-neutral-500">Challenge</p>
                <h2 className="text-lg sm:text-xl font-semibold text-neutral-900 leading-tight">
                  Market Whisperer
                </h2>
                <p className="text-sm text-neutral-500 mt-1">{CHALLENGE_WINDOW}</p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6 flex-1">
            {challengeProgress && challengeEntered ? (
              <div className="space-y-4">
                <ChallengeWelcomeCard className="!p-5 sm:!p-6 !shadow-none !border-0 !bg-neutral-50" />
                <button
                  type="button"
                  onClick={() => navigateApp({ tab: 'leaderboard' })}
                  className="w-full pe-btn-primary py-3 text-sm justify-center"
                >
                  Open Challenge
                </button>
              </div>
            ) : challengeProgress ? (
              <ChallengeEntryPanel
                progress={challengeProgress}
                onSignIn={() => {}}
                onGoCreate={() => navigateApp({ tab: 'create' })}
                onEntered={() => navigateApp({ tab: 'leaderboard' })}
                referralLink={referralLink}
                persistEntered={challengePersistEntered}
                hideHeader
                className="!p-0 !shadow-none !border-0 !bg-transparent"
              />
            ) : (
              <p className="text-sm text-neutral-500 text-center py-8">Loading challenge…</p>
            )}
          </div>
        </section>
      </div>
    </AppPageLayout>
  );
}
