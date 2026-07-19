import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Avatar from './Avatar';
import PageHeader from './PageHeader';
import {
  getAppCurrentUserId,
  getPersonSync,
  resolvePerson,
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

export default function FollowListView({
  userId,
  mode,
  graphTick,
  onBack,
  onOpenProfile,
  onGraphChange,
}) {
  const title = mode === 'followers' ? 'Followers' : 'Following';

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    hydrateFollowGraph(userId).catch(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [userId, mode]);

  const ids = useMemo(() => {
    void graphTick;
    const raw =
      mode === 'followers' ? getFollowersForUser(userId) : getFollowingForUser(userId);
    if (isDevMockMode()) return raw;
    // Drop leftover demo IDs so production lists never show mock people.
    return raw.filter((id) => !isMockUserId(id));
  }, [userId, mode, graphTick]);

  const idsKey = ids.join(',');
  const [people, setPeople] = useState(() =>
    ids.map((id) => getPersonSync(id)).filter(Boolean)
  );

  useEffect(() => {
    let cancelled = false;
    const nextIds = idsKey ? idsKey.split(',') : [];
    setPeople(nextIds.map((id) => getPersonSync(id)).filter(Boolean));

    Promise.all(nextIds.map((id) => resolvePerson(id).catch(() => getPersonSync(id))))
      .then((resolved) => {
        if (cancelled) return;
        setPeople(resolved.filter(Boolean));
      });

    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return (
    <div>
      <PageHeader desktopOnly>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-pe-text-secondary hover:text-pe-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </PageHeader>

      <div className="border-b border-pe-border px-4 py-4">
        <h2 className="text-xl font-bold text-pe-text">{title}</h2>
      </div>

      {people.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
          {mode === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
        </p>
      ) : (
        <div className="divide-y divide-pe-border px-4">
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

  return (
    <div className="flex items-center gap-3 py-3.5">
      <Avatar person={person} onClick={() => onOpenProfile?.(person.id)} />
      <button
        type="button"
        onClick={() => onOpenProfile?.(person.id)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-[15px] font-semibold text-pe-text hover:underline">
          {person.name}
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
