import React, { useEffect, useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Plus,
  Trash2,
} from 'lucide-react';
import { getReferralLink } from '../../supabase';
import { createLinkId, loadUserProfile, saveUserProfile } from '../profileStore';
import { capture, captureReferralLinkCopied } from '../../analytics';

function hydrateFromProfile(userId, authName) {
  const profile = loadUserProfile(userId);
  return {
    name: profile.name || authName || '',
    bio: profile.bio || '',
    avatarUrl: profile.avatarUrl || '',
    links: profile.links?.length ? profile.links : [],
  };
}

export default function AboutYouSection({ user, userId = 'local', referralCount = 0, onSaved }) {
  const authName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const authEmail = user?.email || 'demo@pocketedge.app';

  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [links, setLinks] = useState([]);

  const referralLink = getReferralLink(user?.id || userId);
  const displayName = name.trim() || authName || 'Investor';

  const loadForm = () => {
    const next = hydrateFromProfile(userId, authName);
    setName(next.name);
    setBio(next.bio);
    setAvatarUrl(next.avatarUrl);
    setLinks(next.links);
  };

  useEffect(() => {
    loadForm();
  }, [userId, authName]);

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const addLink = () => {
    setLinks((prev) => [...prev, { id: createLinkId(), label: '', url: '' }]);
  };

  const updateLink = (id, field, value) => {
    setLinks((prev) => prev.map((link) => (link.id === id ? { ...link, [field]: value } : link)));
  };

  const removeLink = (id) => {
    setLinks((prev) => prev.filter((link) => link.id !== id));
  };

  const handleSave = () => {
    const savedLinkCount = links.filter((link) => link.label.trim() || link.url.trim()).length;
    saveUserProfile(userId, {
      name: name.trim(),
      bio: bio.trim(),
      avatarUrl,
      links: links.filter((link) => link.label.trim() || link.url.trim()),
    });
    capture('profile_saved', {
      has_bio: Boolean(bio.trim()),
      has_avatar: Boolean(avatarUrl),
      link_count: savedLinkCount,
    });
    setEditing(false);
    setSaved(true);
    onSaved?.();
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCancel = () => {
    loadForm();
    setEditing(false);
  };

  const handleCopyReferral = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      captureReferralLinkCopied('account', referralCount);
    } catch {
      // Clipboard blocked
    }
  };

  const savedLinks = links.filter((link) => link.label.trim() || link.url.trim());

  return (
    <section className="pe-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-pe-border/60">
        <div>
          <h2 className="pe-section-title text-base">About you</h2>
          <p className="text-xs text-pe-text-muted mt-0.5">
            Shown on baskets you create
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-semibold text-pe-positive hover:underline shrink-0"
          >
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm text-pe-text-muted hover:text-pe-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-pe-positive hover:underline"
            >
              {saved ? <Check className="w-4 h-4" /> : null}
              Save
            </button>
          </div>
        )}
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {editing ? (
          <EditForm
            name={name}
            setName={setName}
            authEmail={authEmail}
            bio={bio}
            setBio={setBio}
            avatarUrl={avatarUrl}
            onAvatarUpload={handleAvatarUpload}
            links={links}
            addLink={addLink}
            updateLink={updateLink}
            removeLink={removeLink}
            referralLink={referralLink}
            referralCount={referralCount}
            copied={copied}
            onCopyReferral={handleCopyReferral}
          />
        ) : (
          <CompactView
            displayName={displayName}
            authEmail={authEmail}
            bio={bio}
            avatarUrl={avatarUrl}
            links={savedLinks}
            referralLink={referralLink}
            referralCount={referralCount}
            copied={copied}
            onCopyReferral={handleCopyReferral}
          />
        )}
      </div>
    </section>
  );
}

function Avatar({ name, avatarUrl, size = 'md' }) {
  const sizeClass = size === 'sm' ? 'w-14 h-14 rounded-xl text-lg' : 'w-16 h-16 rounded-2xl text-2xl';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${sizeClass} object-cover border border-pe-border/80 shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} bg-neutral-900 flex items-center justify-center font-semibold text-white shrink-0`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function CompactView({
  displayName,
  authEmail,
  bio,
  avatarUrl,
  links,
  referralLink,
  referralCount,
  copied,
  onCopyReferral,
}) {
  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar name={displayName} avatarUrl={avatarUrl} />
        <div className="min-w-0">
          <p className="text-base font-semibold text-pe-text truncate">{displayName}</p>
          <p className="text-sm text-pe-text-muted truncate">{authEmail}</p>
        </div>
      </div>

      <div className="pt-4 border-t border-pe-border/60">
        <p className="pe-label text-[10px] mb-1.5">Bio</p>
        {bio ? (
          <p className="text-sm text-pe-text-secondary leading-relaxed whitespace-pre-wrap line-clamp-4">
            {bio}
          </p>
        ) : (
          <p className="text-sm text-pe-text-muted">No bio yet</p>
        )}
      </div>

      <div className="pt-4 border-t border-pe-border/60">
        <p className="pe-label text-[10px] mb-2">Links</p>
        {links.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-50 border border-pe-border/60 text-sm text-pe-text-secondary hover:text-pe-text transition-colors"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  {link.label || link.url}
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-pe-text-muted">No links yet</p>
        )}
      </div>

      <ReferralRow
        referralLink={referralLink}
        referralCount={referralCount}
        copied={copied}
        onCopy={onCopyReferral}
      />
    </>
  );
}

function EditForm({
  name,
  setName,
  authEmail,
  bio,
  setBio,
  avatarUrl,
  onAvatarUpload,
  links,
  addLink,
  updateLink,
  removeLink,
  referralLink,
  referralCount,
  copied,
  onCopyReferral,
}) {
  return (
    <>
      <div className="space-y-4">
        <p className="pe-label text-[10px] font-semibold uppercase tracking-wider text-pe-text-secondary">
          Basic details
        </p>
        <div className="flex flex-col sm:flex-row gap-5">
          <label className="shrink-0 w-24 h-24 rounded-2xl border-2 border-dashed border-pe-border/80 flex flex-col items-center justify-center cursor-pointer hover:border-neutral-400 overflow-hidden bg-neutral-50">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <>
                <Camera className="w-6 h-6 text-pe-text-muted mb-1" />
                <span className="text-[10px] text-pe-text-muted">Photo</span>
              </>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={onAvatarUpload} />
          </label>
          <div className="flex-1 space-y-3 min-w-0">
            <label className="block">
              <span className="pe-label text-[10px]">Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="pe-input mt-1.5"
              />
            </label>
            <label className="block">
              <span className="pe-label text-[10px]">Email</span>
              <input
                type="email"
                value={authEmail}
                readOnly
                className="pe-input mt-1.5 bg-neutral-50 text-pe-text-muted cursor-default"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-pe-border/60">
        <p className="pe-label text-[10px] font-semibold uppercase tracking-wider text-pe-text-secondary">
          Bio
        </p>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell investors about your style, experience, and the themes you focus on..."
          rows={4}
          className="pe-input resize-none"
        />
      </div>

      <div className="space-y-3 pt-4 border-t border-pe-border/60">
        <div className="flex items-center justify-between gap-3">
          <p className="pe-label text-[10px] font-semibold uppercase tracking-wider text-pe-text-secondary">
            Links
          </p>
          <button
            type="button"
            onClick={addLink}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-pe-positive hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            Add link
          </button>
        </div>
        {links.length === 0 ? (
          <p className="text-sm text-pe-text-muted">
            No links yet — add LinkedIn, X, your website, Substack, etc.
          </p>
        ) : (
          <ul className="space-y-2">
            {links.map((link) => (
              <li key={link.id} className="flex gap-2">
                <input
                  value={link.label}
                  onChange={(e) => updateLink(link.id, 'label', e.target.value)}
                  placeholder="Label"
                  className="w-28 sm:w-36 pe-input py-2.5"
                />
                <input
                  value={link.url}
                  onChange={(e) => updateLink(link.id, 'url', e.target.value)}
                  placeholder="https://"
                  className="flex-1 pe-input py-2.5"
                />
                <button
                  type="button"
                  onClick={() => removeLink(link.id)}
                  className="p-2.5 text-pe-text-muted hover:text-pe-negative"
                  aria-label="Remove link"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ReferralRow
        referralLink={referralLink}
        referralCount={referralCount}
        copied={copied}
        onCopy={onCopyReferral}
      />
    </>
  );
}

function ReferralRow({ referralLink, referralCount = 0, copied, onCopy }) {
  return (
    <div className="space-y-2 pt-4 border-t border-pe-border/60">
      <div>
        <p className="pe-label text-[10px]">Referral link</p>
        <p className="text-xs text-pe-text-muted mt-1">
          {referralCount === 0
            ? 'No one has joined using your link yet'
            : `${referralCount} ${referralCount === 1 ? 'person has' : 'people have'} joined using your link`}
        </p>
      </div>
      <div className="flex gap-2">
        <input
          readOnly
          value={referralLink}
          aria-label="Your referral link"
          className="flex-1 min-w-0 pe-input py-2.5 text-xs sm:text-sm truncate bg-neutral-50"
        />
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}
