import { useEffect, useState } from 'react';
import Avatar from './Avatar';
import {
  getAppCurrentUserId,
  getPersonSync,
  resolvePeople,
} from '../lib/socialIdentity';
import {
  getFollowersForUser,
  getFollowingForUser,
  hydrateFollowGraph,
  isFollowing,
  toggleFollow,
} from '../lib/socialGraphStore';
import { isDevMockMode } from '../lib/appMode';

function isMockUserId(id) {
  const value = String(id ?? '');
  return value === 'u_me' || /^u\d+$/.test(value) || /^u_[a-z0-9]+$/i.test(value);
}

function listIdsForMode(userId, mode) {
  const raw =
    mode === 'followers' ? getFollowersForUser(userId) : getFollowingForUser(userId);
  if (isDevMockMode()) return raw;
  // Drop leftover demo IDs so production lists never show mock people.
  return raw.filter((id) => !isMockUserId(id));
}

export default function FollowListView({
  userId,
  mode,
  graphTick,
  onBack: _onBack,
  onOpenProfile,
  onGraphChange,
}) {
  const title = mode === 'followers' ? 'Followers' : 'Following';
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setPeople([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      await hydrateFollowGraph(userId).catch(() => {});
      if (cancelled) return;

      void graphTick;
      const ids = listIdsForMode(userId, mode);
      if (!ids.length) {
        setPeople([]);
        setLoading(false);
        return;
      }

      // Paint sync placeholders immediately, then replace with resolved profiles.
      setPeople(ids.map((id) => getPersonSync(id)).filter(Boolean));

      try {
        const resolved = await resolvePeople(ids);
        if (cancelled) return;
        setPeople(
          resolved.length
            ? resolved
            : ids.map((id) => getPersonSync(id)).filter(Boolean)
        );
      } catch {
        if (cancelled) return;
        setPeople(ids.map((id) => getPersonSync(id)).filter(Boolean));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, mode, graphTick]);

  return (
    <div>
      {/* Back lives in Shell FeedTopBar gutter — do not duplicate under search. */}
      <div className="px-4 py-4 md:px-6">
        <h2 className="text-[20px] font-semibold tracking-tight text-pe-text">{title}</h2>
      </div>

      {loading && people.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-pe-text-secondary md:px-6">
          Loading…
        </p>
      ) : people.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-pe-text-secondary md:px-6">
          {mode === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
        </p>
      ) : (
        <div className="divide-y divide-[var(--fv-border,#ececec)] px-4 md:px-6">
          {people.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              graphTick={graphTick}
              onOpenProfile={onOpenProfile}
              onGraphChange={onGraphChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonRow({ person, graphTick, onOpenProfile, onGraphChange }) {
  void graphTick;
  const currentUserId = getAppCurrentUserId();
  const following = isFollowing(person.id);
  const isSelf = person.id === currentUserId;
  const displayName =
    String(person.name ?? '').trim() ||
    String(person.handle ?? '').trim() ||
    'Investor';

  return (
    <div className="flex items-center gap-3 py-3.5">
      <Avatar person={person} onClick={() => onOpenProfile?.(person.id)} />
      <button
        type="button"
        onClick={() => onOpenProfile?.(person.id)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-[15px] font-semibold text-pe-text hover:underline">
          {displayName}
        </p>
        {person.handle ? (
          <p className="truncate text-sm text-pe-text-muted">@{person.handle}</p>
        ) : null}
      </button>
      {!isSelf && (
        <button
          type="button"
          onClick={async () => {
            await toggleFollow(person.id);
            onGraphChange?.();
          }}
          className={`shrink-0 rounded-md px-3.5 py-1.5 text-sm font-bold transition ${
            following
              ? 'border border-pe-border-strong bg-pe-canvas text-pe-text hover:bg-pe-surface'
              : 'bg-pe-accent text-white hover:bg-pe-accent-pressed'
          }`}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}
