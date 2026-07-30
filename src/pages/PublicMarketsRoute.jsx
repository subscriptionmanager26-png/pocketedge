import { lazy, Suspense, useCallback, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import MarketingShell from '../components/MarketingShell';
import { RouteFallbackSkeleton } from '../components/PageSkeletons';
import { isPublicMarketsPath, parseAppPath, tabPath } from '../lib/routes';
import { signInWithGoogle } from '../lib/supabase';

const MarketsPage = lazy(() => import('./MarketsPage'));
const SearchPage = lazy(() => import('./SearchPage'));
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
 * Public Markets / Search / asset detail shell for logged-out visitors.
 * URL is the source of truth; market rows use real <Link> hrefs for crawlers.
 */
export default function PublicMarketsRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const parsed = parseAppPath(location.pathname);
  const [marketsSectionTab, setMarketsSectionTab] = useState('stocks');

  const goMarkets = useCallback(() => {
    navigate(tabPath('markets'));
  }, [navigate]);

  if (!isPublicMarketsPath(parsed)) {
    return null;
  }

  let content = null;

  if (parsed.kind === 'tab' && parsed.tab === 'search') {
    content = (
      <RouteSuspense>
        <SearchPage guestMode />
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
  const onSearch = parsed.kind === 'tab' && parsed.tab === 'search';

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
          to={tabPath('search')}
          className={`font-semibold ${
            onSearch ? 'text-pe-accent' : 'text-pe-text-secondary hover:text-pe-accent'
          }`}
        >
          Search
        </Link>
      </div>
      <GuestSignInBanner />
      {content}
    </MarketingShell>
  );
}
