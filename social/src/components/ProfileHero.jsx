import { BadgeCheck, Eye, EyeOff } from 'lucide-react';
import Avatar from './Avatar';
import { formatCount, formatInr } from '../lib/format';

export default function ProfileHero({
  person,
  name,
  bio,
  following,
  followerCount,
  followingCount,
  onToggleFollow,
  onOpenFollowers,
  onOpenFollowing,
  showFollowButton = false,
  showViewToggle = false,
  isPublicPreview = false,
  onToggleView,
}) {
  const displayName = name ?? person.name;
  const displayBio = bio ?? person.bio;
  const assetsInfluenced = person.assetsInfluenced ?? 0;
  const followers = followerCount ?? person.followers;
  const followingTotal = followingCount ?? person.following;

  return (
    <section className="border-b border-pe-border px-4 py-5">
      <div className="flex gap-4">
        <Avatar person={person} size="xl" className="mt-0.5" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <h1 className="text-[22px] font-bold leading-tight text-pe-text md:text-2xl">
                {displayName}
              </h1>
              <BadgeCheck className="h-4 w-4 shrink-0 text-pe-link" aria-label="Verified" />
            </div>

            {showViewToggle && (
              <button
                type="button"
                onClick={onToggleView}
                className="inline-flex shrink-0 items-center gap-1.5 text-[15px] font-semibold text-pe-text-muted transition hover:text-pe-accent"
              >
                {isPublicPreview ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Private view
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Public view
                  </>
                )}
              </button>
            )}

            {showFollowButton && (
              <button
                type="button"
                onClick={onToggleFollow}
                className={`shrink-0 rounded-md px-4 py-2 text-sm font-bold transition ${
                  following
                    ? 'border border-pe-border-strong bg-pe-canvas text-pe-text hover:bg-pe-surface'
                    : 'bg-pe-accent text-white hover:bg-pe-accent-pressed'
                }`}
              >
                {following ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
          <p className="mt-0.5 text-[15px] text-pe-text-muted">@{person.handle}</p>

          <dl className="mt-4 flex gap-6">
            <Stat
              label="Followers"
              value={formatCount(followers)}
              onClick={onOpenFollowers}
            />
            <Stat
              label="Following"
              value={formatCount(followingTotal)}
              onClick={onOpenFollowing}
            />
            <Stat label="Influencing" value={formatInr(assetsInfluenced, { compact: true })} />
          </dl>

          {displayBio ? (
            <p className="mt-4 text-[15px] leading-6 text-pe-ink">{displayBio}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, onClick }) {
  const inner = (
    <>
      <dt className="text-center text-[15px] font-bold leading-none text-pe-text">{value}</dt>
      <dd className="mt-1 text-center text-xs font-medium text-pe-text-muted">{label}</dd>
    </>
  );

  if (!onClick) {
    return <div className="min-w-0 text-center">{inner}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-0 text-center transition hover:opacity-80"
    >
      {inner}
    </button>
  );
}
