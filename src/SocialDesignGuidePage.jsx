import React, { useState } from 'react';
import { BadgeCheck, Eye, Search } from 'lucide-react';
import {
  SOCIAL_ACCENT,
  SOCIAL_CANVAS,
  SOCIAL_COLORS,
  SOCIAL_CSS_VARS,
  SOCIAL_DESIGN_ROOT,
  SOCIAL_DESIGN_URL,
  SOCIAL_LIVE_URL,
} from './socialDesignTokens';
import SocialScenariosSection from './components/socialDesign/SocialScenariosSection';

const SECTIONS = [
  { id: 'intro', label: 'Overview' },
  { id: 'scenarios', label: 'User scenarios' },
  { id: 'colors', label: 'Colors' },
  { id: 'type', label: 'Typography' },
  { id: 'layout', label: 'Layout' },
  { id: 'header', label: 'Page header' },
  { id: 'tabs', label: 'Tabs' },
  { id: 'profile', label: 'Profile' },
  { id: 'components', label: 'Components' },
  { id: 'mobile', label: 'Mobile shell' },
  { id: 'mistakes', label: 'Mistakes' },
  { id: 'rules', label: 'Rules (MD)' },
];

function Code({ children }) {
  return (
    <code className="rounded bg-pe-surface px-1.5 py-0.5 font-mono text-[13px] text-pe-text">{children}</code>
  );
}

function Section({ id, title, lead, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-serif text-2xl font-bold text-pe-text">{title}</h2>
      {lead ? <p className="mt-2 max-w-2xl text-[15px] leading-6 text-pe-text-secondary">{lead}</p> : null}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Swatch({ name, token, hex }) {
  return (
    <div className="overflow-hidden rounded-lg border border-pe-border bg-pe-elevated">
      <div className="h-14" style={{ backgroundColor: hex }} />
      <div className="space-y-0.5 p-3">
        <p className="text-sm font-semibold text-pe-text">{name}</p>
        <p className="font-mono text-xs text-pe-text-muted">{token}</p>
        <p className="font-mono text-xs text-pe-text-muted">{hex}</p>
      </div>
    </div>
  );
}

function DemoTabs({ embedded = false }) {
  const [active, setActive] = useState('posts');
  const tabs = [
    { id: 'posts', label: 'Posts' },
    { id: 'about', label: 'About me' },
    { id: 'portfolios', label: 'Portfolios' },
    { id: 'trades', label: 'Trades' },
  ];
  const btnClass = embedded
    ? 'relative flex h-full shrink-0 items-center pr-4 text-[15px] font-semibold transition first:pl-0'
    : 'relative shrink-0 py-3 pr-4 text-[15px] font-semibold transition first:pl-0';

  return (
    <div
      className={`flex items-center gap-1 overflow-x-auto scrollbar-none ${
        embedded ? 'h-full min-w-0 flex-1' : 'border-b border-pe-border px-4'
      }`}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`${btnClass} ${isActive ? 'text-pe-text' : 'text-pe-text-muted hover:text-pe-text'}`}
          >
            {tab.label}
            {isActive && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-pe-accent" />}
          </button>
        );
      })}
    </div>
  );
}

function DemoPageHeader() {
  return (
    <header className="sticky top-0 z-30 bg-pe-canvas/95 backdrop-blur-md">
      <div className="border-b border-pe-border">
        <div className="flex h-14 items-center px-4 md:h-[72px]">
          <DemoTabs embedded />
        </div>
      </div>
    </header>
  );
}

function DemoProfileHero() {
  return (
    <section className="border-b border-pe-border px-4 py-5">
      <div className="flex gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-pe-accent-wash text-lg font-bold text-pe-accent"
          aria-hidden
        >
          KA
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <h1 className="font-serif text-[22px] font-bold leading-tight text-pe-text md:text-2xl">
                Kushagra Agarwal
              </h1>
              <BadgeCheck className="h-4 w-4 shrink-0 text-pe-link" aria-label="Verified" />
            </div>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1.5 text-[15px] font-semibold text-pe-text-muted transition hover:text-pe-accent"
            >
              <Eye className="h-4 w-4" />
              Public view
            </button>
          </div>
          <p className="mt-0.5 text-[15px] text-pe-text-muted">@kushagra</p>
          <p className="mt-3 font-serif text-[15px] leading-6 text-pe-ink">
            Long-term India + global equities. Sharing portfolios and theses in public.
          </p>
          <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <div>
              <dt className="inline text-pe-text-muted">Followers </dt>
              <dd className="inline font-semibold text-pe-text">1.2K</dd>
            </div>
            <div>
              <dt className="inline text-pe-text-muted">Following </dt>
              <dd className="inline font-semibold text-pe-text">84</dd>
            </div>
            <div>
              <dt className="inline text-pe-text-muted">Assets influenced </dt>
              <dd className="inline font-semibold text-pe-text">₹42L</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

export default function SocialDesignGuidePage() {
  const [activeSection, setActiveSection] = useState('intro');

  const scrollTo = (id) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      className={`${SOCIAL_DESIGN_ROOT} min-h-screen bg-pe-canvas text-pe-text antialiased`}
      style={SOCIAL_CSS_VARS}
    >
      <header className="sticky top-0 z-40 border-b border-pe-border bg-pe-canvas/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 md:h-16">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-pe-accent">PocketEdge Social</p>
            <h1 className="truncate font-serif text-lg font-bold text-pe-text md:text-xl">Design guide</h1>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm">
            <a href={SOCIAL_LIVE_URL} className="font-semibold text-pe-link hover:underline">
              Live app →
            </a>
            <a href="/social-design-guide.md" className="hidden font-semibold text-pe-text-muted hover:text-pe-text sm:inline">
              Download MD
            </a>
            <a href="/?design=1" className="hidden font-semibold text-pe-text-muted hover:text-pe-text md:inline">
              Main app library
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
          <aside className="lg:w-52 lg:shrink-0">
            <nav className="space-y-1 lg:sticky lg:top-24">
              <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-widest text-pe-text-muted">
                Contents
              </p>
              {SECTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollTo(id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    activeSection === id
                      ? 'bg-pe-accent font-semibold text-white'
                      : 'text-pe-text-secondary hover:bg-pe-surface hover:text-pe-text'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 flex-1 space-y-12 md:space-y-14">
            <Section
              id="intro"
              title="social.pocketedge design system"
              lead="Substack-inspired editorial UI for investor social — light canvas, orange accent, reading-first typography."
            >
              <div className="rounded-xl border border-pe-border bg-pe-surface p-5 md:p-6">
                <p className="text-[15px] leading-6 text-pe-text">
                  This guide documents the patterns used to build{' '}
                  <a href={SOCIAL_LIVE_URL} className="font-semibold text-pe-link underline-offset-2 hover:underline">
                    www.pocketedge.in
                  </a>
                  . Tokens live in <Code>social/src/index.css</Code> and <Code>social/tailwind.config.js</Code>.
                  Agents should also read <Code>.cursor/rules/social-design.mdc</Code>.
                </p>
                <ul className="mt-4 list-disc space-y-1 pl-5 text-[15px] text-pe-text-secondary">
                  <li>
                    Canvas <Code>{SOCIAL_CANVAS}</Code> · Accent <Code>{SOCIAL_ACCENT}</Code>
                  </li>
                  <li>Feed column <Code>max-w-feed</Code> (40rem) with <Code>px-4</Code> padding</li>
                  <li>Desktop sidebar 232px · Page header 72px / mobile 56px below shell</li>
                  <li>Inter for UI · Source Serif 4 for posts and profile copy</li>
                </ul>
              </div>
            </Section>

            <SocialScenariosSection />

            <Section id="colors" title="Color tokens" lead="Use pe-* classes everywhere — no ad-hoc hex in components.">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {SOCIAL_COLORS.map((c) => (
                  <Swatch key={c.token} {...c} />
                ))}
              </div>
            </Section>

            <Section id="type" title="Typography">
              <div className="space-y-4 rounded-xl border border-pe-border p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-pe-text-muted">UI — Inter 15px</p>
                  <p className="mt-2 text-[15px] text-pe-text">Navigation, labels, meta, form fields</p>
                </div>
                <div className="border-t border-pe-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-pe-text-muted">
                    Display — Source Serif 4
                  </p>
                  <p className="mt-2 font-serif text-2xl font-bold text-pe-text">Profile and section titles</p>
                </div>
                <div className="border-t border-pe-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-pe-text-muted">Reading body</p>
                  <p className="mt-2 font-serif text-base leading-6 text-pe-ink">
                    Posts and bios use serif at 16px with relaxed line height for comfortable reading in the feed.
                  </p>
                </div>
              </div>
            </Section>

            <Section
              id="layout"
              title="Layout"
              lead="Middle column is the feed. Sidebar and whitespace frame content — never center arbitrary widths."
            >
              <div className="overflow-hidden rounded-xl border border-pe-border">
                <div className="flex">
                  <div className="hidden w-[232px] shrink-0 border-r border-pe-border bg-pe-sidebar p-4 md:block">
                    <div className="mb-6 h-7 w-7 rounded bg-pe-accent" />
                    <div className="space-y-2">
                      {['Home', 'Search', 'Markets', 'Activity'].map((item) => (
                        <div key={item} className="flex min-h-12 items-center gap-3 text-[15px] font-semibold text-pe-text">
                          <span className="h-6 w-6 rounded bg-pe-surface" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-pe-text-muted">max-w-feed</p>
                    <div className="mt-2 max-w-feed rounded-lg border border-dashed border-pe-border-strong bg-pe-surface p-4 text-sm text-pe-text-secondary">
                      Main column content — always <Code>px-4</Code>, max width 40rem.
                    </div>
                  </div>
                  <div className="hidden w-[200px] shrink-0 bg-pe-canvas lg:block" aria-hidden />
                </div>
              </div>
            </Section>

            <Section
              id="header"
              title="Page header band"
              lead="One fixed-height sticky band per screen. Always use PageHeader — 72px desktop, 56px mobile below shell."
            >
              <div className="overflow-hidden rounded-xl border border-pe-border">
                <DemoPageHeader />
                <div className="px-4 py-6 text-sm text-pe-text-muted">Content below header…</div>
              </div>
              <p className="text-[15px] text-pe-text-secondary">
                Search screens use <Code>PageHeaderSearch</Code>. Markets adds a second <Code>PageHeaderRow</Code> for
                the search field below tabs.
              </p>
            </Section>

            <Section id="tabs" title="Underline tabs" lead="Reuse UnderlineTabs — never duplicate tab button markup.">
              <div className="overflow-hidden rounded-xl border border-pe-border">
                <DemoTabs />
              </div>
              <p className="text-[15px] text-pe-text-secondary">
                Active tab: <Code>text-pe-text</Code> + 2px <Code>bg-pe-accent</Code> underline. Use{' '}
                <Code>embedded</Code> inside <Code>PageHeader</Code>.
              </p>
            </Section>

            <Section id="profile" title="Profile patterns" lead="ProfileHero is shared above all profile tabs.">
              <div className="overflow-hidden rounded-xl border border-pe-border">
                <DemoProfileHero />
                <DemoTabs />
              </div>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-pe-text-secondary">
                <li>Public/Private toggle inline with display name</li>
                <li>Portfolio list: name + thesis; Add portfolio as primary action</li>
                <li>Inline portfolio editing — holdings changes auto-log trades</li>
                <li>No privacy toggles on holdings or XIRR</li>
              </ul>
            </Section>

            <Section id="components" title="Components">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-md bg-pe-accent px-4 py-2 text-sm font-bold text-white hover:bg-pe-accent-pressed"
                >
                  Follow
                </button>
                <button
                  type="button"
                  className="rounded-md border border-pe-border-strong bg-pe-canvas px-4 py-2 text-sm font-bold text-pe-text hover:bg-pe-surface"
                >
                  Following
                </button>
                <span className="inline-flex items-center rounded-full bg-pe-accent-wash px-2.5 py-1 text-xs font-semibold text-pe-accent">
                  Trade · BUY RELIANCE
                </span>
                <span className="font-semibold text-pe-link underline decoration-pe-ticker underline-offset-2">
                  AAPL
                </span>
              </div>
              <div className="mt-4 flex h-11 w-full max-w-md items-center gap-2.5 rounded-lg bg-pe-surface px-3.5 md:h-12">
                <Search className="h-4 w-4 shrink-0 text-pe-text-muted" />
                <span className="text-[15px] text-pe-text-muted">Search people, stocks, topics…</span>
              </div>
            </Section>

            <Section id="mobile" title="Mobile shell" lead="56px top bar. Back replaces logo — never duplicate in PageHeader.">
              <div className="mx-auto max-w-sm overflow-hidden rounded-xl border border-pe-border">
                <div className="flex h-14 items-center border-b border-pe-border px-4">
                  <span className="text-[15px] font-semibold text-pe-accent">← Back</span>
                </div>
                <div className="flex h-14 items-center border-b border-pe-border px-4 text-[15px] font-semibold">
                  Post title
                </div>
                <div className="h-24 bg-pe-surface p-4 text-sm text-pe-text-muted">Feed content</div>
              </div>
            </Section>

            <Section id="mistakes" title="Common mistakes">
              <ol className="list-decimal space-y-2 pl-5 text-[15px] text-pe-text-secondary">
                <li>Variable header heights instead of fixed 72px / 56px bands</li>
                <li>Inline tab markup instead of UnderlineTabs</li>
                <li>Mobile back in page content instead of shell left slot</li>
                <li>Mixed px-5 / px-6 in the feed column</li>
                <li>Hardcoded colors instead of pe-* tokens</li>
                <li>Duplicate sticky headers (shell + page)</li>
              </ol>
            </Section>

            <Section id="rules" title="Design rules (Markdown)">
              <div className="rounded-xl border border-pe-border bg-pe-accent-wash p-5">
                <p className="text-[15px] leading-6 text-pe-text">
                  Full rules for humans and agents are maintained in the repo and served as Markdown:
                </p>
                <ul className="mt-3 space-y-2 text-[15px]">
                  <li>
                    <a href="/social-design-guide.md" className="font-semibold text-pe-link hover:underline">
                      /social-design-guide.md
                    </a>{' '}
                    — design tokens & patterns
                  </li>
                  <li>
                    <a href="/social-user-scenarios.md" className="font-semibold text-pe-link hover:underline">
                      /social-user-scenarios.md
                    </a>{' '}
                    — user scenarios matrix
                  </li>
                  <li>
                    <Code>social/DESIGN.md</Code> — design rules
                  </li>
                  <li>
                    <Code>social/USER_SCENARIOS.md</Code> — scenario source
                  </li>
                  <li>
                    <Code>.cursor/rules/social-design.mdc</Code> — Cursor agent rule
                  </li>
                </ul>
                <p className="mt-4 text-sm text-pe-text-muted">
                  Published at{' '}
                  <a href={SOCIAL_DESIGN_URL} className="text-pe-link hover:underline">
                    {SOCIAL_DESIGN_URL}
                  </a>
                </p>
              </div>
            </Section>
          </main>
        </div>
      </div>
    </div>
  );
}
