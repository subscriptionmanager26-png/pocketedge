import React from 'react';
import { ArrowLeft } from 'lucide-react';
import AppTopBar from './app/components/AppTopBar';
import BottomNav from './app/components/BottomNav';
import LeaderboardPage from './app/pages/LeaderboardPage';
import DashboardPage from './app/pages/DashboardPage';
import ChallengeProgressBanner from './components/ChallengeProgressBanner';
import StickyTopChrome from './components/StickyTopChrome';
import { edgeX } from './designTokens';
import { getChallengeProgress } from './challengeEligibility';
import { REFERRALS_DEMO_USER } from './demo/referralsDemoData';

const STEP2_REFERRAL_STATS = {
  referral_count: 0,
  referred_by: null,
};

const step2Progress = getChallengeProgress({
  user: REFERRALS_DEMO_USER,
  userBaskets: [],
  referralStats: STEP2_REFERRAL_STATS,
});

export default function Step2DemoPage() {
  return (
    <div className="min-h-screen w-full bg-[#F7F7F5] text-pe-text flex flex-col">
      <div className={`${edgeX} bg-sky-50 border-b border-sky-200/80 py-2.5 shrink-0`}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-sky-950">
            <span className="font-semibold">Step 2 preview</span> — signed up, 0 baskets, 0 referrals
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 font-medium text-sky-900 hover:text-sky-950"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden />
            Exit
          </a>
        </div>
      </div>

      <div className={`${edgeX} py-8 sm:py-10 space-y-12 max-w-6xl mx-auto flex-1`}>
        <header className="max-w-2xl">
          <p className="pe-eyebrow">Challenge step 2</p>
          <h1 className="pe-title text-2xl sm:text-3xl mt-1">Just signed up — create your first basket</h1>
          <p className="pe-body mt-2">
            Step 1 (Register) is complete. The user still needs at least one basket and 5 referrals before
            they can enter the challenge.
          </p>
        </header>

        <section className="space-y-4">
          <div>
            <h2 className="pe-section-title">Home tab</h2>
            <p className="pe-body-s mt-1">Empty dashboard for a new user.</p>
          </div>
          <div className="rounded-2xl border border-neutral-200/80 bg-white/50 overflow-hidden">
            <StickyTopChrome
              banner={<ChallengeProgressBanner progress={step2Progress} />}
              navigation={<AppTopBar activeTab="dashboard" onNavigate={() => {}} />}
            />
            <div className="p-3 sm:p-4">
              <DashboardPage userBaskets={[]} />
            </div>
            <BottomNav activeTab="dashboard" onNavigate={() => {}} />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="pe-section-title">Challenge tab</h2>
            <p className="pe-body-s mt-1">Full checklist with step 1 checked.</p>
          </div>
          <div className="rounded-2xl border border-neutral-200/80 bg-white/50 overflow-hidden">
            <StickyTopChrome
              banner={<ChallengeProgressBanner progress={step2Progress} />}
              navigation={<AppTopBar activeTab="leaderboard" onNavigate={() => {}} />}
            />
            <div className="p-3 sm:p-4">
              <LeaderboardPage
                user={REFERRALS_DEMO_USER}
                userBaskets={[]}
                referralStats={STEP2_REFERRAL_STATS}
                challengeEntered={false}
                challengePersistEntered={false}
              />
            </div>
            <BottomNav activeTab="leaderboard" onNavigate={() => {}} />
          </div>
        </section>
      </div>
    </div>
  );
}
