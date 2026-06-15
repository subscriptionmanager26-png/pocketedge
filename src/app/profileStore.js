import {
  ensureCreatorProfileFromAuth,
  fetchCreatorProfile,
  isDbUserId,
  profileHasContent,
  saveCreatorProfile,
} from './userDataApi';

const STORAGE_KEY = 'pocketedge_user_profiles';

const emptyProfile = () => ({
  name: '',
  bio: '',
  avatarUrl: '',
  links: [],
});

function isHugeDataUrl(url) {
  return typeof url === 'string' && url.startsWith('data:') && url.length > 500_000;
}

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(profiles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function readMergedLocalProfile(userId) {
  const profiles = readAll();
  const local = profiles.local || {};
  const owned = profiles[userId] || {};

  return {
    ...emptyProfile(),
    ...local,
    ...owned,
    name: owned.name?.trim() || local.name?.trim() || '',
    bio: owned.bio?.trim() || local.bio?.trim() || '',
    avatarUrl: owned.avatarUrl || local.avatarUrl || '',
    links: owned.links?.length ? owned.links : local.links || [],
  };
}

function clearLocalProfiles(userId) {
  const profiles = readAll();
  delete profiles[userId];
  delete profiles.local;
  writeAll(profiles);
}

async function saveProfileResilient(userId, profile) {
  try {
    return await saveCreatorProfile(userId, profile);
  } catch (err) {
    if (!profile.avatarUrl || !profile.avatarUrl.startsWith('data:')) throw err;
    return saveCreatorProfile(userId, { ...profile, avatarUrl: '' });
  }
}

/** Sync read — local demo only. Prefer loadUserProfileAsync when signed in. */
export function loadUserProfile(userId = 'local') {
  const profiles = readAll();
  return { ...emptyProfile(), ...(profiles[userId] || {}) };
}

export async function loadUserProfileAsync(userId = 'local') {
  if (isDbUserId(userId)) {
    const profile = await fetchCreatorProfile(userId);
    return { ...emptyProfile(), ...(profile || {}) };
  }
  return loadUserProfile(userId);
}

export async function saveUserProfile(userId = 'local', profile) {
  const payload = {
    ...emptyProfile(),
    ...profile,
    links: profile.links || [],
  };

  if (isHugeDataUrl(payload.avatarUrl)) {
    payload.avatarUrl = '';
  }

  if (isDbUserId(userId)) {
    return saveProfileResilient(userId, payload);
  }

  const profiles = readAll();
  profiles[userId] = payload;
  writeAll(profiles);
  return profiles[userId];
}

export function createLinkId() {
  return `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Import local profile (user id + legacy `local` key), then seed from Google if DB is empty.
 */
export async function migrateLocalProfileToDb(userId, authUser = null) {
  if (!isDbUserId(userId)) return loadUserProfile(userId);

  const merged = readMergedLocalProfile(userId);

  if (profileHasContent(merged)) {
    const toSave = isHugeDataUrl(merged.avatarUrl)
      ? { ...merged, avatarUrl: '' }
      : merged;
    await saveProfileResilient(userId, toSave);
    clearLocalProfiles(userId);
  } else {
    await ensureCreatorProfileFromAuth(authUser);
  }

  return loadUserProfileAsync(userId);
}
