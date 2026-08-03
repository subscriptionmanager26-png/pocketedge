import { useMemo } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  FileText,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import GuestSignInCta from '../components/GuestSignInCta';
import { getActivityFeed } from '../lib/activityFeed';
import { isActivityRead, markActivityRead } from '../lib/activityStore';
import { formatPct, formatPrice, pnlClass, timeAgo } from '../lib/format';
import { getPersonSync } from '../lib/socialIdentity';
import { formatTicker } from '../lib/tickers';

const TYPE_ICONS = {
  post: FileText,
  trade: TrendingUp,
  portfolio_change: Briefcase,
  new_follower: UserPlus,
};

export default function ActivityPage({
  items,
  guestMode = false,
  onOpenProfile,
  onOpenPost,
  onOpenStock,
}) {
  const feed = guestMode ? [] : (items ?? getActivityFeed());

  const { followers, following, holdings } = useMemo(() => {
    const followerItems = feed.filter((item) => item.category === 'followers');
    const followingItems = feed.filter((item) => item.category === 'following');
    const holdingItems = feed.filter((item) => item.category === 'portfolio_stock');
    return {
      followers: followerItems,
      following: followingItems,
      holdings: holdingItems,
    };
  }, [feed]);

  return (
    <div>
      <div className="px-4 py-4 md:px-6 md:pt-2">
        <h1 className="text-[18px] font-semibold tracking-tight text-pe-text">Activity</h1>
        <p className="mt-0.5 text-[13px] text-pe-text-secondary">
          Followers, network updates, and chatter on your holdings.
        </p>
      </div>

      {guestMode ? (
        <GuestSignInCta
          variant="hero"
          title="Never miss a move"
          description="Sign in for followers, updates from people you follow, and chatter on your holdings."
          action="see your activity"
          showExploreHint={false}
          benefits={[
            'New followers in real time',
            'Updates from your network',
            'Buzz on stocks you hold',
          ]}
        />
      ) : null}

      <ActivitySection
        title="New followers"
        empty={
          guestMode
            ? 'Sign in to see who follows you.'
            : 'When someone follows you, they’ll show up here.'
        }
        items={followers}
        onOpenProfile={onOpenProfile}
        onOpenPost={onOpenPost}
        onOpenStock={onOpenStock}
      />

      <ActivitySection
        title="From people you follow"
        empty={
          guestMode
            ? 'Sign in to follow investors and get their updates here.'
            : 'Posts, trades, and portfolio changes from people you follow will show up here.'
        }
        items={following}
        onOpenProfile={onOpenProfile}
        onOpenPost={onOpenPost}
        onOpenStock={onOpenStock}
      />

      <ActivitySection
        title="From your holdings"
        empty={
          guestMode
            ? 'Sign in to track community activity on stocks you hold.'
            : 'Significant community posts and trades on stocks in your portfolio appear here.'
        }
        items={holdings}
        onOpenProfile={onOpenProfile}
        onOpenPost={onOpenPost}
        onOpenStock={onOpenStock}
      />
    </div>
  );
}

function ActivitySection({
  title,
  empty,
  items,
  onOpenProfile,
  onOpenPost,
  onOpenStock,
}) {
  return (
    <section className="border-b border-[var(--fv-border,#ececec)]">
      <div className="px-4 py-3 md:px-6">
        <p className="text-[13px] font-semibold tracking-wide text-pe-text-muted">{title}</p>
      </div>

      {!items.length ? (
        <p className="px-4 py-10 text-center text-sm text-pe-text-secondary md:px-6">{empty}</p>
      ) : (
        <div className="divide-y divide-[var(--fv-border,#ececec)]">
          {items.map((item) => (
            <ActivityRow
              key={item.id}
              item={item}
              onOpenProfile={onOpenProfile}
              onOpenPost={onOpenPost}
              onOpenStock={onOpenStock}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ActivityRow({ item, onOpenProfile, onOpenPost, onOpenStock }) {
  const person = item.authorId ? getPersonSync(item.authorId) : null;
  const Icon = TYPE_ICONS[item.type] ?? FileText;
  const unread = !isActivityRead(item.id);
  const trade = item.meta?.trade;
  const isNewFollower = item.type === 'new_follower';

  const handleClick = () => {
    markActivityRead(item.id);
    if (item.meta?.postId) {
      onOpenPost?.(item.meta.postId);
      return;
    }
    if (item.ticker && item.category === 'portfolio_stock' && item.type === 'trade') {
      onOpenStock?.(item.ticker);
      return;
    }
    if (item.authorId) onOpenProfile?.(item.authorId);
  };

  const title = isNewFollower
    ? `${person?.name ?? 'Someone'} started following you`
    : item.title;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full gap-3 px-4 py-4 text-left transition hover:bg-black/[0.03] md:px-6 ${
        unread ? 'bg-pe-accent-wash/30' : ''
      }`}
    >
      {person ? (
        <Avatar
          person={person}
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onOpenProfile?.(person.id);
          }}
        />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-pe-text-muted">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[15px] font-semibold leading-5 text-pe-text">{title}</p>
          <span className="shrink-0 text-[12px] font-medium text-pe-text-muted">
            {timeAgo(item.createdAt)}
          </span>
        </div>

        {person?.handle && isNewFollower ? (
          <p className="mt-1 text-[13px] leading-5 text-pe-text-secondary">@{person.handle}</p>
        ) : null}

        {!isNewFollower && item.body ? (
          <p className="mt-1 text-[13px] leading-5 text-pe-text-secondary">{item.body}</p>
        ) : null}

        {trade && item.type === 'trade' && trade.action && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[13px]">
            {trade.action === 'buy' ? (
              <ArrowUpRight className="h-4 w-4 text-pe-positive" strokeWidth={2} />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-pe-negative" strokeWidth={2} />
            )}
            <span className="font-semibold text-pe-text">{formatTicker(item.ticker)}</span>
            {trade.qty != null && trade.price != null && (
              <span className="text-pe-text-secondary">
                {trade.qty} @ {formatPrice(trade.price)}
              </span>
            )}
            {trade.pnlPct != null && (
              <span className={`font-semibold ${pnlClass(trade.pnlPct)}`}>
                {formatPct(trade.pnlPct)}
              </span>
            )}
          </p>
        )}

        {item.ticker && item.category === 'portfolio_stock' && (
          <p className="mt-2 text-[12px] font-medium text-pe-text-muted">
            {formatTicker(item.ticker)} in your portfolio
          </p>
        )}
      </div>

      {unread && (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-pe-accent" aria-hidden />
      )}
    </button>
  );
}
