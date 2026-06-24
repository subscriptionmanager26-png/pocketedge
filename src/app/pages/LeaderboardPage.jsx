import React, { useEffect, useState } from 'react';
import ChallengeLeaderboardGate from '../../components/ChallengeLeaderboardGate';
import ChallengeEntryPanel from '../../components/ChallengeEntryPanel';
import LeaderboardTable from '../../components/LeaderboardTable';
import ChallengeWelcomeCard from '../components/ChallengeWelcomeCard';
import ChallengeBasketSlots from '../components/ChallengeBasketSlots';
import PageHeader from '../../components/PageHeader';
import { buildLeaderboard, catalogBaskets } from '../basketCatalog';
import { getChallengeProgress, hasEnteredChallenge } from '../../challengeEligibility';
import { CHALLENGE_NAME } from '../../challengeMeta';
import { navigateApp } from '../appRoute';
import { getReferralLink } from '../../supabase';
import AppPageLayout from '../components/AppPageLayout';

const CHALLENGE_DESCRIPTION =
  'Your portfolio curation skill is tested against thousands of others in The Global Portfolio League.';

export default function LeaderboardPage({
  userBaskets = [],
  user = null,
  referralStats = null,
  publicView = false,
  embedded = false,
  limit,
  challengeEntered = null,
  challengePersistEntered = true,
  onChallengeEnter,
}) {
  const signedIn = !!user;
  const [entered, setEntered] = useState(() =>
    challengeEntered ?? hasEnteredChallenge()
  );

  useEffect(() => {
    if (challengeEntered !== null) {
      setEntered(challengeEntered);
    }
  }, [challengeEntered]);

  const entries = buildLeaderboard([...userBaskets, ...catalogBaskets]);
  const progress = getChallengeProgress({ user, userBaskets, referralStats });

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

  const handleEntered = () => {
    setEntered(true);
    navigateApp({ tab: 'leaderboard' });
  };

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
        title={CHALLENGE_NAME}
        align="center"
        className="!mb-0"
        description={
          signedIn
            ? `${CHALLENGE_DESCRIPTION} Ties are broken by lower volatility.`
            : 'Login to see challenge details'
        }
      />

      {signedIn && entered && (
        <>
          <ChallengeWelcomeCard />
          <ChallengeBasketSlots userBaskets={userBaskets} />
        </>
      )}

      {signedIn && !entered && (
        <ChallengeEntryPanel
          progress={progress}
          onSignIn={handleSignIn}
          onGoCreate={() => {
            if (publicView) window.location.href = '/?tab=create';
            else navigateApp({ tab: 'create' });
          }}
          referralLink={user ? getReferralLink(user.id) : null}
          initialEntered={false}
          persistEntered={challengePersistEntered}
          onEntered={handleEntered}
        />
      )}

      {!signedIn && leaderboardBlock}
    </AppPageLayout>
  );
}

export { CHALLENGE_DESCRIPTION };
