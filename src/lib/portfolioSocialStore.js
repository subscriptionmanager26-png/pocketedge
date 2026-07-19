/** Local mock engagement state for portfolios-as-content (profile UI preview). */

import { isDevMockMode } from './appMode';

const KEY = 'pe_portfolio_social_v2';
const READ_KEY = 'pe_portfolio_comments_read_v2';

const DEFAULTS = {
  likes: 0,
  shares: 0,
  copies: 0,
  comments: [],
  liked: false,
  copied: false,
  unreadComments: 0,
};

function writeAll(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

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

function readReadState() {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeReadState(data) {
  localStorage.setItem(READ_KEY, JSON.stringify(data));
}

function countUnreadComments(portfolioId, comments = []) {
  const readAt = readReadState()[portfolioId];
  if (!readAt) {
    // Demo: treat existing comments as unread until first open.
    return comments.filter((c) => c.authorId !== 'u_me').length;
  }
  const cutoff = new Date(readAt).getTime();
  return comments.filter(
    (c) => c.authorId !== 'u_me' && new Date(c.createdAt).getTime() > cutoff
  ).length;
}

function withUnread(entry, portfolioId) {
  return {
    ...entry,
    unreadComments: countUnreadComments(portfolioId, entry.comments ?? []),
  };
}

function seedForPortfolio(portfolioId) {
  if (import.meta.env.PROD) {
    return { ...DEFAULTS };
  }
  const hash = [...portfolioId].reduce((n, c) => n + c.charCodeAt(0), 0);
  const demoComments =
    portfolioId === 'pf_diversified'
      ? [
          {
            id: 'pc_demo_1',
            authorId: 'u1',
            body: 'How are you weighting the financials sleeve here?',
            createdAt: new Date(Date.now() - 3_600_000).toISOString(),
          },
          {
            id: 'pc_demo_2',
            authorId: 'u2',
            body: 'Strong picks - would love to see the rebalance rules.',
            createdAt: new Date(Date.now() - 8_640_000).toISOString(),
          },
        ]
      : portfolioId === 'pf_dividend'
        ? [
            {
              id: 'pc_demo_3',
              authorId: 'u1',
              body: 'Dividend yield looks solid. Any plans to add PSU banks?',
              createdAt: new Date(Date.now() - 1_800_000).toISOString(),
            },
          ]
        : [];

  return {
    likes: 12 + (hash % 80),
    shares: 3 + (hash % 20),
    copies: 8 + (hash % 120),
    comments: demoComments,
    liked: false,
    copied: false,
  };
}

function mergeDemoSeed(portfolioId, entry) {
  if (!isDevMockMode()) return entry;
  const seeded = seedForPortfolio(portfolioId);
  if (!seeded.comments?.length) return entry;

  const byId = new Map((entry.comments ?? []).map((comment) => [comment.id, comment]));
  let changed = false;
  for (const comment of seeded.comments) {
    if (!byId.has(comment.id)) {
      byId.set(comment.id, comment);
      changed = true;
    }
  }
  if (!changed) return entry;
  return { ...entry, comments: [...byId.values()] };
}

function getEntry(portfolioId) {
  const all = readAll();
  if (!all[portfolioId]) {
    all[portfolioId] = isDevMockMode() ? seedForPortfolio(portfolioId) : { ...DEFAULTS };
    writeAll(all);
    return all[portfolioId];
  }

  const merged = mergeDemoSeed(portfolioId, all[portfolioId]);
  if (merged !== all[portfolioId]) {
    all[portfolioId] = merged;
    writeAll(all);
  }
  return all[portfolioId];
}

function patch(portfolioId, updater) {
  const all = readAll();
  const current = all[portfolioId] ?? (isDevMockMode() ? seedForPortfolio(portfolioId) : { ...DEFAULTS });
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
  return withUnread({ ...DEFAULTS, ...getEntry(portfolioId) }, portfolioId);
}

export function markPortfolioCommentsRead(portfolioId) {
  const state = readReadState();
  state[portfolioId] = new Date().toISOString();
  writeReadState(state);
  notify();
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
