/** Local mock engagement state for portfolios-as-content (profile UI preview). */

const KEY = 'pe_portfolio_social_v2';

const DEFAULTS = {
  likes: 0,
  shares: 0,
  copies: 0,
  comments: [],
  liked: false,
  copied: false,
};

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
    // Migrate from v1 keys if present
    const legacy = localStorage.getItem('pe_portfolio_social_v1');
    if (!legacy) return {};
    const parsed = JSON.parse(legacy);
    const migrated = {};
    for (const [id, entry] of Object.entries(parsed)) {
      migrated[id] = {
        likes: entry.likes ?? 0,
        shares: entry.shares ?? 0,
        copies: entry.followers ?? entry.copies ?? 0,
        comments: entry.comments ?? [],
        liked: entry.liked ?? false,
        copied: entry.following ?? entry.copied ?? false,
      };
    }
    writeAll(migrated);
    return migrated;
  } catch {
    return {};
  }
}

function writeAll(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function seedForPortfolio(portfolioId) {
  const hash = [...portfolioId].reduce((n, c) => n + c.charCodeAt(0), 0);
  return {
    likes: 12 + (hash % 80),
    shares: 3 + (hash % 20),
    copies: 8 + (hash % 120),
    comments: [],
    liked: false,
    copied: false,
  };
}

function getEntry(portfolioId) {
  const all = readAll();
  if (!all[portfolioId]) {
    all[portfolioId] = seedForPortfolio(portfolioId);
    writeAll(all);
  }
  return all[portfolioId];
}

function patch(portfolioId, updater) {
  const all = readAll();
  const current = all[portfolioId] ?? seedForPortfolio(portfolioId);
  all[portfolioId] = updater({ ...current });
  writeAll(all);
  notify();
  return all[portfolioId];
}

const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribePortfolioSocial(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPortfolioSocial(portfolioId) {
  return { ...DEFAULTS, ...getEntry(portfolioId) };
}

export function togglePortfolioLike(portfolioId) {
  return patch(portfolioId, (entry) => {
    const liked = !entry.liked;
    return {
      ...entry,
      liked,
      likes: Math.max(0, (entry.likes ?? 0) + (liked ? 1 : -1)),
    };
  });
}

export function togglePortfolioCopy(portfolioId) {
  return patch(portfolioId, (entry) => {
    const copied = !entry.copied;
    return {
      ...entry,
      copied,
      copies: Math.max(0, (entry.copies ?? 0) + (copied ? 1 : -1)),
    };
  });
}

/** @deprecated use togglePortfolioCopy */
export function togglePortfolioFollow(portfolioId) {
  return togglePortfolioCopy(portfolioId);
}

export function incrementPortfolioShare(portfolioId) {
  return patch(portfolioId, (entry) => ({
    ...entry,
    shares: (entry.shares ?? 0) + 1,
  }));
}

export function addPortfolioComment(portfolioId, text, authorId = 'u_me') {
  const body = text.trim();
  if (!body) return null;
  const comment = {
    id: `pc_${Date.now()}`,
    authorId,
    body,
    createdAt: new Date().toISOString(),
  };
  patch(portfolioId, (entry) => ({
    ...entry,
    comments: [...(entry.comments ?? []), comment],
  }));
  return comment;
}
