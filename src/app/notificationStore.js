import { formatWeightChange, getBasketUpdates } from './basketUpdatesCatalog';
import { catalogBaskets } from './basketCatalog';

const STORAGE_KEY = 'pocketedge_notifications';
const CHANGED_EVENT = 'pocketedge-notifications-changed';

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(notifications) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

function basketName(basketId) {
  return catalogBaskets.find((basket) => basket.id === basketId)?.name || 'Basket';
}

function buildUpdateBody(update) {
  const highlights = update.changes
    .filter((change) => change.action !== 'unchanged')
    .slice(0, 2)
    .map(formatWeightChange);
  return highlights.join(' · ') || update.summary;
}

function buildBasketUpdateNotification(update) {
  return {
    id: `notif-${update.id}`,
    type: 'basket_update',
    basketId: update.basketId,
    updateId: update.id,
    title: `${basketName(update.basketId)} · ${update.title}`,
    body: buildUpdateBody(update),
    read: false,
    createdAt: `${update.date}T12:00:00.000Z`,
  };
}

function pruneDeprecatedNotifications(notifications) {
  return notifications.filter((item) => item.type === 'basket_update' || item.type === 'admin');
}

export function isNotificationVisible(item, subscribedBasketIds) {
  const subscribed = subscribedBasketIds instanceof Set
    ? subscribedBasketIds
    : new Set(subscribedBasketIds);

  if (item.type === 'admin') return true;
  if (item.type === 'basket_update') return subscribed.has(item.basketId);
  return false;
}

export function filterVisibleNotifications(notifications, subscribedBasketIds) {
  return notifications.filter((item) => isNotificationVisible(item, subscribedBasketIds));
}

export function loadNotifications() {
  const existing = pruneDeprecatedNotifications(read());
  if (existing.length !== read().length) write(existing);
  return existing;
}

export function getUnreadNotificationCount(notifications = loadNotifications(), subscribedBasketIds = []) {
  return filterVisibleNotifications(notifications, subscribedBasketIds).filter((item) => !item.read).length;
}

export function markNotificationRead(id) {
  const next = read().map((item) => (item.id === id ? { ...item, read: true } : item));
  write(next);
  return next;
}

export function markAllNotificationsRead() {
  const next = read().map((item) => ({ ...item, read: true }));
  write(next);
  return next;
}

export function markVisibleNotificationsRead(subscribedBasketIds) {
  const visibleIds = new Set(
    filterVisibleNotifications(read(), subscribedBasketIds).map((item) => item.id)
  );
  const next = read().map((item) => (visibleIds.has(item.id) ? { ...item, read: true } : item));
  write(next);
  return next;
}

export function syncSubscribedBasketNotifications(subscribedBasketIds = []) {
  subscribedBasketIds.forEach(ensureBasketUpdateNotifications);
}

/** Create basket-update notifications when a user subscribes to a basket. */
export function ensureBasketUpdateNotifications(basketId) {
  const updates = getBasketUpdates(basketId);
  if (updates.length === 0) return loadNotifications();

  const existing = read();
  const existingIds = new Set(existing.map((item) => item.id));
  const toAdd = updates
    .map(buildBasketUpdateNotification)
    .filter((item) => !existingIds.has(item.id));

  if (toAdd.length === 0) return existing;
  write([...toAdd, ...existing]);
  return read();
}

/** Admin broadcast — always visible to signed-in users. */
export function addAdminNotification({ title, body, id = `admin-${Date.now()}` }) {
  const item = {
    id,
    type: 'admin',
    title,
    body,
    read: false,
    createdAt: new Date().toISOString(),
  };
  write([item, ...read()]);
  return item;
}

export function subscribeNotifications(callback) {
  const handler = () => callback(loadNotifications());
  window.addEventListener(CHANGED_EVENT, handler);
  return () => window.removeEventListener(CHANGED_EVENT, handler);
}

export function getVisibleNotifications(subscribedBasketIds) {
  return filterVisibleNotifications(loadNotifications(), subscribedBasketIds);
}
