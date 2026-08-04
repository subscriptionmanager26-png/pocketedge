import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Menu, Search, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LogoMark from './LogoMark';
import {
  businessModelPath,
  disclosuresPath,
  ideasPath,
  insightsPath,
  resourcesPath,
  tabPath,
} from '../lib/routes';

export const MARKETING_NAV_GROUPS = [
  {
    id: 'stocks',
    label: 'Stocks',
    items: [
      { label: 'Browse stocks', href: ideasPath() },
      { label: 'Browse indices', href: ideasPath() },
      { label: 'Browse commodities', href: ideasPath() },
      { label: 'Insights', href: insightsPath() },
      { label: 'Business Model', href: businessModelPath() },
    ],
  },
  {
    id: 'etf',
    label: 'ETFs',
    items: [
      { label: 'Browse ETFs', href: ideasPath() },
      { label: 'ETF iNAV tracker', href: resourcesPath('etf-inav') },
    ],
  },
  {
    id: 'bonds',
    label: 'Bonds',
    items: [{ label: 'SGB tracker', href: resourcesPath('sgb') }],
  },
  {
    id: 'mutual_funds',
    label: 'MF',
    items: [
      { label: 'Browse funds', href: ideasPath() },
      { label: 'MF screener', href: resourcesPath('mf-screener') },
    ],
  },
  {
    id: 'more',
    label: 'More',
    items: [{ label: 'Disclosures', href: disclosuresPath() }],
  },
];

/** Flat list for in-app menus (unique hrefs, first label wins). */
export const MARKETING_NAV_ITEMS = (() => {
  const seen = new Set();
  const items = [];
  for (const group of MARKETING_NAV_GROUPS) {
    for (const item of group.items) {
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      items.push(item);
    }
  }
  return items;
})();

function hrefActive(pathname, search, href) {
  const [pathPart, queryPart] = href.split('?');
  if (pathPart === '/disclosures') {
    return pathname === '/disclosures' || pathname.startsWith('/disclosures/');
  }
  if (pathPart === '/resources') {
    return pathname === '/resources';
  }
  if (pathPart === '/ideas') {
    return pathname === '/ideas' || pathname.startsWith('/ideas/');
  }
  if (pathPart === '/business-model') {
    return (
      pathname === '/business-model' ||
      pathname.startsWith('/business-model/') ||
      pathname === '/learning' ||
      pathname.startsWith('/learning/')
    );
  }
  if (pathPart === '/insights') {
    return pathname === '/insights' || pathname.startsWith('/insights/');
  }
  return pathname === pathPart || pathname.startsWith(`${pathPart}/`);
}

function groupActive(pathname, search, group) {
  return group.items.some((item) => hrefActive(pathname, search, item.href));
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

function ExploreSearchField({ className = '', compact = false }) {
  const navigate = useNavigate();
  const [value, setValue] = useState('');

  const goIdeas = () => {
    navigate(ideasPath());
  };

  return (
    <form
      className={`relative flex min-w-0 items-center ${className}`}
      onSubmit={(event) => {
        event.preventDefault();
        goIdeas();
      }}
    >
      <Search
        className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pe-text-muted ${
          compact ? 'h-4 w-4' : 'h-4 w-4'
        }`}
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Explore stocks, funds, ETFs…"
        aria-label="Explore"
        className={`w-full rounded-full border border-pe-border bg-pe-surface text-pe-text outline-none ring-pe-accent placeholder:text-pe-text-muted focus:border-pe-accent focus:ring-2 ${
          compact ? 'h-9 py-1.5 pl-9 pr-3 text-[15px]' : 'h-10 py-2 pl-9 pr-4 text-[15px]'
        }`}
      />
    </form>
  );
}

function NavDropdown({ group, pathname, search }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();
  const active = groupActive(pathname, search, group);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-0.5 text-[15px] font-medium transition hover:text-pe-accent ${
          active || open ? 'text-pe-accent' : 'text-pe-text-secondary'
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {group.label}
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 top-full z-50 min-w-[12rem] pt-2"
        >
          <div className="overflow-hidden rounded-xl border border-pe-border bg-pe-canvas py-1.5 shadow-lg">
            {group.items.map((item) => {
              const itemActive = hrefActive(pathname, search, item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`block px-3.5 py-2.5 text-[15px] font-medium transition hover:bg-pe-surface hover:text-pe-accent ${
                    itemActive ? 'text-pe-accent' : 'text-pe-text'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
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
    'shrink-0 rounded-md bg-pe-accent px-5 py-2.5 text-[15px] font-bold text-white transition hover:bg-pe-accent-pressed';
  const drawerCtaClass =
    'mt-2 rounded-md bg-pe-accent px-3 py-3.5 text-center text-[15px] font-bold text-white transition hover:bg-pe-accent-pressed';

  return (
    <>
      <header className="pe-landing-nav sticky top-0 z-40 shrink-0 border-b border-pe-border bg-pe-canvas/95 backdrop-blur-md print:hidden">
        <div className="mx-auto flex h-14 max-w-feed items-center gap-3 px-4 md:h-[72px] lg:max-w-6xl lg:gap-4 lg:px-8">
          <Link
            to="/"
            className="min-w-0 shrink-0"
            onClick={onCloseDrawer}
            aria-label="PocketEdge home"
          >
            <LogoMark size="sm" showWordmark />
          </Link>

          {showMarketingNav ? (
            <>
              <nav
                className="hidden min-w-0 flex-1 items-center gap-4 xl:gap-5 lg:flex"
                aria-label="Main navigation"
              >
                {MARKETING_NAV_GROUPS.map((group) => (
                  <NavDropdown
                    key={group.id}
                    group={group}
                    pathname={location.pathname}
                    search={location.search}
                  />
                ))}
                <ExploreSearchField className="ml-auto w-full max-w-[16rem] xl:max-w-[18rem]" />
                <PrimaryCta
                  isAuthenticated={isAuthenticated}
                  loading={loading}
                  onGetStarted={onGetStarted}
                  onCloseDrawer={onCloseDrawer}
                  className={ctaClass}
                />
              </nav>

              <ExploreSearchField className="min-w-0 flex-1 lg:hidden" compact />

              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-pe-text transition hover:bg-pe-surface lg:hidden"
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
            className={`fixed right-0 top-0 z-[60] flex h-full w-[min(320px,85vw)] flex-col border-l border-pe-border bg-pe-canvas shadow-xl transition-transform duration-300 lg:hidden print:hidden ${
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
            <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
              {MARKETING_NAV_GROUPS.map((group) => (
                <div key={group.id}>
                  <p className="px-3 pb-1 text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                    {group.label}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const active = hrefActive(
                        location.pathname,
                        location.search,
                        item.href
                      );
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={onCloseDrawer}
                          className={`rounded-lg px-3 py-3 text-left text-[15px] font-medium transition hover:bg-pe-surface ${
                            active ? 'bg-pe-surface text-pe-accent' : 'text-pe-text'
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
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
