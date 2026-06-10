import React, { useMemo } from 'react';
import { Trophy, User } from 'lucide-react';
import ChallengeLeaderboardGate from '../../components/ChallengeLeaderboardGate';
import ChallengeEntryPanel from '../../components/ChallengeEntryPanel';
import LeaderboardTable from '../../components/LeaderboardTable';
import PageHeader from '../../components/PageHeader';
import {
  buildLeaderboard,
  catalogBaskets,
} from '../basketCatalog';
import { getChallengeProgress } from '../../challengeEligibility';
import { navigateApp } from '../appRoute';
import AppPageLayout from '../components/AppPageLayout';

const CHALLENGE_DESCRIPTION =
  'Your portfolio curation skill is tested against thousands of others to find if you have what it takes to be a market whisperer.';

export default function LeaderboardPage({
  userBaskets = [],
  user = null,
  waitlistStatus = null,
  publicView = false,
  embedded = false,
  limit,
  onChallengeEnter,
}) {
  const signedIn = !!user;

  const entries = useMemo(
    () => buildLeaderboard([...userBaskets, ...catalogBaskets]),
    [userBaskets]
  );

  const progress = getChallengeProgress({ user, userBaskets, waitlistStatus });

  const top = entries[0];

  const yourBest = useMemo(() => {
    if (!signedIn || userBaskets.length === 0) return null;
    const ownIds = new Set(userBaskets.map((b) => b.id));
    const own = entries.filter((e) => ownIds.has(e.basket.id));
    return own.reduce((best, e) => (!best || e.rank < best.rank ? e : best), null);
  }, [entries, signedIn, userBaskets]);

  const handleBasketClick = (basketId) => {
    if (publicView) return;
    navigateApp({ tab: 'basket', basketId });
  };

  const table = (
    <LeaderboardTable
      entries={entries}
      userBaskets={userBaskets}
      signedIn={signedIn}
      publicView={publicView && !signedIn}
      onBasketClick={publicView && !signedIn ? undefined : handleBasketClick}
      limit={limit}
      hideReturns
    />
  );

  const handleSignIn = onChallengeEnter ?? (() => {});

  const leaderboardBlock = signedIn ? (
    table
  ) : (
    <ChallengeLeaderboardGate onSignIn={handleSignIn}>{table}</ChallengeLeaderboardGate>
  );

  if (embedded) {
    return signedIn ? table : (
      <ChallengeLeaderboardGate onSignIn={handleSignIn}>{table}</ChallengeLeaderboardGate>
    );
  }

  return (
    <AppPageLayout center>
      <PageHeader
        title="The Market Whisperer Challenge"
        align="center"
        className="!mb-0"
        description={
          signedIn
            ? `${CHALLENGE_DESCRIPTION} Ties are broken by lower volatility.`
            : 'Login to see challenge details'
        }
      />

      {signedIn && (
        <ChallengeEntryPanel
          progress={progress}
          onSignIn={handleSignIn}
          onGoCreate={() => {
            if (publicView) window.location.href = '/?tab=create';
            else navigateApp({ tab: 'create' });
          }}
          onGoReferrals={() => {
            window.location.href = '/?waitlist=1';
          }}
        />
      )}

      {signedIn && top && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="pe-card p-5 border-neutral-900/10 bg-neutral-900/[0.03]">
            <div className="flex items-center gap-2 text-pe-text-secondary mb-2">
              <Trophy className="w-4 h-4" />
              <span className="pe-label text-[10px] font-semibold uppercase tracking-wide">Top rank</span>
            </div>
            <p className="pe-card-title">{top.basket.name}</p>
            <p className="pe-body-s text-pe-text-muted mt-2">
              #{top.rank} · {top.volatility} volatility · {top.creatorName}
            </p>
          </div>

          {yourBest ? (
            <div className="pe-card p-5">
              <div className="flex items-center gap-2 text-pe-text-secondary mb-2">
                <User className="w-4 h-4" />
                <span className="pe-label text-[10px] font-semibold uppercase tracking-wide">Your rank</span>
              </div>
              <p className="pe-card-title">{yourBest.basket.name}</p>
              <p className="pe-body-s text-pe-text-muted mt-2">
                #{yourBest.rank} of {entries.length} · {yourBest.volatility} volatility
              </p>
            </div>
          ) : (
            <div className="pe-card border-dashed p-5 flex flex-col justify-center">
              <p className="pe-body font-medium text-pe-text">No baskets on the board yet</p>
              <p className="pe-body-s text-pe-text-muted mt-1">
                Create a basket to compete for the top spot.
              </p>
              {!publicView && (
                <button
                  type="button"
                  onClick={() => navigateApp({ tab: 'create' })}
                  className="mt-3 text-sm font-semibold text-pe-positive hover:underline text-left"
                >
                  Create basket →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {leaderboardBlock}
    </AppPageLayout>
  );
}

export { CHALLENGE_DESCRIPTION };
