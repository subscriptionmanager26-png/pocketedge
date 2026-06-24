import React from 'react';
import { ArrowLeft } from 'lucide-react';
import MarketWhispererBanner from './components/MarketWhispererBanner';
import ChallengeEntryPanel from './components/ChallengeEntryPanel';
import ChallengeWelcomeCard from './app/components/ChallengeWelcomeCard';
import ChallengeBasketSlots from './app/components/ChallengeBasketSlots';
import DashboardPage from './app/pages/DashboardPage';
import PageHeader from './components/PageHeader';
import AboutYouSection from './app/components/AboutYouSection';
import { getReferralLink } from './supabase';
import { edgeX } from './designTokens';
import {
  getReferralsDemoProgress,
  REFERRALS_DEMO_BASKETS,
  REFERRALS_DEMO_USER,
  REFERRALS_DEMO_STATS,
} from './demo/referralsDemoData';

export default function ReferralsDemoPage() {
  const challengeProgress = getReferralsDemoProgress();
  const referralLink = getReferralLink(REFERRALS_DEMO_USER.id);

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-neutral-900">
      <div className="sticky top-0 z-50 w-full isolate">
        <MarketWhispererBanner />
        <div className={`${edgeX} bg-amber-50 border-b border-amber-200/80 py-2.5`}>
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-amber-950">
              <span className="font-semibold">Demo preview</span> — user with 5 referrals (local only)
            </p>
            <a
              href="/?demo=challenge"
              className="font-medium text-amber-900 hover:text-amber-950"
            >
              Challenge tab demo
            </a>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 font-medium text-amber-900 hover:text-amber-950"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden />
              Back to site
            </a>
          </div>
        </div>
      </div>

      <div className={`${edgeX} py-8 sm:py-10 space-y-12 max-w-6xl mx-auto`}>
        <header className="max-w-2xl">
          <p className="pe-eyebrow">Scenario</p>
          <h1 className="pe-title text-2xl sm:text-3xl mt-1">5 referrals completed</h1>
          <p className="pe-body mt-2">
            Alex referred 5 friends, created a basket, and can now enter The Global Portfolio League.
          </p>
        </header>

        <section className="space-y-4">
          <div>
            <h2 className="pe-section-title">Dashboard</h2>
            <p className="pe-body-s mt-1">Home tab for a user with baskets and referrals.</p>
          </div>
          <div className="rounded-2xl border border-neutral-200/80 bg-white/50 p-3 sm:p-4">
            <DashboardPage userBaskets={REFERRALS_DEMO_BASKETS} />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="pe-section-title">Challenge tab — after entering</h2>
            <p className="pe-body-s mt-1">Welcome message and basket slots replace the leaderboard.</p>
          </div>
          <div className="max-w-3xl mx-auto space-y-5">
            <ChallengeWelcomeCard />
            <ChallengeBasketSlots userBaskets={REFERRALS_DEMO_BASKETS} />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="pe-section-title">Challenge tab — before entering</h2>
            <p className="pe-body-s mt-1">Checklist shown until the user taps Enter the Challenge.</p>
          </div>
          <div className="max-w-lg mx-auto">
            <ChallengeEntryPanel
              progress={challengeProgress}
              onSignIn={() => {}}
              onGoCreate={() => {}}
              referralLink={referralLink}
              persistEntered={false}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="pe-section-title">Account screen</h2>
            <p className="pe-body-s mt-1">Referral count shown on the Account tab.</p>
          </div>
          <div className="max-w-2xl">
            <PageHeader title="Account" align="left" className="!mb-4" />
            <AboutYouSection
              user={REFERRALS_DEMO_USER}
              userId={REFERRALS_DEMO_USER.id}
              referralCount={REFERRALS_DEMO_STATS.referral_count}
            />
          </div>
        </section>

        <section className="pe-card p-5 sm:p-6 max-w-2xl">
          <h2 className="pe-section-title text-base">Summary</h2>
          <dl className="mt-4 grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-neutral-500">Referrals</dt>
              <dd className="font-semibold text-neutral-900 mt-0.5">5 people joined via link</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Baskets created</dt>
              <dd className="font-semibold text-neutral-900 mt-0.5">
                {REFERRALS_DEMO_BASKETS.length} — {REFERRALS_DEMO_BASKETS[0].name}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Challenge status</dt>
              <dd className="font-semibold text-emerald-700 mt-0.5">Eligible to enter</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
