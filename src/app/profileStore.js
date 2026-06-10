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

export function loadUserProfile(userId = 'local') {
  const profiles = readAll();
  return { ...emptyProfile(), ...(profiles[userId] || {}) };
}

export function saveUserProfile(userId = 'local', profile) {
  const profiles = readAll();
  profiles[userId] = {
    ...emptyProfile(),
    ...profile,
    links: profile.links || [],
  };
  writeAll(profiles);
  return profiles[userId];
}

export function createLinkId() {
  return `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
