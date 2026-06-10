import React, { useEffect, useMemo, useState } from 'react';
import LeaderboardTable from './LeaderboardTable';
import ChallengeLeaderboardGate from './ChallengeLeaderboardGate';
import ChallengeEntryPanel from './ChallengeEntryPanel';
import { buildLeaderboard, catalogBaskets } from '../app/basketCatalog';
import { loadUserBaskets } from '../app/basketStore';
import { getChallengeProgress } from '../challengeEligibility';
import { getWaitlistStatus, signInWithGoogle, supabase } from '../supabase';
export default function ChallengeLeaderboardSection({
  entries: entriesProp,
  onSignIn,
}) {
  const [user, setUser] = useState(null);
  const [userBaskets, setUserBaskets] = useState(() => loadUserBaskets());
  const [waitlistStatus, setWaitlistStatus] = useState(null);

  const entries = useMemo(
    () => entriesProp ?? buildLeaderboard([...loadUserBaskets(), ...catalogBaskets]),
    [entriesProp]
  );

  useEffect(() => {
    if (!supabase) return undefined;

    const refresh = async (session) => {
      setUser(session?.user ?? null);
      setUserBaskets(loadUserBaskets());
      if (session?.user) {
        try {
          const status = await getWaitlistStatus();
          setWaitlistStatus(status);
        } catch {
          setWaitlistStatus(null);
        }
      } else {
        setWaitlistStatus(null);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => refresh(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      refresh(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signedIn = !!user;
  const progress = getChallengeProgress({ user, userBaskets, waitlistStatus });

  const handleSignIn = async () => {
    if (onSignIn) {
      onSignIn();
      return;
    }
    try {
      await signInWithGoogle({ afterAuthPath: '/#challenge' });
    } catch {
      // cancelled or not configured
    }
  };

  const table = (
    <LeaderboardTable
      entries={entries}
      userBaskets={userBaskets}
      signedIn={signedIn}
      publicView={!signedIn}
      hideReturns
    />
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      {signedIn ? (
        <>
          <ChallengeEntryPanel
            progress={progress}
            onSignIn={handleSignIn}
            onGoCreate={() => {
              window.location.href = '/?tab=create';
            }}
            onGoReferrals={() => {
              window.location.href = '/?waitlist=1';
            }}
          />
          {table}
        </>
      ) : (
        <ChallengeLeaderboardGate onSignIn={handleSignIn}>{table}</ChallengeLeaderboardGate>
      )}
    </div>
  );
}
