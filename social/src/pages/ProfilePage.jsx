import { ArrowLeft, BadgeCheck } from 'lucide-react';
import Avatar from '../components/Avatar';
import PostCard from '../components/PostCard';
import { CURRENT_USER, MY_PORTFOLIO, POSTS } from '../data/mockData';
import { formatCount, formatInr, formatPct, pnlClass } from '../lib/format';

export default function ProfilePage({ onBack, posts }) {
  const myPosts = (posts ?? POSTS).filter((p) => p.authorId === CURRENT_USER.id);

  return (
    <div>
      <div className="border-b border-pe-border px-4 py-4">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1 text-sm text-pe-text-muted hover:text-pe-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex items-start gap-4">
          <Avatar person={CURRENT_USER} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xl font-semibold">{CURRENT_USER.name}</h2>
              <BadgeCheck className="h-4 w-4 text-sky-400" />
            </div>
            <p className="text-sm text-pe-text-muted">@{CURRENT_USER.handle}</p>
            <p className="mt-2 text-sm text-pe-text-secondary">
              Building in public. Skin in the game on every take.
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span>
                <span className="font-semibold">{formatCount(CURRENT_USER.followers)}</span>{' '}
                <span className="text-pe-text-muted">followers</span>
              </span>
              <span>
                <span className="font-semibold">{CURRENT_USER.following}</span>{' '}
                <span className="text-pe-text-muted">following</span>
              </span>
              <span className={pnlClass(CURRENT_USER.xirr)}>
                XIRR {formatPct(CURRENT_USER.xirr, { signed: false })}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-pe-border bg-pe-surface px-3 py-3">
            <p className="text-[10px] uppercase tracking-wider text-pe-text-muted">Portfolio</p>
            <p className="mt-1 text-lg font-semibold">
              {formatInr(MY_PORTFOLIO.totalValue, { compact: true })}
            </p>
            <p className={`text-xs ${pnlClass(MY_PORTFOLIO.totalPnlPct)}`}>
              {formatPct(MY_PORTFOLIO.totalPnlPct)} all-time
            </p>
          </div>
          <div className="rounded-xl border border-pe-border bg-pe-surface px-3 py-3">
            <p className="text-[10px] uppercase tracking-wider text-pe-text-muted">Holdings</p>
            <p className="mt-1 text-lg font-semibold">{MY_PORTFOLIO.holdings.length}</p>
            <p className="text-xs text-pe-text-muted">
              {MY_PORTFOLIO.watchlists.length} watchlists
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-pe-text-muted">
          Your posts
        </p>
        {myPosts.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-pe-text-muted">
            Posts you compose will show up here with full position disclosure.
          </p>
        ) : (
          myPosts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </div>
  );
}
