import { useEffect, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import Avatar from './Avatar';
import { formatCount } from '../lib/format';
import { formatInfluencingBucket } from '../lib/influencingApi';

export default function ProfileHero({
  person,
  name,
  bio,
  following,
  followerCount,
  followingCount,
  influencingAmount = 0,
  canEditBio = false,
  onToggleFollow,
  onOpenFollowers,
  onOpenFollowing,
  onSaveBio,
  showFollowButton = false,
}) {
  const displayName = name ?? person.name;
  const [bioDraft, setBioDraft] = useState(bio ?? person.bio ?? '');
  const [editingBio, setEditingBio] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const followers = followerCount ?? person.followers;
  const followingTotal = followingCount ?? person.following;
  const influencingLabel =
    typeof influencingAmount === 'string' && influencingAmount.trim()
      ? influencingAmount.trim()
      : formatInfluencingBucket(influencingAmount);

  useEffect(() => {
    if (!editingBio) setBioDraft(bio ?? person.bio ?? '');
  }, [bio, person.bio, editingBio]);

  const saveBio = async () => {
    if (!onSaveBio) return;
    setSavingBio(true);
    try {
      await onSaveBio(bioDraft);
      setEditingBio(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
    } catch {
      /* keep editing open */
    } finally {
      setSavingBio(false);
    }
  };

  const cancelBio = () => {
    setBioDraft(bio ?? person.bio ?? '');
    setEditingBio(false);
  };

  return (
    <section className="border-b border-pe-border px-4 py-5">
      <div className="flex gap-4">
        <Avatar person={person} size="xl" className="mt-0.5" />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h1 className="min-w-0 truncate text-[20px] font-bold leading-tight text-pe-text md:text-2xl">
              {displayName}
            </h1>

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
          <p className="mt-0.5 truncate text-[15px] text-pe-text-muted">@{person.handle}</p>

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
            <Stat label="Influencing" value={influencingLabel} />
          </dl>

          <div className="mt-4">
            {canEditBio && !editingBio ? (
              <div className="mb-1.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditingBio(true)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-pe-text-secondary hover:bg-pe-surface hover:text-pe-accent"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>
            ) : null}
            {canEditBio && editingBio ? (
              <div className="mb-1.5 flex justify-end gap-1">
                <button
                  type="button"
                  onClick={cancelBio}
                  disabled={savingBio}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-pe-text-secondary hover:bg-pe-surface"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveBio}
                  disabled={savingBio}
                  className="inline-flex items-center gap-1 rounded-md bg-pe-accent px-2 py-1 text-sm font-bold text-white hover:bg-pe-accent-pressed disabled:opacity-60"
                >
                  {savedFlash ? <Check className="h-3.5 w-3.5" /> : null}
                  {savingBio ? 'Saving…' : savedFlash ? 'Saved' : 'Save'}
                </button>
              </div>
            ) : null}

            {editingBio ? (
              <textarea
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                rows={3}
                placeholder="Add a short bio"
                className="w-full rounded-lg border border-pe-border-strong bg-pe-canvas px-3 py-2 text-[15px] leading-6 text-pe-ink outline-none focus:border-pe-accent"
              />
            ) : bioDraft ? (
              <p className="text-[15px] leading-6 text-pe-ink">{bioDraft}</p>
            ) : canEditBio ? (
              <p className="text-[15px] leading-6 text-pe-text-muted">Add a short bio</p>
            ) : null}
          </div>
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
