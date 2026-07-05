import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  Heart,
  Home,
  ImagePlus,
  LineChart,
  MessageCircle,
  Pencil,
  Search,
  Share2,
  User,
  Wallet,
} from 'lucide-react';

/** Compact phone frame for scenario previews in the design guide. */
export function ScreenFrame({ label, children, className = '' }) {
  return (
    <div className={`mx-auto w-full max-w-[280px] ${className}`}>
      {label ? (
        <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-widest text-pe-text-muted">
          {label}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-[1.25rem] border border-pe-border-strong bg-pe-canvas shadow-sm">
        {children}
      </div>
    </div>
  );
}

function ShellBar({ left = 'logo', title, right = null }) {
  return (
    <div className="flex h-11 items-center justify-between border-b border-pe-border px-3">
      <div className="min-w-0 text-[13px] font-semibold text-pe-accent">
        {left === 'back' ? '← Back' : left === 'logo' ? '◆ PocketEdge' : left}
      </div>
      {title ? <span className="truncate text-[13px] font-semibold text-pe-text">{title}</span> : <span />}
      <div className="text-pe-text-muted">{right}</div>
    </div>
  );
}

function BottomNav({ active = 'feed' }) {
  const items = [
    { id: 'feed', icon: Home },
    { id: 'search', icon: Search },
    { id: 'activity', icon: Bell },
    { id: 'portfolio', icon: Wallet },
    { id: 'markets', icon: LineChart },
  ];
  return (
    <div className="flex h-11 items-center justify-around border-t border-pe-border bg-pe-canvas px-1">
      {items.map(({ id, icon: Icon }) => (
        <Icon
          key={id}
          className={`h-[18px] w-[18px] ${active === id ? 'text-pe-accent' : 'text-pe-text-muted'}`}
        />
      ))}
      <User className="h-[18px] w-[18px] text-pe-text-muted" />
    </div>
  );
}

function StatusPill({ status }) {
  const styles = {
    built: 'bg-pe-positive/10 text-pe-positive',
    partial: 'bg-pe-warning/10 text-pe-warning',
    spec: 'bg-pe-surface text-pe-text-muted',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${styles[status] ?? styles.spec}`}>
      {status}
    </span>
  );
}

function PrimaryBtn({ children, className = '' }) {
  return (
    <button
      type="button"
      className={`w-full rounded-md bg-pe-accent py-2.5 text-sm font-bold text-white ${className}`}
    >
      {children}
    </button>
  );
}

function OutlineBtn({ children }) {
  return (
    <button type="button" className="w-full rounded-md border border-pe-border-strong py-2.5 text-sm font-bold text-pe-text">
      {children}
    </button>
  );
}

function MiniPost() {
  return (
    <div className="border-b border-pe-border px-3 py-3">
      <div className="flex gap-2">
        <div className="h-8 w-8 shrink-0 rounded-full bg-pe-accent-wash" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-pe-text">Priya Shah</p>
          <p className="mt-1 font-serif text-[13px] leading-snug text-pe-ink">
            Adding to <span className="text-pe-link underline">$RELIANCE</span> on weakness…
          </p>
          <p className="mt-1.5 text-[10px] text-pe-text-muted">Long · 2h · ♡ 24</p>
        </div>
      </div>
    </div>
  );
}

// --- Acquisition ---

export function LandingHomeScreen() {
  return (
    <ScreenFrame label="Mobile">
      <div className="bg-pe-canvas px-4 pb-6 pt-5">
        <p className="text-xs font-bold uppercase tracking-widest text-pe-accent">PocketEdge Social</p>
        <h2 className="mt-2 font-serif text-xl font-bold leading-tight text-pe-text">
          Invest with context. Share with proof.
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-pe-text-secondary">
          Follow investors who disclose what they hold. Every ticker shows skin in the game.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-pe-border">
          <MiniPost />
          <MiniPost />
        </div>
        <div className="mt-5 space-y-2">
          <PrimaryBtn>Get started</PrimaryBtn>
          <OutlineBtn>Sign in</OutlineBtn>
        </div>
      </div>
    </ScreenFrame>
  );
}

export function LoginScreen() {
  return (
    <ScreenFrame>
      <div className="px-4 py-6">
        <ShellBar left="←" title="Sign in" />
        <div className="mt-6 space-y-4">
          <p className="font-serif text-lg font-bold text-pe-text">Welcome back</p>
          <OutlineBtn>Continue with Google</OutlineBtn>
          <div className="relative py-2 text-center text-xs text-pe-text-muted">
            <span className="bg-pe-canvas px-2">or</span>
          </div>
          <input
            readOnly
            placeholder="Email for magic link"
            className="w-full rounded-lg border border-pe-border bg-pe-surface px-3 py-2.5 text-[13px] outline-none"
          />
          <PrimaryBtn>Send link</PrimaryBtn>
        </div>
      </div>
    </ScreenFrame>
  );
}

export function SignupScreen() {
  return (
    <ScreenFrame>
      <div className="px-4 py-6">
        <p className="font-serif text-lg font-bold text-pe-text">Create your account</p>
        <p className="mt-1 text-[13px] text-pe-text-secondary">Join a community of disclosed investors.</p>
        <div className="mt-5 space-y-2">
          <OutlineBtn>Continue with Google</OutlineBtn>
          <PrimaryBtn>Continue with email</PrimaryBtn>
        </div>
        <label className="mt-4 flex items-start gap-2 text-[11px] text-pe-text-muted">
          <input type="checkbox" readOnly checked className="mt-0.5" />
          I agree to Terms and the holdings disclosure policy
        </label>
      </div>
    </ScreenFrame>
  );
}

// --- Onboarding ---

export function OnboardWelcomeScreen() {
  return (
    <ScreenFrame>
      <div className="px-4 py-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-pe-accent-wash text-2xl">📊</div>
        <p className="mt-4 font-serif text-lg font-bold text-pe-text">Your investor network</p>
        <p className="mt-2 text-[13px] leading-relaxed text-pe-text-secondary">
          When someone mentions a stock, you&apos;ll see whether they actually hold it.
        </p>
        <div className="mt-6">
          <PrimaryBtn>Continue</PrimaryBtn>
        </div>
        <p className="mt-3 text-[11px] text-pe-text-muted">Step 1 of 5</p>
      </div>
    </ScreenFrame>
  );
}

export function OnboardProfileScreen() {
  return (
    <ScreenFrame>
      <div className="px-4 py-5">
        <p className="font-serif text-lg font-bold text-pe-text">Set up your profile</p>
        <div className="mt-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-pe-border-strong text-xs text-pe-text-muted">
            Photo
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <input readOnly placeholder="Display name" className="w-full rounded-lg bg-pe-surface px-3 py-2 text-[13px]" />
          <input readOnly placeholder="@handle" className="w-full rounded-lg bg-pe-surface px-3 py-2 text-[13px]" />
          <textarea readOnly placeholder="Bio (optional)" rows={2} className="w-full rounded-lg bg-pe-surface px-3 py-2 text-[13px]" />
        </div>
        <div className="mt-5">
          <PrimaryBtn>Continue</PrimaryBtn>
        </div>
        <p className="mt-2 text-center text-[11px] text-pe-text-muted">Step 2 of 5</p>
      </div>
    </ScreenFrame>
  );
}

export function OnboardFollowScreen() {
  return (
    <ScreenFrame>
      <div className="px-4 py-5">
        <p className="font-serif text-lg font-bold text-pe-text">Follow investors</p>
        <p className="mt-1 text-[13px] text-pe-text-secondary">Pick at least 3 to seed your feed.</p>
        <div className="mt-4 space-y-2">
          {['Ankit Mehta', 'Priya Shah', 'Rohan Das'].map((name, i) => (
            <div key={name} className="flex items-center justify-between rounded-lg border border-pe-border px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-pe-surface" />
                <span className="text-[13px] font-semibold">{name}</span>
              </div>
              <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${i < 2 ? 'bg-pe-accent text-white' : 'border border-pe-border'}`}>
                {i < 2 ? 'Following' : 'Follow'}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-pe-text-muted">2 of 3 selected</p>
        <div className="mt-3 opacity-40">
          <PrimaryBtn>Continue</PrimaryBtn>
        </div>
      </div>
    </ScreenFrame>
  );
}

export function OnboardTopicsScreen() {
  return (
    <ScreenFrame>
      <div className="px-4 py-5">
        <p className="font-serif text-lg font-bold text-pe-text">Topics you follow</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {['India equities', 'US tech', 'ETFs', 'Macro', 'Small caps'].map((t, i) => (
            <span
              key={t}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                i < 3 ? 'bg-pe-accent text-white' : 'border border-pe-border text-pe-text'
              }`}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="mt-6">
          <PrimaryBtn>Continue</PrimaryBtn>
        </div>
      </div>
    </ScreenFrame>
  );
}

export function OnboardPortfolioScreen() {
  return (
    <ScreenFrame>
      <div className="px-4 py-5">
        <p className="font-serif text-lg font-bold text-pe-text">Add your first portfolio</p>
        <p className="mt-1 text-[13px] text-pe-text-secondary">Required for ticker disclosure when you post.</p>
        <input readOnly placeholder="Portfolio name" className="mt-4 w-full rounded-lg bg-pe-surface px-3 py-2 text-[13px]" />
        <textarea readOnly placeholder="Investment thesis" rows={2} className="mt-2 w-full rounded-lg bg-pe-surface px-3 py-2 text-[13px]" />
        <div className="mt-4 space-y-2">
          <PrimaryBtn>Create portfolio</PrimaryBtn>
          <button type="button" className="w-full py-2 text-[13px] font-semibold text-pe-text-muted">
            Skip for now
          </button>
        </div>
      </div>
    </ScreenFrame>
  );
}

export function OnboardDisclosureScreen() {
  return (
    <ScreenFrame>
      <div className="px-4 py-5">
        <p className="font-serif text-lg font-bold text-pe-text">Disclosure agreement</p>
        <ul className="mt-3 space-y-2 text-[12px] leading-relaxed text-pe-text-secondary">
          <li>• $TICKER mentions show your disclosed holdings</li>
          <li>• Portfolio edits log as trades in your profile</li>
          <li>• Misrepresentation may result in account action</li>
        </ul>
        <label className="mt-4 flex items-start gap-2 text-[12px]">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-pe-accent" />
          I understand and agree to disclose accurately
        </label>
        <div className="mt-5">
          <PrimaryBtn>Enter feed</PrimaryBtn>
        </div>
      </div>
    </ScreenFrame>
  );
}

// --- Feed ---

export function FeedForYouScreen() {
  return (
    <ScreenFrame>
      <ShellBar left="◆ For You ▾" />
      <MiniPost />
      <MiniPost />
      <div className="relative px-3 py-2">
        <div className="absolute bottom-16 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-pe-accent text-white shadow-md">
          <Pencil className="h-5 w-5" />
        </div>
      </div>
      <BottomNav active="feed" />
    </ScreenFrame>
  );
}

export function FeedFollowingEmptyScreen() {
  return (
    <ScreenFrame>
      <ShellBar left="◆ Following ▾" />
      <div className="px-4 py-10 text-center">
        <p className="font-serif text-base font-bold text-pe-text">Nothing here yet</p>
        <p className="mt-2 text-[12px] text-pe-text-secondary">Follow people or topics to fill this feed.</p>
        <button type="button" className="mt-4 text-[13px] font-semibold text-pe-accent">
          Discover on Search →
        </button>
      </div>
      <BottomNav active="feed" />
    </ScreenFrame>
  );
}

export function ComposePostScreen() {
  return (
    <ScreenFrame>
      <div className="border-b border-pe-border px-3 py-2.5 flex items-center justify-between">
        <span className="text-pe-text-muted">✕</span>
        <span className="text-[13px] font-semibold">New post</span>
        <span className="rounded-md bg-pe-accent px-3 py-1 text-[11px] font-bold text-white">Post</span>
      </div>
      <div className="px-3 py-3">
        <p className="font-serif text-[14px] leading-relaxed text-pe-ink">
          Trimmed <span className="text-pe-link underline">$INFY</span> — adding on earnings dip. 18mo horizon.
        </p>
        <div className="mt-3 rounded-lg bg-pe-accent-wash px-2 py-1.5 text-[10px] text-pe-accent">
          Disclosure: Long INFY · 120 shares
        </div>
        <div className="mt-3 flex items-center gap-1 text-[11px] text-pe-text-muted">
          <ImagePlus className="h-3.5 w-3.5" /> Image
        </div>
      </div>
    </ScreenFrame>
  );
}

export function ComposeImageScreen() {
  return (
    <ScreenFrame>
      <div className="border-b border-pe-border px-3 py-2.5 text-center text-[13px] font-semibold">New post</div>
      <div className="mx-3 mt-3 flex h-24 items-center justify-center rounded-lg bg-pe-surface text-[11px] text-pe-text-muted">
        Chart screenshot
      </div>
      <p className="px-3 py-2 font-serif text-[13px] text-pe-ink">Nifty holding 22k support…</p>
    </ScreenFrame>
  );
}

export function PostDetailScreen() {
  return (
    <ScreenFrame>
      <ShellBar left="back" />
      <div className="px-3 py-3">
        <div className="flex gap-2">
          <div className="h-8 w-8 rounded-full bg-pe-surface" />
          <div>
            <p className="text-[13px] font-semibold">Priya Shah</p>
            <p className="mt-2 font-serif text-[13px] leading-relaxed text-pe-ink">Full post body with thesis…</p>
            <div className="mt-3 flex gap-4 text-pe-text-muted">
              <Heart className="h-4 w-4" />
              <MessageCircle className="h-4 w-4" />
              <Share2 className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="mt-4 border-t border-pe-border pt-3">
          <p className="text-[11px] font-semibold text-pe-text-muted">Comments</p>
          <p className="mt-2 text-[12px] text-pe-text-secondary">Rohan: Agree on timeline.</p>
        </div>
      </div>
    </ScreenFrame>
  );
}

export function AddCommentScreen() {
  return (
    <ScreenFrame>
      <ShellBar left="back" title="Post" />
      <div className="border-t border-pe-border px-3 py-2">
        <div className="flex gap-2">
          <div className="h-7 w-7 shrink-0 rounded-full bg-pe-accent-wash" />
          <input
            readOnly
            placeholder="Add a comment…"
            className="flex-1 rounded-full bg-pe-surface px-3 py-1.5 text-[12px] outline-none"
          />
        </div>
        <button type="button" className="mt-2 w-full rounded-md bg-pe-accent py-1.5 text-[12px] font-bold text-white">
          Reply
        </button>
      </div>
    </ScreenFrame>
  );
}

export function TickerDisclosureScreen() {
  return (
    <ScreenFrame>
      <MiniPost />
      <div className="mx-3 -mt-1 rounded-lg border border-pe-border bg-pe-elevated p-3 shadow-md">
        <p className="text-[11px] font-bold uppercase text-pe-accent">Your position</p>
        <p className="mt-1 text-[13px] font-semibold text-pe-text">RELIANCE</p>
        <p className="text-[12px] text-pe-text-secondary">Long · 40 shares · Avg ₹2,410</p>
        <p className="mt-1 text-[12px] text-pe-positive">+4.2% unrealized</p>
      </div>
    </ScreenFrame>
  );
}

// --- Discovery ---

export function SearchLandingScreen() {
  return (
    <ScreenFrame>
      <div className="border-b border-pe-border px-3 py-2">
        <div className="flex h-9 items-center gap-2 rounded-lg bg-pe-surface px-2.5">
          <Search className="h-3.5 w-3.5 text-pe-text-muted" />
          <span className="text-[12px] text-pe-text-muted">Search…</span>
        </div>
      </div>
      <div className="px-3 py-3">
        <p className="text-[11px] font-bold uppercase text-pe-text-muted">Trending topics</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {['#india', '#semis'].map((t) => (
            <span key={t} className="rounded-full bg-pe-surface px-2 py-1 text-[11px] font-semibold">{t}</span>
          ))}
        </div>
        <p className="mt-3 text-[11px] font-bold uppercase text-pe-text-muted">Suggested</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold">Ankit Mehta</span>
          <span className="text-[11px] font-bold text-pe-accent">Follow</span>
        </div>
      </div>
      <BottomNav active="search" />
    </ScreenFrame>
  );
}

export function SearchPeopleScreen() {
  return (
    <ScreenFrame>
      <div className="border-b border-pe-border px-3 py-2">
        <div className="flex h-9 items-center rounded-lg bg-pe-surface px-2.5 text-[12px]">priya</div>
      </div>
      <div className="flex border-b border-pe-border text-[12px] font-semibold">
        <span className="border-b-2 border-pe-accent px-3 py-2">People</span>
        <span className="px-3 py-2 text-pe-text-muted">Topics</span>
        <span className="px-3 py-2 text-pe-text-muted">Stocks</span>
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between border-b border-pe-border px-3 py-2.5">
          <span className="text-[12px] font-semibold">Priya Shah</span>
          <ChevronRight className="h-4 w-4 text-pe-text-muted" />
        </div>
      ))}
      <BottomNav active="search" />
    </ScreenFrame>
  );
}

export function SearchStocksScreen() {
  return (
    <ScreenFrame>
      <div className="border-b border-pe-border px-3 py-2 text-[12px]">tcs</div>
      <div className="flex border-b border-pe-border text-[12px] font-semibold">
        <span className="px-3 py-2 text-pe-text-muted">People</span>
        <span className="border-b-2 border-pe-accent px-3 py-2">Stocks</span>
      </div>
      <div className="flex items-center justify-between px-3 py-2.5">
        <div>
          <p className="text-[12px] font-semibold">TCS</p>
          <p className="text-[11px] text-pe-positive">+1.2%</p>
        </div>
        <ChevronRight className="h-4 w-4 text-pe-text-muted" />
      </div>
      <BottomNav active="search" />
    </ScreenFrame>
  );
}

export function FollowUserScreen() {
  return (
    <ScreenFrame>
      <ShellBar left="back" />
      <div className="px-3 py-4">
        <div className="flex items-start justify-between">
          <div className="flex gap-2">
            <div className="h-12 w-12 rounded-full bg-pe-surface" />
            <div>
              <p className="font-serif text-base font-bold">Ankit Mehta</p>
              <p className="text-[12px] text-pe-text-muted">@ankitm</p>
            </div>
          </div>
          <span className="rounded-md bg-pe-accent px-3 py-1.5 text-[11px] font-bold text-white">Follow</span>
        </div>
      </div>
    </ScreenFrame>
  );
}

// --- Markets ---

export function PortfolioHoldingsScreen() {
  return (
    <ScreenFrame>
      <ShellBar title="Portfolio" />
      <div className="flex border-b border-pe-border px-3 text-[12px] font-semibold">
        <span className="border-b-2 border-pe-accent py-2 pr-3">Holdings</span>
        <span className="py-2 text-pe-text-muted">Watchlists</span>
      </div>
      <div className="px-3 py-3">
        <p className="text-[11px] text-pe-text-muted">Total value</p>
        <p className="text-lg font-bold">₹18.4L</p>
        <div className="mt-3 space-y-2">
          {['RELIANCE', 'INFY'].map((s) => (
            <div key={s} className="flex justify-between text-[12px]">
              <span className="font-semibold">{s}</span>
              <span className="text-pe-text-muted">32%</span>
            </div>
          ))}
        </div>
      </div>
      <BottomNav active="portfolio" />
    </ScreenFrame>
  );
}

export function WatchlistCreateScreen() {
  return (
    <ScreenFrame>
      <ShellBar left="back" title="New list" />
      <div className="px-3 py-4 space-y-3">
        <input readOnly placeholder="List name" className="w-full rounded-lg bg-pe-surface px-3 py-2 text-[13px]" />
        <input readOnly placeholder="Add symbol…" className="w-full rounded-lg bg-pe-surface px-3 py-2 text-[13px]" />
        <PrimaryBtn>Save watchlist</PrimaryBtn>
      </div>
    </ScreenFrame>
  );
}

export function MarketsMoversScreen() {
  return (
    <ScreenFrame>
      <div className="flex border-b border-pe-border px-3 text-[12px] font-semibold">
        <span className="border-b-2 border-pe-accent py-2 pr-3">Movers</span>
        <span className="py-2 pr-3 text-pe-text-muted">Gainers</span>
        <span className="py-2 text-pe-text-muted">Losers</span>
      </div>
      {['HDFCBANK', 'TATAMOTORS'].map((s, i) => (
        <div key={s} className="flex items-center justify-between border-b border-pe-border px-3 py-2.5 text-[12px]">
          <span className="font-semibold">{s}</span>
          <span className={i === 0 ? 'text-pe-positive' : 'text-pe-negative'}>{i === 0 ? '+2.1%' : '-1.4%'}</span>
        </div>
      ))}
      <BottomNav active="markets" />
    </ScreenFrame>
  );
}

export function StockDetailScreen() {
  return (
    <ScreenFrame>
      <ShellBar left="back" title="RELIANCE" />
      <div className="px-3 py-2">
        <p className="text-xl font-bold">₹2,514</p>
        <p className="text-[12px] text-pe-positive">+0.8% today</p>
      </div>
      <div className="flex border-b border-pe-border px-3 text-[11px] font-semibold">
        {['Summary', 'News', 'Trades', 'Posts'].map((t, i) => (
          <span key={t} className={`py-2 pr-3 ${i === 0 ? 'border-b-2 border-pe-accent' : 'text-pe-text-muted'}`}>
            {t}
          </span>
        ))}
      </div>
      <div className="px-3 py-3 text-[12px] text-pe-text-secondary">Community posts about RELIANCE…</div>
    </ScreenFrame>
  );
}

// --- Profile ---

export function ProfileOwnScreen() {
  return (
    <ScreenFrame>
      <ShellBar title="Kushagra" right={<span className="text-[11px]">Public view</span>} />
      <div className="border-b border-pe-border px-3 py-3">
        <div className="flex gap-2">
          <div className="h-12 w-12 rounded-full bg-pe-accent-wash" />
          <div>
            <p className="font-serif text-base font-bold">Kushagra Agarwal</p>
            <p className="text-[12px] text-pe-text-muted">@kushagra</p>
          </div>
        </div>
      </div>
      <div className="flex border-b border-pe-border px-3 text-[12px] font-semibold">
        <span className="border-b-2 border-pe-accent py-2 pr-3">Posts</span>
        <span className="py-2 pr-3 text-pe-text-muted">Portfolios</span>
        <span className="py-2 text-pe-text-muted">Trades</span>
      </div>
      <BottomNav />
    </ScreenFrame>
  );
}

export function ProfilePublicScreen() {
  return (
    <ScreenFrame>
      <ShellBar left="back" />
      <div className="flex items-center justify-between px-3 py-3">
        <p className="font-serif text-base font-bold">Priya Shah</p>
        <span className="rounded-md border border-pe-border px-2 py-1 text-[11px] font-bold">Following</span>
      </div>
      <MiniPost />
    </ScreenFrame>
  );
}

export function PortfolioAddScreen() {
  return (
    <ScreenFrame>
      <ShellBar left="back" title="New portfolio" />
      <div className="px-3 py-4 space-y-2">
        <input readOnly placeholder="Portfolio name" className="w-full rounded-lg bg-pe-surface px-3 py-2 text-[13px]" />
        <input readOnly placeholder="Objective" className="w-full rounded-lg bg-pe-surface px-3 py-2 text-[13px]" />
        <textarea readOnly placeholder="Investment thesis" rows={3} className="w-full rounded-lg bg-pe-surface px-3 py-2 text-[13px]" />
        <PrimaryBtn>Save</PrimaryBtn>
      </div>
    </ScreenFrame>
  );
}

export function PortfolioEditScreen() {
  return (
    <ScreenFrame>
      <ShellBar left="back" title="Core India" />
      <div className="px-3 py-3">
        <p className="text-[11px] font-bold uppercase text-pe-text-muted">Holdings</p>
        <div className="mt-2 space-y-2">
          {[
            ['RELIANCE', '40 sh'],
            ['INFY', '120 sh'],
          ].map(([sym, qty]) => (
            <div key={sym} className="flex justify-between rounded-lg border border-pe-border px-2 py-2 text-[12px]">
              <span className="font-semibold">{sym}</span>
              <span className="text-pe-text-muted">{qty}</span>
            </div>
          ))}
        </div>
        <button type="button" className="mt-3 text-[12px] font-semibold text-pe-accent">+ Add holding</button>
      </div>
    </ScreenFrame>
  );
}

// --- Activity ---

export function ActivityUnreadScreen() {
  return (
    <ScreenFrame>
      <ShellBar title="Activity" />
      <div className="px-3 py-2">
        <p className="text-[11px] font-bold uppercase text-pe-text-muted">From people you follow</p>
        <div className="mt-2 flex gap-2 border-b border-pe-border py-2">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-pe-accent" />
          <p className="text-[12px]"><strong>Priya</strong> posted about $TCS</p>
        </div>
        <p className="mt-3 text-[11px] font-bold uppercase text-pe-text-muted">From your holdings</p>
        <p className="mt-2 text-[12px] text-pe-text-secondary">Trade on RELIANCE in your network</p>
      </div>
      <BottomNav active="activity" />
    </ScreenFrame>
  );
}

export function ActivityPostScreen() {
  return (
    <ScreenFrame>
      <ShellBar left="back" />
      <MiniPost />
    </ScreenFrame>
  );
}

// --- Settings ---

export function SettingsScreen() {
  return (
    <ScreenFrame>
      <ShellBar left="back" title="Settings" />
      <div className="divide-y divide-pe-border text-[13px]">
        {['Notifications', 'Connected accounts', 'Disclosure policy', 'Terms & privacy'].map((row) => (
          <div key={row} className="flex items-center justify-between px-3 py-3">
            <span>{row}</span>
            <ChevronRight className="h-4 w-4 text-pe-text-muted" />
          </div>
        ))}
      </div>
    </ScreenFrame>
  );
}

export function LogoutScreen() {
  return (
    <ScreenFrame>
      <div className="px-4 py-8 text-center">
        <p className="font-serif text-base font-bold text-pe-text">Log out?</p>
        <p className="mt-2 text-[12px] text-pe-text-secondary">You can sign back in anytime.</p>
        <div className="mt-5 space-y-2">
          <button type="button" className="w-full rounded-md bg-pe-negative/10 py-2.5 text-sm font-bold text-pe-negative">
            Log out
          </button>
          <OutlineBtn>Cancel</OutlineBtn>
        </div>
      </div>
    </ScreenFrame>
  );
}

export const SCENARIO_SCREEN_MAP = {
  LandingHomeScreen,
  LoginScreen,
  SignupScreen,
  OnboardWelcomeScreen,
  OnboardProfileScreen,
  OnboardFollowScreen,
  OnboardTopicsScreen,
  OnboardPortfolioScreen,
  OnboardDisclosureScreen,
  FeedForYouScreen,
  FeedFollowingEmptyScreen,
  ComposePostScreen,
  ComposeImageScreen,
  PostDetailScreen,
  AddCommentScreen,
  TickerDisclosureScreen,
  SearchLandingScreen,
  SearchPeopleScreen,
  SearchStocksScreen,
  FollowUserScreen,
  PortfolioHoldingsScreen,
  WatchlistCreateScreen,
  MarketsMoversScreen,
  StockDetailScreen,
  ProfileOwnScreen,
  ProfilePublicScreen,
  PortfolioAddScreen,
  PortfolioEditScreen,
  ActivityUnreadScreen,
  ActivityPostScreen,
  SettingsScreen,
  LogoutScreen,
};

export function ScenarioScreenPreview({ screen }) {
  const Component = SCENARIO_SCREEN_MAP[screen];
  if (!Component) return <p className="text-sm text-pe-text-muted">Screen preview pending.</p>;
  return <Component />;
}

export { StatusPill };
