import { CURRENT_USER, addUserPortfolio, getUserPortfolios } from '../data/mockData';

const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

function readWatchlists() {
  return getUserPortfolios(CURRENT_USER.id)
    .filter((p) => p.kind === 'watchlist')
    .map((p) => ({
      id: p.id,
      name: p.name,
      tickers: p.tickers ?? [],
    }));
}

export function subscribeWatchlists(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWatchlists() {
  return readWatchlists();
}

export function addWatchlist({ name, tickers = [] }) {
  const created = addUserPortfolio(CURRENT_USER.id, {
    id: `wl_${Date.now()}`,
    kind: 'watchlist',
    name: name.trim() || 'Untitled list',
    objective: 'Track ideas before adding to live portfolios.',
    thesis: '',
    tickers: tickers.filter(Boolean),
    holdings: [],
  });
  emit();
  return {
    id: created.id,
    name: created.name,
    tickers: created.tickers ?? [],
  };
}

export function clearWatchlists() {
  // No-op clear for unified in-memory portfolio source.
  emit();
}
