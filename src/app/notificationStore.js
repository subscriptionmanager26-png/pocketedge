import { basketUpdatesCatalog, formatWeightChange } from './basketUpdatesCatalog';
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

function seedNotifications() {
  const seeded = [
    {
      id: 'welcome',
      type: 'platform',
      title: 'Welcome to PocketEdge',
      body: 'Browse baskets, paper-track investments, and get rebalance alerts when you subscribe.',
      read: false,
      createdAt: '2026-06-01T09:00:00.000Z',
    },
    {
      id: 'challenge-live',
      type: 'platform',
      title: 'Market Whisperer challenge is live',
      body: 'Create up to 5 baskets and compete on the leaderboard this month.',
      read: false,
      createdAt: '2026-06-02T08:30:00.000Z',
    },
    ...basketUpdatesCatalog.map((update) => ({
      id: `notif-${update.id}`,
      type: 'basket_update',
      basketId: update.basketId,
      updateId: update.id,
      title: `${basketName(update.basketId)} · ${update.title}`,
      body: buildUpdateBody(update),
      read: false,
      createdAt: `${update.date}T12:00:00.000Z`,
    })),
  ];

  write(seeded);
  return seeded;
}

export function loadNotifications() {
  const existing = read();
  if (existing.length === 0) return seedNotifications();
  return existing;
}

export function getUnreadNotificationCount(notifications = loadNotifications()) {
  return notifications.filter((item) => !item.read).length;
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

export function subscribeNotifications(callback) {
  const handler = () => callback(loadNotifications());
  window.addEventListener(CHANGED_EVENT, handler);
  return () => window.removeEventListener(CHANGED_EVENT, handler);
}

export function getVisibleNotifications(subscribedBasketIds) {
  const subscribed = new Set(subscribedBasketIds);
  return loadNotifications().filter((item) => {
    if (item.type !== 'basket_update') return true;
    return subscribed.has(item.basketId);
  });
}
