import { ensureBasketUpdateNotifications } from './notificationStore';

const STORAGE_KEY = 'pocketedge_basket_subscriptions';
const CHANGED_EVENT = 'pocketedge-subscriptions-changed';

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

export function loadSubscribedBasketIds() {
  return read();
}

export function isSubscribedToBasket(basketId) {
  return read().includes(basketId);
}

export function subscribeToBasket(basketId) {
  const ids = read();
  if (ids.includes(basketId)) return ids;
  write([basketId, ...ids]);
  ensureBasketUpdateNotifications(basketId);
  return read();
}

export function unsubscribeFromBasket(basketId) {
  write(read().filter((id) => id !== basketId));
}

export function subscribeSubscriptions(callback) {
  const handler = () => callback(read());
  window.addEventListener(CHANGED_EVENT, handler);
  return () => window.removeEventListener(CHANGED_EVENT, handler);
}
