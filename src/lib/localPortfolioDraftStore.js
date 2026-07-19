/** In-browser portfolio drafts — never synced to Supabase. */

const KEY = 'pe_portfolio_drafts_v1';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getLocalDrafts(ownerId) {
  if (!ownerId) return [];
  return readAll()[ownerId] ?? [];
}

export function getLocalDraft(ownerId, portfolioId) {
  return getLocalDrafts(ownerId).find((p) => p.id === portfolioId) ?? null;
}

export function addLocalDraft(ownerId, portfolio) {
  const all = readAll();
  const list = all[ownerId] ?? [];
  all[ownerId] = [portfolio, ...list];
  writeAll(all);
  return portfolio;
}

export function removeLocalDraft(ownerId, portfolioId) {
  const all = readAll();
  const list = all[ownerId];
  if (!list) return false;
  const next = list.filter((p) => p.id !== portfolioId);
  if (next.length === list.length) return false;
  all[ownerId] = next;
  writeAll(all);
  return true;
}

export function clearLocalDrafts(ownerId) {
  const all = readAll();
  if (!all[ownerId]) return;
  delete all[ownerId];
  writeAll(all);
}
