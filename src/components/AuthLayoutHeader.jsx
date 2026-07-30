import { Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import LogoMark from './LogoMark';
import {
  disclosuresPath,
  insightsPath,
  businessModelPath,
  resourcesPath,
  tabPath,
} from '../lib/routes';

export const MARKETING_NAV_ITEMS = [
  { label: 'Insights', href: insightsPath() },
  { label: 'Markets', href: tabPath('markets') },
  { label: 'Business Model', href: businessModelPath() },
  { label: 'Disclosures', href: disclosuresPath() },
  { label: 'Resources', href: resourcesPath() },
];

function navItemActive(pathname, href) {
  if (href === '/disclosures') return pathname === '/disclosures' || pathname.startsWith('/disclosures/');
  if (href === '/resources') return pathname === '/resources' || pathname.startsWith('/resources/');
  if (href === '/markets') {
    return (
      pathname === '/markets' ||
      pathname === '/search' ||
      pathname.startsWith('/stock/') ||
      pathname.startsWith('/etf/') ||
      pathname.startsWith('/fund/') ||
      pathname.startsWith('/index/') ||
      pathname.startsWith('/commodity/')
    );
  }
  if (href === '/business-model') {
    return (
      pathname === '/business-model' ||
      pathname.startsWith('/business-model/') ||
      pathname === '/learning' ||
      pathname.startsWith('/learning/')
    );
  }
  return pathname === href;
}

function PrimaryCta({ isAuthenticated, loading, onGetStarted, onCloseDrawer, className }) {
  if (isAuthenticated) {
    return (
      <Link to={tabPath('feed')} onClick={onCloseDrawer} className={className}>
        Go to Home
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onGetStarted}
      disabled={loading}
      className={`${className} disabled:opacity-60`}
    >
      {loading ? 'Redirecting…' : 'Get Started'}
    </button>
  );
}

export default function AuthLayoutHeader({
  badge,
  drawerOpen,
  onToggleDrawer,
  onCloseDrawer,
  onGetStarted,
  loading = false,
  showMarketingNav = false,
  isAuthenticated = false,
}) {
  const location = useLocation();
  const ctaClass =
    'rounded-md bg-pe-accent px-5 py-2.5 text-[15px] font-bold text-white transition hover:bg-pe-accent-pressed';
  const drawerCtaClass =
    'mt-2 rounded-md bg-pe-accent px-3 py-3.5 text-center text-[15px] font-bold text-white transition hover:bg-pe-accent-pressed';

  return (
    <>
      <header className="pe-landing-nav sticky top-0 z-40 shrink-0 border-b border-pe-border bg-pe-canvas/95 backdrop-blur-md print:hidden">
        <div className="mx-auto flex h-14 max-w-feed items-center justify-between gap-3 px-4 md:h-[72px] lg:max-w-6xl lg:px-8">
          <Link to="/" className="min-w-0 shrink-0" onClick={onCloseDrawer} aria-label="PocketEdge home">
            <LogoMark size="sm" showWordmark />
          </Link>

          {showMarketingNav ? (
            <>
              <nav className="hidden items-center gap-8 lg:flex" aria-label="Main navigation">
                {MARKETING_NAV_ITEMS.map((item) => {
                  const active = navItemActive(location.pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`text-[15px] font-medium transition hover:text-pe-accent ${
                        active ? 'text-pe-accent' : 'text-pe-text-secondary'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <PrimaryCta
                  isAuthenticated={isAuthenticated}
                  loading={loading}
                  onGetStarted={onGetStarted}
                  onCloseDrawer={onCloseDrawer}
                  className={ctaClass}
                />
              </nav>

              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-md text-pe-text transition hover:bg-pe-surface lg:hidden"
                aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={drawerOpen}
                aria-controls="auth-layout-drawer"
                onClick={onToggleDrawer}
              >
                {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </>
          ) : badge ? (
            <span className="ml-auto text-sm font-semibold text-pe-text-muted">{badge}</span>
          ) : null}
        </div>
      </header>

      {showMarketingNav ? (
        <>
          <button
            type="button"
            className={`fixed inset-0 z-50 bg-black/40 transition lg:hidden print:hidden ${
              drawerOpen ? 'visible opacity-100' : 'invisible opacity-0'
            }`}
            aria-hidden={!drawerOpen}
            aria-label="Close menu"
            onClick={onCloseDrawer}
          />

          <aside
            id="auth-layout-drawer"
            className={`fixed right-0 top-0 z-[60] flex h-full w-[min(300px,85vw)] flex-col border-l border-pe-border bg-pe-canvas shadow-xl transition-transform duration-300 lg:hidden print:hidden ${
              drawerOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
            aria-hidden={!drawerOpen}
          >
            <div className="flex items-center justify-between border-b border-pe-border px-4 py-4">
              <span className="text-[15px] font-semibold text-pe-text">Menu</span>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-pe-surface"
                aria-label="Close menu"
                onClick={onCloseDrawer}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-3">
              {MARKETING_NAV_ITEMS.map((item) => {
                const active = navItemActive(location.pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={onCloseDrawer}
                    className={`rounded-lg px-3 py-3.5 text-left text-[15px] font-medium transition hover:bg-pe-surface ${
                      active ? 'bg-pe-surface text-pe-accent' : 'text-pe-text'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <PrimaryCta
                isAuthenticated={isAuthenticated}
                loading={loading}
                onGetStarted={onGetStarted}
                onCloseDrawer={onCloseDrawer}
                className={drawerCtaClass}
              />
            </nav>
          </aside>
        </>
      ) : null}
    </>
  );
}
