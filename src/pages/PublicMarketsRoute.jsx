import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import MarketingShell from '../components/MarketingShell';
import { RouteFallbackSkeleton } from '../components/PageSkeletons';
import { isPublicMarketsPath, parseAppPath, tabPath } from '../lib/routes';
import { signInWithGoogle } from '../lib/supabase';

const MarketsPage = lazy(() => import('./MarketsPage'));
const ExplorePage = lazy(() => import('./ExplorePage'));
const StockInvestmentPage = lazy(() => import('./StockInvestmentPage'));
const InvestmentPage = lazy(() => import('./InvestmentPage'));
const IndexDetailPage = lazy(() => import('./IndexDetailPage'));
const CommodityDetailPage = lazy(() => import('./CommodityDetailPage'));

function RouteSuspense({ children }) {
  return <Suspense fallback={<RouteFallbackSkeleton />}>{children}</Suspense>;
}

function GuestSignInBanner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || 'Could not start Google sign-in.');
      setLoading(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-pe-border bg-pe-surface px-4 py-3 print:hidden">
      <p className="text-sm text-pe-text-secondary">
        Browsing as a guest.{' '}
        <button
          type="button"
          onClick={handleSignIn}
          disabled={loading}
          className="font-semibold text-pe-accent hover:underline disabled:opacity-60"
        >
          {loading ? 'Redirecting…' : 'Sign in'}
        </button>{' '}
        to follow holders, join discussions, and manage your portfolio.
      </p>
      {error ? <p className="mt-1 text-sm text-pe-negative">{error}</p> : null}
    </div>
  );
}

/**
 * Public Markets / Explore / asset detail shell for logged-out visitors.
 * URL is the source of truth; market rows use real <Link> hrefs for crawlers.
 */
export default function PublicMarketsRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const parsed = parseAppPath(location.pathname);
  const [marketsSectionTab, setMarketsSectionTab] = useState('stocks');

  useEffect(() => {
    if (location.pathname === '/search' || location.pathname.startsWith('/search/')) {
      navigate(tabPath('explore'), { replace: true });
    }
  }, [location.pathname, navigate]);

  const goMarkets = useCallback(() => {
    navigate(tabPath('markets'));
  }, [navigate]);

  if (!isPublicMarketsPath(parsed)) {
    return null;
  }

  let content = null;

  if (parsed.kind === 'tab' && parsed.tab === 'explore') {
    content = (
      <RouteSuspense>
        <ExplorePage guestMode />
      </RouteSuspense>
    );
  } else if (parsed.kind === 'stock' || parsed.kind === 'etf') {
    content = (
      <RouteSuspense>
        <StockInvestmentPage ticker={parsed.symbol} guestMode onBack={goMarkets} />
      </RouteSuspense>
    );
  } else if (parsed.kind === 'fund') {
    content = (
      <RouteSuspense>
        <InvestmentPage fundId={parsed.schemeCode} guestMode onBack={goMarkets} />
      </RouteSuspense>
    );
  } else if (parsed.kind === 'index') {
    content = (
      <RouteSuspense>
        <IndexDetailPage indexId={parsed.indexId} guestMode onBack={goMarkets} />
      </RouteSuspense>
    );
  } else if (parsed.kind === 'commodity') {
    content = (
      <RouteSuspense>
        <CommodityDetailPage commodityId={parsed.commodityId} guestMode onBack={goMarkets} />
      </RouteSuspense>
    );
  } else {
    content = (
      <RouteSuspense>
        <MarketsPage
          guestMode
          sectionTab={marketsSectionTab}
          onSectionTabChange={setMarketsSectionTab}
        />
      </RouteSuspense>
    );
  }

  const onMarketsHub = parsed.kind === 'tab' && parsed.tab === 'markets';
  const onExplore = parsed.kind === 'tab' && parsed.tab === 'explore';

  return (
    <MarketingShell wide>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm print:hidden">
        <Link
          to={tabPath('markets')}
          className={`font-semibold ${
            onMarketsHub ? 'text-pe-accent' : 'text-pe-text-secondary hover:text-pe-accent'
          }`}
        >
          Markets
        </Link>
        <span className="text-pe-border" aria-hidden>
          ·
        </span>
        <Link
          to={tabPath('explore')}
          className={`font-semibold ${
            onExplore ? 'text-pe-accent' : 'text-pe-text-secondary hover:text-pe-accent'
          }`}
        >
          Explore
        </Link>
      </div>
      <GuestSignInBanner />
      {content}
    </MarketingShell>
  );
}
