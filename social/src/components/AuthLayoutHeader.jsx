import { Menu, X } from 'lucide-react';
import LogoMark from './LogoMark';

const NAV_ITEMS = ['Portfolios', 'Community', 'About'];

export default function AuthLayoutHeader({
  badge,
  drawerOpen,
  onToggleDrawer,
  onCloseDrawer,
  onGetStarted,
  loading = false,
  showMarketingNav = false,
}) {
  return (
    <>
      <header className="pe-landing-nav sticky top-0 z-40 shrink-0 border-b border-pe-border bg-pe-canvas/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-feed items-center justify-between gap-3 px-4 md:h-[72px] lg:max-w-6xl lg:px-8">
          <LogoMark size="sm" showWordmark className="min-w-0 shrink-0" />

          {showMarketingNav ? (
            <>
              <nav className="hidden items-center gap-8 lg:flex" aria-label="Main navigation">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="text-[15px] font-medium text-pe-text-secondary transition hover:text-pe-accent"
                  >
                    {item}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onGetStarted}
                  disabled={loading}
                  className="rounded-md bg-pe-accent px-5 py-2.5 text-[15px] font-bold text-white transition hover:bg-pe-accent-pressed disabled:opacity-60"
                >
                  {loading ? 'Redirecting…' : 'Get Started'}
                </button>
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
            className={`fixed inset-0 z-50 bg-black/40 transition lg:hidden ${
              drawerOpen ? 'visible opacity-100' : 'invisible opacity-0'
            }`}
            aria-hidden={!drawerOpen}
            aria-label="Close menu"
            onClick={onCloseDrawer}
          />

          <aside
            id="auth-layout-drawer"
            className={`fixed right-0 top-0 z-[60] flex h-full w-[min(300px,85vw)] flex-col border-l border-pe-border bg-pe-canvas shadow-xl transition-transform duration-300 lg:hidden ${
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
              {NAV_ITEMS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={onCloseDrawer}
                  className="rounded-lg px-3 py-3.5 text-left text-[15px] font-medium text-pe-text transition hover:bg-pe-surface"
                >
                  {item}
                </button>
              ))}
              <button
                type="button"
                onClick={onGetStarted}
                disabled={loading}
                className="mt-2 rounded-md bg-pe-accent px-3 py-3.5 text-[15px] font-bold text-white transition hover:bg-pe-accent-pressed disabled:opacity-60"
              >
                {loading ? 'Redirecting…' : 'Get Started'}
              </button>
            </nav>
          </aside>
        </>
      ) : null}
    </>
  );
}
