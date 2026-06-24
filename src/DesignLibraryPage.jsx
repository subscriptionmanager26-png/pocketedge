import React, { useState } from 'react';
import LogoMark from './components/LogoMark';
import PageHeader from './components/PageHeader';
import SiteHeader from './components/SiteHeader';
import MarketWhispererBanner from './components/MarketWhispererBanner';
import ChallengeProgressBanner from './components/ChallengeProgressBanner';
import ChallengeEntryPanel from './components/ChallengeEntryPanel';
import BasketCard from './app/components/BasketCard';
import RequestInviteButton from './RequestInviteButton';
import { catalogBaskets, formatCurrency, formatPercent } from './app/basketCatalog';
import { getChallengeProgress } from './challengeEligibility';
import { BRAND_REFERENCE, CANVAS, cssClasses, edgeX, layout, palette, typography } from './designTokens';
import {
  CHALLENGE_NAME,
  CHALLENGE_WINDOW,
  CHALLENGE_PRIZE_HEADLINE,
  CHALLENGE_BASKETS_HINT,
  CHALLENGE_START_LABEL,
} from './challengeMeta';
import ChallengeWelcomeCard from './app/components/ChallengeWelcomeCard';
import ChallengeBasketSlots from './app/components/ChallengeBasketSlots';

const SECTIONS = [
  { id: 'intro', label: 'Overview' },
  { id: 'colors', label: 'Colors' },
  { id: 'type', label: 'Typography' },
  { id: 'layout', label: 'Layout' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'forms', label: 'Forms' },
  { id: 'cards', label: 'Cards' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'banners', label: 'Banners' },
  { id: 'challenge', label: 'Challenge' },
  { id: 'patterns', label: 'UI patterns' },
  { id: 'classes', label: 'CSS classes' },
];

const sampleBasket = catalogBaskets[0];

const progressSamples = {
  none: getChallengeProgress({ user: { id: '1' }, userBaskets: [], referralStats: { referral_count: 0 } }),
  partial: getChallengeProgress({
    user: { id: '1' },
    userBaskets: [sampleBasket],
    referralStats: { referral_count: 2 },
  }),
  ready: getChallengeProgress({
    user: { id: '1' },
    userBaskets: [sampleBasket],
    referralStats: { referral_count: 5 },
  }),
};

export default function DesignLibraryPage() {
  const [activeSection, setActiveSection] = useState('intro');

  const scrollTo = (id) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-neutral-900">
      <SiteHeader logoHref="/">
        <span className="text-sm font-medium text-neutral-500 hidden sm:inline">Design library</span>
        <a href="/" className="text-sm font-semibold text-neutral-900 hover:text-neutral-600">
          ← Back to site
        </a>
      </SiteHeader>

      <div className={`${edgeX} py-6 sm:py-8 lg:py-10`}>
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 lg:gap-12">
          <aside className="lg:w-52 shrink-0">
            <nav className="lg:sticky lg:top-24 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3 px-2">
                Contents
              </p>
              {SECTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollTo(id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeSection === id
                      ? 'bg-neutral-900 text-white font-medium'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </aside>

          <main className="flex-1 min-w-0 space-y-12 sm:space-y-14">
            <Section
              id="intro"
              title="PocketEdge design library"
              lead="Living reference for tokens, components, and patterns. Open at /?design=1"
            >
              <div className="pe-card p-5 sm:p-6 space-y-3">
                <p className="pe-body">
                  Structured after the{' '}
                  <a
                    href={BRAND_REFERENCE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-pe-text underline underline-offset-2"
                  >
                    Cesto brand kit
                  </a>
                  : Manrope for headings, Inter for body, Barlow for labels — adapted to PocketEdge&apos;s
                  warm light canvas.
                </p>
                <p className="pe-body-s">
                  Canvas <Code>{CANVAS}</Code> · Accent <Code>#00C853</Code> (toned from Cesto{' '}
                  <Code>#00ff6a</Code>) · Returns <Code>text-pe-positive</Code> /{' '}
                  <Code>text-pe-negative</Code>
                </p>
                <div className="flex flex-wrap gap-4 pt-2 text-sm">
                  <span><span className="font-display font-semibold">Manrope</span> — display</span>
                  <span><span className="font-sans font-semibold">Inter</span> — body</span>
                  <span><span className="font-label font-semibold uppercase tracking-wide">Barlow</span> — labels</span>
                </div>
              </div>
            </Section>

            <Section id="colors" title="Colors & surfaces">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(palette).map(([key, swatch]) => (
                  <div key={key} className="pe-card overflow-hidden">
                    <div
                      className="h-16 border-b border-neutral-200/80"
                      style={{ backgroundColor: swatch.hex }}
                    />
                    <div className="p-3">
                      <p className="text-sm font-semibold text-neutral-900">{key}</p>
                      <p className="text-xs text-neutral-500 mt-0.5 font-mono">{swatch.hex}</p>
                      <p className="text-xs text-neutral-500 mt-1">{swatch.usage}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="type" title="Typography">
              <div className="space-y-4">
                {typography.map((row) => (
                  <div key={row.name} className="pe-card p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-3">
                      <p className="pe-body-s font-medium">
                        {row.name}
                        {row.cesto && (
                          <span className="text-pe-text-muted font-normal"> · maps to {row.cesto}</span>
                        )}
                      </p>
                      <Code className="text-xs">{row.class}</Code>
                    </div>
                    <p className={row.class}>{row.sample}</p>
                    <p className="pe-body-s text-pe-text-muted mt-2">{row.usage}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="layout" title="Layout & spacing">
              <div className="space-y-3">
                {layout.map((row) => (
                  <div key={row.name} className="pe-card p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                    <p className="text-sm font-semibold text-neutral-900 w-32 shrink-0">{row.name}</p>
                    <Code className="flex-1">{row.value}</Code>
                    <p className="text-sm text-neutral-500 sm:w-48 shrink-0">{row.usage}</p>
                  </div>
                ))}
              </div>
              <Preview label="edgeX padding demo">
                <div className="bg-neutral-900/5 border border-dashed border-neutral-300 rounded-xl overflow-hidden">
                  <div className={`${edgeX} py-6 bg-white/80`}>
                    <p className="text-sm text-neutral-600">Content respects edgeX horizontal padding</p>
                  </div>
                </div>
              </Preview>
            </Section>

            <Section id="buttons" title="Buttons">
              <div className="flex flex-wrap gap-3 items-center">
                <button type="button" className="pe-btn-primary px-6 py-3 text-sm">
                  Primary
                </button>
                <button type="button" className="pe-btn-secondary px-6 py-3 text-sm">
                  Secondary
                </button>
                <button type="button" className="pe-btn-primary px-6 py-3 text-sm opacity-40 cursor-not-allowed" disabled>
                  Disabled
                </button>
              </div>
              <Preview label="RequestInviteButton — dark (landing)">
                <RequestInviteButton size="large" variant="dark" />
              </Preview>
              <Preview label="Sign out / destructive outline">
                <button
                  type="button"
                  className="w-full max-w-xs flex items-center justify-center gap-2 py-3.5 rounded-xl border border-neutral-200/80 text-neutral-600 hover:text-neutral-900 hover:border-neutral-300 transition-colors text-sm"
                >
                  Sign out
                </button>
              </Preview>
            </Section>

            <Section id="forms" title="Forms">
              <div className="max-w-md space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Text input</label>
                  <input type="text" className="pe-input" placeholder="e.g. My growth basket" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Textarea</label>
                  <textarea
                    className="pe-input min-h-[100px] resize-y"
                    placeholder="Describe your investment thesis…"
                  />
                </div>
              </div>
            </Section>

            <Section id="cards" title="Cards">
              <Preview label="Stat card (dashboard)">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl">
                  <div className="pe-card p-4 sm:p-5">
                    <p className="text-sm font-medium text-neutral-600">Portfolio value</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1">{formatCurrency(52770)}</p>
                  </div>
                  <div className="pe-card p-4 sm:p-5">
                    <p className="text-sm font-medium text-neutral-600">Overall return</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1 text-emerald-600">{formatPercent(32.1)}</p>
                  </div>
                </div>
              </Preview>

              <Preview label="Invested basket card — use labeled fields">
                <div className="max-w-sm">
                  <div className="pe-card p-4 sm:p-5">
                    <h3 className="text-base sm:text-lg font-semibold">US Tech Giants</h3>
                    <p className="text-sm text-neutral-500 mt-1">Invested since 12 Nov 2025</p>
                    <dl className="mt-4 grid grid-cols-3 gap-3 pt-3 border-t border-neutral-100">
                      <div>
                        <dt className="text-sm text-neutral-500">Amount invested</dt>
                        <dd className="text-base font-semibold mt-0.5">{formatCurrency(25000)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-neutral-500">Current value</dt>
                        <dd className="text-base font-semibold mt-0.5">{formatCurrency(31125)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-neutral-500">Return</dt>
                        <dd className="text-base font-semibold text-emerald-600 mt-0.5">{formatPercent(24.5)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </Preview>

              <Preview label="BasketCard (app)">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                  <BasketCard basket={sampleBasket} onClick={() => {}} />
                  <BasketCard
                    basket={catalogBaskets[1]}
                    subtitle="Equal weight · +24.5% returns"
                    onClick={() => {}}
                  />
                </div>
              </Preview>

              <Preview label="Empty state">
                <div className="pe-card border-dashed p-5 max-w-md text-left">
                  <p className="text-base text-neutral-700">No investments yet</p>
                  <p className="text-sm text-neutral-500 mt-1 mb-3">Browse baskets and start investing</p>
                  <button type="button" className="text-sm font-semibold text-neutral-900">
                    Get started →
                  </button>
                </div>
              </Preview>

              <Preview label="Info row (account)">
                <div className="pe-card divide-y divide-neutral-100 max-w-md">
                  <InfoRow label="Email" value="you@example.com" />
                  <InfoRow label="Waitlist rank" value="#847" />
                </div>
              </Preview>
            </Section>

            <Section id="navigation" title="Navigation">
              <Preview label="LogoMark">
                <div className="flex flex-wrap items-center gap-8">
                  <LogoMark size="sm" />
                  <LogoMark size="md" />
                  <LogoMark size="lg" />
                </div>
              </Preview>

              <Preview label="PageHeader — left aligned (app)">
                <PageHeader title="Dashboard" align="left" />
              </Preview>

              <Preview label="Horizontal nav chips">
                <div className="flex flex-wrap gap-2">
                  <span className="px-4 py-2 rounded-full text-sm pe-nav-item-active">Dashboard</span>
                  <span className="px-4 py-2 rounded-full text-sm pe-nav-item-inactive">Search</span>
                  <span className="px-4 py-2 rounded-full text-sm pe-nav-item-inactive">Challenge</span>
                </div>
              </Preview>

              <Preview label="Filter pills">
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 rounded-full text-sm pe-pill-active">All</span>
                  <span className="px-3 py-1.5 rounded-full text-sm pe-pill-inactive">Thematic</span>
                  <span className="px-3 py-1.5 rounded-full text-sm pe-pill-inactive">Income</span>
                </div>
              </Preview>

              <Preview label="Tags">
                <div className="flex flex-wrap gap-1">
                  {['AI', 'Infrastructure'].map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200/80"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Preview>
            </Section>

            <Section id="banners" title="Banners">
              <Preview label="Logged out — MarketWhispererBanner">
                <div className="rounded-xl overflow-hidden border border-neutral-200">
                  <MarketWhispererBanner />
                </div>
              </Preview>
              <Preview label="Logged in — steps remaining">
                <div className="rounded-xl overflow-hidden border border-neutral-200">
                  <ChallengeProgressBanner progress={progressSamples.partial} />
                </div>
              </Preview>
              <Preview label="Logged in — all steps complete">
                <div className="rounded-xl overflow-hidden border border-neutral-200">
                  <ChallengeProgressBanner progress={progressSamples.ready} />
                </div>
              </Preview>
              <p className="text-sm text-neutral-500">
                Challenge copy: <Code>{CHALLENGE_NAME}</Code> · <Code>{CHALLENGE_PRIZE_HEADLINE}</Code> ·{' '}
                <Code>{CHALLENGE_START_LABEL}</Code>
              </p>
            </Section>

            <Section id="challenge" title="Challenge UI">
              <Preview label="Challenge welcome + basket slots (entered)">
                <div className="space-y-5 max-w-3xl">
                  <ChallengeWelcomeCard />
                  <ChallengeBasketSlots userBaskets={[]} />
                </div>
              </Preview>
              <Preview label="ChallengeEntryPanel — in progress">
                <ChallengeEntryPanel
                  progress={progressSamples.partial}
                  onSignIn={() => {}}
                  onGoCreate={() => {}}
                  referralLink="https://pocketedge.app/?ref=demo"
                />
              </Preview>
              <Preview label="ChallengeEntryPanel — eligible to enter">
                <ChallengeEntryPanel
                  progress={progressSamples.ready}
                  onSignIn={() => {}}
                  onGoCreate={() => {}}
                  referralLink="https://pocketedge.app/?ref=demo"
                />
              </Preview>
            </Section>

            <Section id="patterns" title="UI patterns">
              <Preview label="Section with divider + description (dashboard)">
                <div className="pt-5 border-t border-neutral-200">
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Invested baskets</h2>
                  <p className="text-sm sm:text-base text-neutral-500 mt-1">
                    Baskets you&apos;ve invested in — amounts and returns at a glance.
                  </p>
                  <div className="mt-3 h-20 rounded-xl bg-neutral-100 border border-dashed border-neutral-200 flex items-center justify-center text-sm text-neutral-400">
                    Card grid goes here
                  </div>
                </div>
              </Preview>

              <Preview label="Avatar block (account)">
                <div className="pe-card p-5 flex items-center gap-4 max-w-md">
                  <div className="w-16 h-16 rounded-2xl bg-neutral-900 flex items-center justify-center text-2xl font-semibold text-white">
                    K
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Display name</h2>
                    <p className="text-sm text-neutral-500">you@example.com</p>
                  </div>
                </div>
              </Preview>
            </Section>

            <Section id="classes" title="CSS class reference">
              <div className="pe-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50">
                      <th className="text-left p-3 font-semibold text-neutral-700">Class</th>
                      <th className="text-left p-3 font-semibold text-neutral-700">Usage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {cssClasses.map((row) => (
                      <tr key={row.class}>
                        <td className="p-3 font-mono text-xs text-neutral-800">{row.class}</td>
                        <td className="p-3 text-neutral-600">{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </main>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, lead, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4 sm:mb-5">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900">{title}</h2>
        {lead && <p className="text-sm sm:text-base text-neutral-500 mt-1.5">{lead}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Preview({ label, children }) {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-600 mb-2">{label}</p>
      {children}
    </div>
  );
}

function Code({ children, className = '' }) {
  return (
    <code
      className={`font-mono text-xs bg-neutral-100 text-neutral-800 px-1.5 py-0.5 rounded ${className}`}
    >
      {children}
    </code>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-neutral-500">{label}</div>
        <div className="text-base text-neutral-900 font-medium truncate">{value}</div>
      </div>
    </div>
  );
}
