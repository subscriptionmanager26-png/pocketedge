import LogoMark from '../components/LogoMark';

export default function LandingPage({ onGetStarted, onSignIn }) {
  return (
    <div className="min-h-screen bg-pe-canvas">
      <header className="flex items-center justify-between px-4 py-4 md:px-8">
        <div className="flex items-center gap-2">
          <LogoMark className="h-7 w-7" />
          <span className="text-[15px] font-bold text-pe-text">PocketEdge Social</span>
        </div>
        <button
          type="button"
          onClick={onSignIn}
          className="text-[15px] font-semibold text-pe-text-secondary hover:text-pe-text"
        >
          Sign in
        </button>
      </header>

      <main className="mx-auto max-w-feed px-4 pb-12 pt-6 md:pt-10">
        <p className="text-xs font-bold uppercase tracking-widest text-pe-accent">Investor social</p>
        <h1 className="mt-3 font-serif text-3xl font-bold leading-tight text-pe-text md:text-4xl">
          Invest with context. Share with proof.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-pe-text-secondary">
          Follow investors who disclose what they hold. Every $TICKER mention shows skin in the game — no
          anonymous hot takes.
        </p>

        <div className="mt-8 overflow-hidden rounded-xl border border-pe-border">
          <FeedPreview />
        </div>

        <ul className="mt-8 space-y-3 text-[15px] text-pe-text-secondary">
          <li className="flex gap-2">
            <span className="text-pe-accent">✓</span>
            Position disclosure on every post and comment
          </li>
          <li className="flex gap-2">
            <span className="text-pe-accent">✓</span>
            Portfolio changes auto-log as trades
          </li>
          <li className="flex gap-2">
            <span className="text-pe-accent">✓</span>
            Activity from people you follow and stocks you hold
          </li>
        </ul>

        <div className="mt-10 space-y-3">
          <button
            type="button"
            onClick={onGetStarted}
            className="w-full rounded-md bg-pe-accent py-3 text-[15px] font-bold text-white transition hover:bg-pe-accent-pressed"
          >
            Get started
          </button>
          <button
            type="button"
            onClick={onSignIn}
            className="w-full rounded-md border border-pe-border-strong py-3 text-[15px] font-bold text-pe-text transition hover:bg-pe-surface"
          >
            Sign in
          </button>
        </div>
      </main>
    </div>
  );
}

function FeedPreview() {
  return (
    <>
      <article className="border-b border-pe-border px-4 py-4">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pe-accent-wash text-sm font-bold text-pe-accent">
            R
          </div>
          <div>
            <p className="text-[15px] font-semibold text-pe-text">Rohan Verma</p>
            <p className="mt-1 font-serif text-[15px] leading-relaxed text-pe-ink">
              Adding to <span className="text-pe-link underline">$HDFCBANK</span> on dip — 18mo view intact.
            </p>
            <p className="mt-2 text-[11px] font-semibold uppercase text-pe-accent">Long HDFCBANK · 120 shares</p>
          </div>
        </div>
      </article>
      <article className="px-4 py-4">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pe-surface text-sm font-bold">
            A
          </div>
          <div>
            <p className="text-[15px] font-semibold text-pe-text">Ananya Shah</p>
            <p className="mt-1 font-serif text-[15px] leading-relaxed text-pe-ink">
              IT services earnings thread — holding <span className="text-pe-link underline">$TCS</span> through volatility.
            </p>
          </div>
        </div>
      </article>
    </>
  );
}
