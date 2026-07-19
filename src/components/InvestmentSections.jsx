import { useEffect, useState } from 'react';
import Avatar from './Avatar';
import { getPersonSync, resolvePeople } from '../lib/socialIdentity';

export const INVESTMENT_TABS = [
  { id: 'insights', label: 'Insights' },
  { id: 'discussions', label: 'Posts' },
  { id: 'holders', label: 'Holders' },
  { id: 'news', label: 'News' },
];

/** Stocks only — Corporate Actions sits after News. */
export const STOCK_INVESTMENT_TABS = [
  ...INVESTMENT_TABS,
  { id: 'corporate_actions', label: 'Corporate Actions' },
];

/** Discussions are posts — same row on stock and fund pages. */
export function DiscussionPostRow({ post, onOpenProfile, enrichmentTick = 0 }) {
  void enrichmentTick;
  const author = getPersonSync(post.authorId) ?? {
    id: post.authorId,
    name: 'Member',
    handle: 'member',
    avatar: 'M',
  };
  return (
    <div className="border-b border-pe-border py-4">
      <button
        type="button"
        onClick={() => onOpenProfile?.(post.authorId)}
        className="flex items-center gap-2 text-left"
      >
        <Avatar person={author} size="sm" />
        <div>
          <p className="text-sm font-semibold text-pe-text">{author.name}</p>
          <p className="text-xs text-pe-text-muted">@{author.handle}</p>
        </div>
      </button>
      <p className="mt-2 line-clamp-4 text-[15px] leading-relaxed text-pe-text">{post.body}</p>
      <p className="mt-2 text-xs font-semibold text-pe-accent">
        {(post.comments ?? []).length} {(post.comments ?? []).length === 1 ? 'reply' : 'replies'}
        {(post.likes ?? 0) > 0 && ` · ${post.likes} likes`}
      </p>
    </div>
  );
}

export function DiscussionsList({ posts, onOpenProfile, emptyMessage }) {
  const [enrichTick, setEnrichTick] = useState(0);

  useEffect(() => {
    const ids = [...new Set((posts ?? []).map((p) => p?.authorId).filter(Boolean).map(String))];
    if (!ids.length) return undefined;
    let cancelled = false;
    resolvePeople(ids)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setEnrichTick((n) => n + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [posts]);

  if (!posts.length) {
    return (
      <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">{emptyMessage}</p>
    );
  }
  return (
    <div className="px-4 py-2">
      {posts.map((post) => (
        <DiscussionPostRow
          key={post.id}
          post={post}
          onOpenProfile={onOpenProfile}
          enrichmentTick={enrichTick}
        />
      ))}
    </div>
  );
}

/** Holders tab — list of users who disclose owning this asset. */
export function HoldersList({ holders, loading, onOpenProfile, emptyMessage }) {
  if (loading) {
    return (
      <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">Loading holders…</p>
    );
  }

  if (!holders?.length) {
    return (
      <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
        {emptyMessage ?? 'No disclosed holders yet.'}
      </p>
    );
  }

  return (
    <div className="divide-y divide-pe-border">
      {holders.map((holder) => {
        const userId = holder.userId ?? holder;
        const person = getPersonSync(userId) ?? {
          id: userId,
          name: 'Member',
          handle: 'member',
          avatar: 'M',
        };
        return (
          <button
            key={userId}
            type="button"
            onClick={() => onOpenProfile?.(userId)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-pe-surface/50"
          >
            <Avatar person={person} />
            <div>
              <p className="text-[15px] font-semibold text-pe-text">{person.name}</p>
              <p className="text-sm text-pe-text-muted">@{person.handle} · holds in portfolio</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
