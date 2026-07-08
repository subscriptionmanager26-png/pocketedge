import { useCallback, useEffect, useRef, useState } from 'react';
import { signInWithGoogle } from '../lib/supabase';
import { useLandingViewport } from './useLandingViewport';
import './landing.css';

const ASSETS = '/landing/assets';

const FEATURES = [
  {
    title: 'Real insights',
    body: 'from investors with skin in the game',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"
          stroke="#F4511E"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M9 12l2 2 4-4"
          stroke="#F4511E"
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
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="9" cy="8" r="3" stroke="#F4511E" strokeWidth="1.6" />
        <path
          d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"
          stroke="#F4511E"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="17" cy="9" r="2.3" stroke="#F4511E" strokeWidth="1.6" />
        <path
          d="M16 14c2.5 0 4.5 1.8 4.5 4.5"
          stroke="#F4511E"
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
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 16l5-5 3 3 6-6"
          stroke="#F4511E"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 8h4v4"
          stroke="#F4511E"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

function Headline() {
  return (
    <h1 className="headline">
      <span className="headline-dark">Before you invest..</span>
      <span className="headline-accent">See what real investors own and say</span>
      <svg className="underline" viewBox="0 0 160 12" fill="none" aria-hidden="true">
        <path
          d="M2 8C40 3 120 3 158 6"
          stroke="#F4511E"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </h1>
  );
}

function FeatureList({ desktop = false }) {
  return (
    <ul className={`features${desktop ? ' features--desktop' : ''}`}>
      {FEATURES.map((feature) => (
        <li key={feature.title} className={`feature${desktop ? ' feature--row' : ''}`}>
          <span className="feature-icon">{feature.icon}</span>
          <div className="feature-text">
            <strong>{feature.title}</strong>
            <p>{feature.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CtaBlock({ desktop = false, loading, error, onGetStarted }) {
  return (
    <div className={`cta-wrap${desktop ? ' cta-wrap--desktop' : ''}`}>
      <button
        type="button"
        className={`cta${desktop ? ' cta--desktop' : ''}`}
        onClick={onGetStarted}
        disabled={loading}
      >
        <span>{loading ? 'Redirecting to Google…' : 'Get Started'}</span>
        {!loading && <span className="cta-arrow" aria-hidden="true">→</span>}
      </button>
      <p className="cta-sub">
        Join investors sharing <span className="accent">real insights</span>
      </p>
      {error && <p className="cta-error">{error}</p>}
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
  const openDrawer = useCallback(() => setDrawerOpen(true), []);

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

  return (
    <div ref={landingRef} className={`pe-site-landing${drawerOpen ? ' is-drawer-open' : ''}`}>
      <header className="navbar">
        <div className="nav-inner">
          <button type="button" className="brand" aria-label="PocketEdge home">
            <img src={`${ASSETS}/logo.png`} className="brand-logo" alt="" />
            <span className="brand-name">PocketEdge</span>
          </button>

          <nav className="nav-links" aria-label="Main navigation">
            <button type="button">Portfolios</button>
            <button type="button">Community</button>
            <button type="button">About</button>
            <button type="button" onClick={handleGetStarted} disabled={loading}>
              Get Started
            </button>
          </nav>

          <button
            type="button"
            className={`hamburger${drawerOpen ? ' is-open' : ''}`}
            aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={drawerOpen}
            aria-controls="landing-drawer"
            onClick={() => (drawerOpen ? closeDrawer() : openDrawer())}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <button
        type="button"
        className={`drawer-overlay${drawerOpen ? ' open' : ''}`}
        aria-hidden={!drawerOpen}
        aria-label="Close menu"
        onClick={closeDrawer}
      />

      <aside
        id="landing-drawer"
        className={`drawer${drawerOpen ? ' open' : ''}`}
        aria-hidden={!drawerOpen}
      >
        <div className="drawer-header">
          <span className="drawer-title">Menu</span>
          <button type="button" className="drawer-close" aria-label="Close menu" onClick={closeDrawer}>
            <span />
            <span />
          </button>
        </div>
        <nav className="drawer-nav">
          <button type="button">Portfolios</button>
          <button type="button">Community</button>
          <button type="button">About</button>
          <button type="button" onClick={handleGetStarted} disabled={loading}>
            Get Started
          </button>
        </nav>
      </aside>

      <div className="layout-mobile">
        <div className="page">
          <main className="hero">
            <Headline />

            <div className="hero-body">
              <FeatureList />
              <div className="hero-phone">
                <img
                  src={`${ASSETS}/phone-display.png`}
                  alt="PocketEdge app showing top rated funds and investor reviews"
                  className="phone-img"
                />
              </div>
            </div>
          </main>
        </div>

        <footer className="mobile-cta-dock">
          <CtaBlock loading={loading} error={error} onGetStarted={handleGetStarted} />
        </footer>
      </div>

      <div className="layout-desktop">
        <div className="desktop-page">
          <div className="desktop-hero">
            <div className="desktop-content">
              <Headline />
              <FeatureList desktop />
              <CtaBlock
                desktop
                loading={loading}
                error={error}
                onGetStarted={handleGetStarted}
              />
            </div>

            <div className="desktop-visuals">
              <img
                src={`${ASSETS}/feed-card.png`}
                alt="PocketEdge social feed showing investor portfolio updates"
                className="visual-feed"
              />
              <img
                src={`${ASSETS}/iphone-fund-reviews.png`}
                alt="PocketEdge app showing HDFC Flexi Cap Fund reviews on iPhone"
                className="visual-phone"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
