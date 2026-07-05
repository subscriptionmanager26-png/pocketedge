import { MY_PORTFOLIO } from '../data/mockData';

const WATCHLIST_KEY = 'pe_social_watchlists';

const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

function readWatchlists() {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  return MY_PORTFOLIO.watchlists.map((w) => ({ ...w }));
}

function writeWatchlists(lists) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(lists));
  emit();
}

export function subscribeWatchlists(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWatchlists() {
  return readWatchlists();
}

export function addWatchlist({ name, tickers = [] }) {
  const lists = readWatchlists();
  const created = {
    id: `wl_${Date.now()}`,
    name: name.trim() || 'Untitled list',
    tickers: tickers.filter(Boolean),
  };
  lists.push(created);
  writeWatchlists(lists);
  return created;
}

export function clearWatchlists() {
  localStorage.removeItem(WATCHLIST_KEY);
  emit();
}
