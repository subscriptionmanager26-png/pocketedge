import React from 'react';
import { ArrowLeft } from 'lucide-react';
import AppTopBar from './app/components/AppTopBar';
import BottomNav from './app/components/BottomNav';
import LeaderboardPage from './app/pages/LeaderboardPage';
import WaitlistHomePage from './app/pages/WaitlistHomePage';
import ChallengeProgressBanner from './components/ChallengeProgressBanner';
import StickyTopChrome from './components/StickyTopChrome';
import { edgeX } from './designTokens';
import { getChallengeProgress } from './challengeEligibility';
import { REFERRALS_DEMO_USER } from './demo/referralsDemoData';

const STEP2_WAITLIST = {
  waitlist_number: 2847,
  effective_rank: 2847,
  referral_count: 0,
  referred_by: null,
  next_rank_update_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  access_confirmed: false,
};

const step2Progress = getChallengeProgress({
  user: REFERRALS_DEMO_USER,
  userBaskets: [],
  waitlistStatus: STEP2_WAITLIST,
});

export default function Step2DemoPage() {
  return (
    <div className="min-h-screen w-full bg-[#F7F7F5] text-neutral-900 flex flex-col">
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
            <p className="pe-body-s mt-1">Compact checklist — register step hidden.</p>
          </div>
          <div className="rounded-2xl border border-neutral-200/80 bg-white/50 overflow-hidden">
            <StickyTopChrome
              banner={<ChallengeProgressBanner progress={step2Progress} />}
              navigation={<AppTopBar activeTab="dashboard" onNavigate={() => {}} accessLimited />}
            />
            <div className="p-3 sm:p-4">
              <WaitlistHomePage
                user={REFERRALS_DEMO_USER}
                waitlistStatus={STEP2_WAITLIST}
                challengeProgress={step2Progress}
                challengePersistEntered={false}
              />
            </div>
            <BottomNav activeTab="dashboard" onNavigate={() => {}} accessLimited />
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
              navigation={<AppTopBar activeTab="leaderboard" onNavigate={() => {}} accessLimited />}
            />
            <div className="p-3 sm:p-4">
              <LeaderboardPage
                user={REFERRALS_DEMO_USER}
                userBaskets={[]}
                waitlistStatus={STEP2_WAITLIST}
                accessLimited
                challengeEntered={false}
                challengePersistEntered={false}
              />
            </div>
            <BottomNav activeTab="leaderboard" onNavigate={() => {}} accessLimited />
          </div>
        </section>
      </div>
    </div>
  );
}
