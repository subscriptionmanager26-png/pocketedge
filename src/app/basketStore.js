const STORAGE_KEY = 'pocketedge_user_baskets';

export const MAX_USER_BASKETS = 5;

export function canCreateBasket(baskets) {
  return baskets.length < MAX_USER_BASKETS;
}

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(baskets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(baskets));
}

export function loadUserBaskets() {
  return read();
}

export function saveUserBasket(basket) {
  const baskets = read();
  const idx = baskets.findIndex((b) => b.id === basket.id);
  if (idx < 0 && baskets.length >= MAX_USER_BASKETS) {
    throw new Error(`You can create a maximum of ${MAX_USER_BASKETS} baskets.`);
  }
  if (idx >= 0) baskets[idx] = basket;
  else baskets.unshift(basket);
  write(baskets);
  return basket;
}

export function deleteUserBasket(id) {
  write(read().filter((b) => b.id !== id));
}

export function createBasketId() {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
