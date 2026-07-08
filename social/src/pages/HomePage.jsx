import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import AuthLayoutHeader from '../components/AuthLayoutHeader';
import { signInWithGoogle } from '../lib/supabase';
import { useLandingViewport } from './useLandingViewport';

const ASSETS = '/landing/assets';

const FEATURES = [
  {
    title: 'Real insights',
    body: 'from investors with skin in the game',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-pe-accent" aria-hidden="true">
        <path
          d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M9 12l2 2 4-4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: 'Trusted community',
    body: 'reviews, discussions & real portfolios',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-pe-accent" aria-hidden="true">
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="17" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M16 14c2.5 0 4.5 1.8 4.5 4.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: 'See what works',
    body: 'track top rated funds & picks',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-pe-accent" aria-hidden="true">
        <path
          d="M4 16l5-5 3 3 6-6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 8h4v4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

function Headline({ className = '' }) {
  return (
    <h1
      className={`pe-landing-headline font-sans font-bold leading-[1.08] tracking-tight text-pe-text ${className}`}
    >
      <span className="block text-[2rem] md:text-5xl lg:text-[3.25rem]">Before you invest..</span>
      <span className="mt-1 block text-[2rem] text-pe-accent md:text-5xl lg:text-[3.25rem]">
        See what real investors own and say
      </span>
      <svg className="mt-2 h-2.5 w-28 md:w-32" viewBox="0 0 160 12" fill="none" aria-hidden="true">
        <path
          d="M2 8C40 3 120 3 158 6"
          stroke="var(--pe-accent)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </h1>
  );
}

function FeatureList({ row = false, mobile = false }) {
  if (mobile) {
    return (
      <ul className="m-0 flex flex-col gap-2.5 p-0">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pe-accent-wash">
              <span className="scale-90">{feature.icon}</span>
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-sm font-semibold text-pe-text">{feature.title}</p>
              <p className="text-xs text-pe-text-secondary">{feature.body}</p>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className={`m-0 list-none p-0 ${row ? 'mt-8 flex flex-col gap-5' : 'flex flex-col gap-6'}`}>
      {FEATURES.map((feature) => (
        <li
          key={feature.title}
          className={row ? 'flex items-start gap-3.5' : 'flex flex-col gap-2'}
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-pe-accent-wash">
            {feature.icon}
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-pe-text">{feature.title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-pe-text-secondary">{feature.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function MobileVisuals() {
  return (
    <div className="relative mt-8 h-[28rem] w-full">
      <img
        src={`${ASSETS}/feed-card.png`}
        alt=""
        aria-hidden="true"
        className="absolute left-0 top-4 h-[20rem] w-auto object-contain object-left-top drop-shadow-sm"
      />
      <img
        src={`${ASSETS}/iphone-fund-reviews.png`}
        alt="PocketEdge app showing HDFC Flexi Cap Fund reviews on iPhone"
        className="absolute bottom-0 right-0 h-[28rem] w-auto object-contain object-bottom-right drop-shadow-[0_16px_32px_rgba(0,0,0,0.2)]"
      />
    </div>
  );
}

function CtaBlock({ compact = false, loading, error, onGetStarted }) {
  return (
    <div className={compact ? '' : 'text-center lg:text-left'}>
      <button
        type="button"
        onClick={onGetStarted}
        disabled={loading}
        className={`inline-flex items-center justify-center gap-2 rounded-md bg-pe-accent font-bold text-white transition hover:bg-pe-accent-pressed disabled:opacity-60 ${
          compact
            ? 'w-full py-3 text-[15px]'
            : 'w-full py-3 text-[15px] lg:w-auto lg:px-8'
        }`}
      >
        <span>{loading ? 'Redirecting to Google…' : 'Get Started'}</span>
        {!loading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
      </button>
      {error ? <p className="mt-2 text-sm text-pe-negative">{error}</p> : null}
    </div>
  );
}

export default function HomePage() {
  const landingRef = useRef(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useLandingViewport(landingRef);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const handleGetStarted = async () => {
    try {
      setLoading(true);
      setError('');
      closeDrawer();
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || 'Could not start Google sign-in.');
      setLoading(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeDrawer]);

  useEffect(() => {
    document.body.classList.toggle('overflow-hidden', drawerOpen);
    return () => document.body.classList.remove('overflow-hidden');
  }, [drawerOpen]);

  return (
    <div
      ref={landingRef}
      className={`pe-landing flex min-h-dvh flex-col bg-pe-canvas text-pe-text${
        drawerOpen ? ' overflow-hidden' : ''
      }`}
    >
      <AuthLayoutHeader
        showMarketingNav
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen((open) => !open)}
        onCloseDrawer={closeDrawer}
        onGetStarted={handleGetStarted}
        loading={loading}
      />

      {/* Mobile */}
      <div className="pe-landing-mobile flex min-h-0 flex-1 flex-col lg:hidden">
        <div className="pe-landing-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto max-w-feed px-4 pb-4 pt-5">
            <Headline />
            <div className="mt-4">
              <FeatureList mobile />
            </div>
            <MobileVisuals />
          </div>
        </div>

        <footer className="pe-landing-cta-dock shrink-0 border-t border-pe-border bg-pe-canvas px-4 pt-3">
          <div className="mx-auto max-w-feed">
            <CtaBlock compact loading={loading} error={error} onGetStarted={handleGetStarted} />
          </div>
        </footer>
      </div>

      {/* Desktop */}
      <div className="hidden flex-1 lg:block">
        <div className="mx-auto grid h-full max-w-6xl grid-cols-2 items-center gap-10 px-8 py-10 xl:gap-16">
          <div className="min-w-0">
            <Headline />
            <FeatureList row />
            <div className="mt-10">
              <CtaBlock loading={loading} error={error} onGetStarted={handleGetStarted} />
            </div>
          </div>

          <div className="relative h-[min(78vh,720px)] min-h-[480px]">
            <img
              src={`${ASSETS}/feed-card.png`}
              alt="PocketEdge social feed showing investor portfolio updates"
              className="absolute left-0 top-0 h-full max-w-[58%] object-contain object-left-top drop-shadow-sm"
            />
            <img
              src={`${ASSETS}/iphone-fund-reviews.png`}
              alt="PocketEdge app showing HDFC Flexi Cap Fund reviews on iPhone"
              className="absolute bottom-0 right-0 h-[92%] max-w-[72%] object-contain object-bottom-right drop-shadow-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
