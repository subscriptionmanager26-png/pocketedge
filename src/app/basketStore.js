import {
  fetchUserBaskets,
  isDbUserId,
  saveBasketToDb,
} from './userDataApi';

const STORAGE_KEY = 'pocketedge_user_baskets';

export const MAX_USER_BASKETS = 10;

export function canCreateBasket(baskets) {
  return baskets.length < MAX_USER_BASKETS;
}

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal(baskets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(baskets));
}

/** Sync read — local demo only. Prefer loadUserBasketsAsync when signed in. */
export function loadUserBaskets() {
  return readLocal();
}

export async function loadUserBasketsAsync(userId) {
  if (isDbUserId(userId)) {
    return fetchUserBaskets(userId);
  }
  return readLocal();
}

export async function saveUserBasket(basket, userId, { previousVersion = null } = {}) {
  if (isDbUserId(userId)) {
    return saveBasketToDb(userId, basket, { previousVersion });
  }

  const baskets = readLocal();
  const idx = baskets.findIndex((b) => b.id === basket.id);
  if (idx < 0 && baskets.length >= MAX_USER_BASKETS) {
    throw new Error(`You can create a maximum of ${MAX_USER_BASKETS} baskets.`);
  }
  if (idx >= 0) baskets[idx] = basket;
  else baskets.unshift(basket);
  writeLocal(baskets);
  return basket;
}

export function deleteUserBasket(id) {
  writeLocal(readLocal().filter((b) => b.id !== id));
}

export function createBasketId() {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** One-time import of local baskets after first sign-in. */
export async function migrateLocalBasketsToDb(userId) {
  if (!isDbUserId(userId)) return [];

  const local = readLocal();
  if (!local.length) return fetchUserBaskets(userId);

  const migrated = [];
  for (const basket of local) {
    try {
      const saved = await saveBasketToDb(userId, basket);
      migrated.push(saved);
    } catch {
      // skip baskets that fail validation or hit limit
    }
  }

  if (migrated.length) {
    localStorage.removeItem(STORAGE_KEY);
  }

  const remote = await fetchUserBaskets(userId);
  return remote.length ? remote : migrated;
}
