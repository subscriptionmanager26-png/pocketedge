import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import AppTopBar from './app/components/AppTopBar';
import BottomNav from './app/components/BottomNav';
import LeaderboardPage from './app/pages/LeaderboardPage';
import ChallengeProgressBanner from './components/ChallengeProgressBanner';
import StickyTopChrome from './components/StickyTopChrome';
import { edgeX } from './designTokens';
import {
  getReferralsDemoProgress,
  REFERRALS_DEMO_BASKETS,
  REFERRALS_DEMO_USER,
  REFERRALS_DEMO_STATS,
} from './demo/referralsDemoData';

export default function ChallengeDemoPage() {
  const [entered, setEntered] = useState(true);
  const challengeProgress = getReferralsDemoProgress();

  return (
    <div className="min-h-screen w-full bg-[#F7F7F5] text-pe-text flex flex-col">
      <div className={`${edgeX} bg-amber-50 border-b border-amber-200/80 py-2.5 shrink-0`}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-amber-950">
            <span className="font-semibold">Challenge tab demo</span> — 5 referrals, basket created
            {entered ? ', entered' : ', ready to enter'}
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setEntered((v) => !v)}
              className="font-medium text-amber-900 hover:text-amber-950 underline-offset-2 hover:underline"
            >
              {entered ? 'Show before entering' : 'Show after entering'}
            </button>
            <a
              href="/?demo=referrals"
              className="font-medium text-amber-900 hover:text-amber-950"
            >
              Full demo
            </a>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 font-medium text-amber-900 hover:text-amber-950"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden />
              Exit
            </a>
          </div>
        </div>
      </div>

      <StickyTopChrome
        banner={<ChallengeProgressBanner progress={challengeProgress} />}
        navigation={<AppTopBar activeTab="leaderboard" onNavigate={() => {}} />}
      />

      <main className={`flex-1 w-full overflow-x-hidden ${edgeX} py-4 sm:py-5 pb-24 lg:pb-10`}>
        <LeaderboardPage
          key={entered ? 'entered' : 'ready'}
          user={REFERRALS_DEMO_USER}
          userBaskets={REFERRALS_DEMO_BASKETS}
          referralStats={REFERRALS_DEMO_STATS}
          challengeEntered={entered}
          challengePersistEntered={false}
        />
      </main>

      <BottomNav activeTab="leaderboard" onNavigate={() => {}} />
    </div>
  );
}
