const STORAGE_KEY = 'pocketedge_social_activity_read';

function readIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function writeIds(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

let readIdsCache = readIds();
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeActivity(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getReadActivityIds() {
  return readIdsCache;
}

export function isActivityRead(id) {
  return readIdsCache.has(id);
}

export function getUnreadActivityCount(items) {
  return items.filter((item) => !readIdsCache.has(item.id)).length;
}

export function markActivityRead(id) {
  if (readIdsCache.has(id)) return;
  readIdsCache = new Set(readIdsCache);
  readIdsCache.add(id);
  writeIds(readIdsCache);
  notify();
}

export function markAllActivityRead(items) {
  const next = new Set(readIdsCache);
  let changed = false;
  for (const item of items) {
    if (!next.has(item.id)) {
      next.add(item.id);
      changed = true;
    }
  }
  if (!changed) return;
  readIdsCache = next;
  writeIds(readIdsCache);
  notify();
}
