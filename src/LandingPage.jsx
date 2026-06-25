import React, { Suspense, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import BasketMarquee from './components/BasketMarquee';
import ChallengeLeaderboardSection from './components/ChallengeLeaderboardSection';
import LogoMark from './components/LogoMark';
import SiteHeader from './components/SiteHeader';
import {
  homepageBenefits,
  homepageFaq,
  countries,
  footerLegalLinks,
  footerDisclaimer,
} from './mockData';
import { getLegalUrl } from './legalRoute';
import { CHALLENGE_DESCRIPTION } from './app/pages/LeaderboardPage';
import { CHALLENGE_NAME } from './challengeMeta';
import { CAMPAIGN_UI_ENABLED } from './campaignFlags';
import { catalogBaskets } from './app/basketCatalog';
import RequestInviteButton from './RequestInviteButton';
import PrimaryCta from './components/PrimaryCta';
import { edgeX, content } from './designTokens';
import { signInWithGoogle } from './supabase';
import { captureAuthFailed, captureAuthStarted, captureFaqItemOpened } from './analytics';

const RedesignLandingHero = React.lazy(() => import('./redesign/RedesignLandingHero'));

export function LandingSiteHeader() {
  const scrollToInvite = () => {
    document.getElementById('hero-invite')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleNavInvite = async () => {
    captureAuthStarted('landing_nav');
    try {
      await signInWithGoogle();
    } catch (err) {
      captureAuthFailed({ source: 'landing_nav', error: err?.message });
      scrollToInvite();
    }
  };

  return (
    <SiteHeader logoHref="/" embedded sticky={false}>
      <nav className="hidden md:flex items-center gap-8">
        <a href="#baskets" className="text-base text-pe-text-secondary hover:text-pe-text transition-colors">
          Baskets
        </a>
        {CAMPAIGN_UI_ENABLED && (
          <a href="#challenge" className="text-base text-pe-text-secondary hover:text-pe-text transition-colors">
            Challenge
          </a>
        )}
        <a href="#faq" className="text-base text-pe-text-secondary hover:text-pe-text transition-colors">
          FAQ
        </a>
        <PrimaryCta type="button" onClick={handleNavInvite} size="md">
          Get Started
        </PrimaryCta>
      </nav>
      <PrimaryCta type="button" onClick={handleNavInvite} size="sm" className="md:hidden shrink-0">
        Get Started
      </PrimaryCta>
    </SiteHeader>
  );
}

export default function LandingPage({ marketplaceBaskets = [] }) {
  const [openFaq, setOpenFaq] = useState(null);
  const marqueeBaskets = marketplaceBaskets.length ? marketplaceBaskets : catalogBaskets;

  const handleNavInvite = async () => {
    captureAuthStarted('landing_nav');
    try {
      await signInWithGoogle();
    } catch (err) {
      captureAuthFailed({ source: 'landing_nav', error: err?.message });
      document.getElementById('hero-invite')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="min-h-screen bg-pe-canvas text-pe-text">
      <Suspense
        fallback={
          <div className="min-h-[calc(100dvh-7rem)] bg-black flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-gray-700 border-t-white rounded-full animate-spin" />
          </div>
        }
      >
        <RedesignLandingHero />
      </Suspense>

      {/* Horizontal basket rail — core Cesto pattern */}
      <section id="baskets" className="pb-16 sm:pb-24 pt-16 border-t border-[#1A1A1A]">
        <div className={`${edgeX} mb-6 text-center`}>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-pe-text tracking-[-1px]">
            Popular baskets
          </h2>
        </div>

        <BasketMarquee baskets={marqueeBaskets} />
      </section>

      {/* Global Portfolio League + leaderboard */}
      {CAMPAIGN_UI_ENABLED && (
      <section id="challenge" className="py-20 sm:py-28 border-t border-neutral-200/60 bg-white scroll-mt-28 sm:scroll-mt-32">
        <div className={content}>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="pe-display text-[clamp(1.875rem,6vw,3.5rem)] leading-[1.1] text-balance">
              {CHALLENGE_NAME}
            </h2>
            <p className="text-lg sm:text-xl text-pe-text-secondary mt-4 leading-relaxed">
              {CHALLENGE_DESCRIPTION}
            </p>
          </div>

          <div className="mt-10 sm:mt-12">
            <ChallengeLeaderboardSection
              marketplaceBaskets={marketplaceBaskets}
              onSignIn={handleNavInvite}
            />
          </div>
        </div>
      </section>
      )}

      {/* Benefits */}
      <section className="py-20 sm:py-28 border-t border-neutral-200/60 bg-white">
        <div className={content}>
          <h2 className="pe-display max-w-3xl mx-auto text-[clamp(1.875rem,6vw,3.5rem)] font-normal tracking-tight leading-[1.1] text-balance text-center">
            Read Thesis, Build Conviction, Start Investing
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 mt-14 sm:mt-20">
            {homepageBenefits.map((item) => (
              <div key={item.title} className="text-center">
                <h3 className="text-lg sm:text-xl font-semibold text-pe-text">{item.title}</h3>
                <p className="text-base text-pe-text-secondary mt-2 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Markets marquee — full bleed, flags + country names */}
      <section id="countries" className="py-10 border-y border-neutral-200/60 overflow-hidden bg-[#F7F7F5]">
        <p className="text-center text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-pe-text-muted mb-6">
          Global markets access
        </p>
        <div className="flex w-max animate-marquee">
          {[...countries, ...countries].map((country, i) => (
            <span
              key={`${country.name}-${i}`}
              className="inline-flex items-center gap-3 mx-8 text-base sm:text-lg font-medium text-pe-text-secondary whitespace-nowrap"
            >
              <span className="text-2xl sm:text-3xl leading-none" aria-hidden>
                {country.flag}
              </span>
              {country.name}
            </span>
          ))}
        </div>
      </section>

      {/* Coming soon */}
      <section className={`py-20 sm:py-28 ${edgeX} bg-neutral-900 text-pe-text`}>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-pe-text-secondary">Coming soon</p>
          <div className="mt-10 sm:mt-12 grid sm:grid-cols-2 gap-6 sm:gap-8">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-800/40 p-6 sm:p-8 text-center">
              <h3 className="text-xl sm:text-2xl font-medium tracking-tight text-pe-text">Global research</h3>
              <p className="text-pe-text-muted mt-3 text-base sm:text-lg leading-relaxed">
                Macro insights, market context, and deeper analysis across global equities.
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-800/40 p-6 sm:p-8 text-center">
              <h3 className="text-xl sm:text-2xl font-medium tracking-tight text-pe-text">Broker Integration</h3>
              <p className="text-pe-text-muted mt-3 text-base sm:text-lg leading-relaxed">
                Execute basket trades directly through your broker — no manual stock-by-stock orders.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className={`py-20 sm:py-28 ${edgeX} bg-white`}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-normal tracking-tight text-center mb-12 leading-[1.05] text-pe-text">
            Frequently asked questions
          </h2>
          <ul className="divide-y divide-neutral-200">
            {homepageFaq.map((item, index) => {
              const open = openFaq === index;
              return (
                <li key={item.q}>
                  <button
                    type="button"
                    onClick={() => {
                      const next = open ? null : index;
                      if (next !== null) captureFaqItemOpened(item.q, index);
                      setOpenFaq(next);
                    }}
                    className="w-full flex items-center justify-between gap-4 py-5 text-left"
                  >
                    <span className="text-lg font-medium text-pe-text">{item.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-pe-text-muted shrink-0 transition-transform ${
                        open ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {open && (
                    <p className="pb-5 text-base text-pe-text-secondary leading-relaxed -mt-1">{item.a}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Final CTA */}
      <section className={`py-20 sm:py-28 ${edgeX} bg-[#F7F7F5] border-t border-neutral-200/60`}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-normal tracking-tight leading-[1.05] text-pe-text">
            Ready to put your money where your conviction is?
          </h2>
          <p className="text-pe-text-secondary mt-5 text-lg sm:text-xl">
            Start exploring global basket investing on PocketEdge.
          </p>
          <RequestInviteButton
            id="bottom-invite"
            size="large"
            variant="redesign"
            source="landing_footer"
            className="flex justify-center mt-8"
          />
        </div>
      </section>

      <footer id="about" className="border-t border-neutral-200 bg-white py-12">
        <div className={content}>
          <div className="grid sm:grid-cols-2 gap-8 mb-10">
            <div>
              <LogoMark size="sm" className="mb-4" />
              <p className="text-sm text-pe-text-secondary leading-relaxed max-w-sm">
                A product of SRK One9 Finance Services LLP — global basket investing for Indian
                investors.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-pe-text mb-4 text-sm">Legal</h4>
              <ul className="space-y-2.5 text-sm">
                {footerLegalLinks.map((link) => (
                  <li key={link.slug}>
                    <a
                      href={getLegalUrl(link.slug)}
                      className="text-pe-text-secondary hover:text-pe-text transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-neutral-200 pt-6 pb-8">
            <p className="text-xs text-pe-text-muted font-medium uppercase tracking-wider mb-3">Legal</p>
            <nav className="flex flex-wrap items-center gap-y-2 text-sm" aria-label="Legal">
              {footerLegalLinks.map((link, index) => (
                <React.Fragment key={link.slug}>
                  {index > 0 && <span className="text-pe-text-muted mx-2" aria-hidden>|</span>}
                  <a
                    href={getLegalUrl(link.slug)}
                    className="text-pe-text-secondary hover:text-pe-text transition-colors"
                  >
                    {link.label}
                  </a>
                </React.Fragment>
              ))}
            </nav>
          </div>

          <div className="border-t border-neutral-200 pt-8 space-y-4">
            <p className="text-xs text-pe-text-secondary leading-relaxed">
              <span className="font-medium text-pe-text-secondary">Disclaimer: </span>
              {footerDisclaimer[0]}
            </p>
            <p className="text-xs text-pe-text-secondary leading-relaxed">{footerDisclaimer[1]}</p>
            <p className="text-xs text-pe-text-secondary leading-relaxed">
              For disclosures related to SRK One9 Finance Services LLP, visit the{' '}
              <a
                href={getLegalUrl('disclosures')}
                className="underline underline-offset-2 hover:text-pe-text"
              >
                Disclosures
              </a>{' '}
              page.
            </p>
          </div>

          <div className="border-t border-neutral-200 mt-8 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm text-pe-text-secondary">
              © 2026 SRK One9 Finance Services LLP. PocketEdge.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
