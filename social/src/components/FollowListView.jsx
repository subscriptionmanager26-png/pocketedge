import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import Avatar from './Avatar';
import PageHeader from './PageHeader';
import { getPerson } from '../data/mockData';
import {
  getFollowersForUser,
  getFollowingForUser,
  isFollowing,
  toggleFollow,
} from '../lib/socialGraphStore';
import { formatCount, formatPct } from '../lib/format';

export default function FollowListView({
  userId,
  mode,
  graphTick,
  onBack,
  onOpenProfile,
  onGraphChange,
}) {
  const person = getPerson(userId);
  const ids = useMemo(() => {
    void graphTick;
    return mode === 'followers' ? getFollowersForUser(userId) : getFollowingForUser(userId);
  }, [userId, mode, graphTick]);

  const people = ids.map((id) => getPerson(id)).filter(Boolean);
  const title = mode === 'followers' ? 'Followers' : 'Following';

  return (
    <div>
      <PageHeader>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-pe-text-secondary hover:text-pe-text"
        >
          <ArrowLeft className="h-4 w-4" />
          {person.name}
        </button>
      </PageHeader>

      <div className="border-b border-pe-border px-4 py-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pe-accent">{title}</p>
        <h2 className="mt-0.5 font-serif text-2xl font-bold text-pe-text">@{person.handle}</h2>
        <p className="mt-1 text-sm text-pe-text-secondary">
          {formatCount(people.length)} {title.toLowerCase()}
        </p>
      </div>

      {people.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
          {mode === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
        </p>
      ) : (
        <div className="divide-y divide-pe-border px-4">
          {people.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
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
  const following = isFollowing(person.id);

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
        <p className="text-sm text-pe-text-muted">@{person.handle}</p>
        <p className="mt-0.5 text-xs text-pe-text-secondary">
          <span className="font-semibold text-pe-positive">
            XIRR {formatPct(person.xirr, { signed: false })}
          </span>
          <span> · {formatCount(person.followers)} followers</span>
        </p>
      </button>
      {person.id !== 'u_me' && (
        <button
          type="button"
          onClick={() => {
            toggleFollow(person.id);
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
