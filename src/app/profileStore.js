import { fetchCreatorProfile, isDbUserId, saveCreatorProfile } from './userDataApi';

const STORAGE_KEY = 'pocketedge_user_profiles';

const emptyProfile = () => ({
  name: '',
  bio: '',
  avatarUrl: '',
  links: [],
});

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

  if (isDbUserId(userId)) {
    return saveCreatorProfile(userId, payload);
  }

  const profiles = readAll();
  profiles[userId] = payload;
  writeAll(profiles);
  return profiles[userId];
}

export function createLinkId() {
  return `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** One-time import of local profile after first sign-in. */
export async function migrateLocalProfileToDb(userId) {
  if (!isDbUserId(userId)) return loadUserProfile(userId);

  const local = loadUserProfile(userId);
  const hasContent =
    local.name?.trim() ||
    local.bio?.trim() ||
    local.avatarUrl ||
    (local.links || []).some((l) => l.label?.trim() || l.url?.trim());

  if (hasContent) {
    await saveCreatorProfile(userId, local);
    const profiles = readAll();
    delete profiles[userId];
    writeAll(profiles);
  }

  return loadUserProfileAsync(userId);
}
