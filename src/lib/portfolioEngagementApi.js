import { supabase, isSupabaseConfigured } from './supabase';
import { getAppCurrentUserId } from './socialIdentity';
import { skipAuthForDev } from './sessionStore';
import * as localStore from './portfolioSocialStore';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SYNC_DEBOUNCE_MS = 500;

const engagementCache = new Map();
const listeners = new Set();

/** @type {Map<string, { desired: boolean, synced: boolean, timer: ReturnType<typeof setTimeout> | null, syncing: boolean }>} */
const likeSyncByPortfolio = new Map();
/** @type {Map<string, { desired: boolean, synced: boolean, timer: ReturnType<typeof setTimeout> | null, syncing: boolean }>} */
const copySyncByPortfolio = new Map();

function emit() {
  listeners.forEach((fn) => fn());
}

export function isBackendPortfolioId(portfolioId) {
  return UUID_RE.test(String(portfolioId ?? ''));
}

function useBackend(portfolioId) {
  return isSupabaseConfigured() && !skipAuthForDev() && isBackendPortfolioId(portfolioId);
}

function mapRemoteEngagement(data, comments = []) {
  return {
    likes: data.likes ?? 0,
    shares: data.shares ?? 0,
    copies: data.copies ?? 0,
    comments,
    liked: data.liked ?? false,
    copied: data.copied ?? false,
    unreadComments: data.unread_comments ?? 0,
  };
}

function getSyncMap(kind) {
  return kind === 'like' ? likeSyncByPortfolio : copySyncByPortfolio;
}

function ensureSyncState(portfolioId, kind, syncedValue) {
  const map = getSyncMap(kind);
  let state = map.get(portfolioId);
  if (!state) {
    state = { desired: syncedValue, synced: syncedValue, timer: null, syncing: false };
    map.set(portfolioId, state);
  }
  return state;
}

function hasPendingSync(portfolioId, kind) {
  const state = getSyncMap(kind).get(portfolioId);
  return Boolean(state && (state.timer != null || state.desired !== state.synced));
}

function noteServerSynced(portfolioId, data) {
  for (const [kind, value] of [
    ['like', data.liked ?? false],
    ['copy', data.copied ?? false],
  ]) {
    const map = getSyncMap(kind);
    const state = map.get(portfolioId);
    if (!state) {
      map.set(portfolioId, {
        desired: value,
        synced: value,
        timer: null,
        syncing: false,
      });
      continue;
    }
    if (!hasPendingSync(portfolioId, kind)) {
      state.desired = value;
      state.synced = value;
    } else {
      state.synced = value;
    }
  }
}

function setCachedEngagement(portfolioId, data, { fromServer = false } = {}) {
  let next = data;

  if (fromServer && engagementCache.has(portfolioId)) {
    const cached = engagementCache.get(portfolioId);
    next = { ...data };
    if (hasPendingSync(portfolioId, 'like')) {
      next.liked = cached.liked;
      next.likes = cached.likes;
    }
    if (hasPendingSync(portfolioId, 'copy')) {
      next.copied = cached.copied;
      next.copies = cached.copies;
    }
  }

  engagementCache.set(portfolioId, next);
  if (fromServer) noteServerSynced(portfolioId, data);
  emit();
}

function applyOptimisticToggle(portfolioId, field) {
  const current = getPortfolioEngagementSync(portfolioId);
  const isLike = field === 'liked';
  const nextFlag = !current[field];
  const countKey = isLike ? 'likes' : 'copies';
  const next = {
    ...current,
    [field]: nextFlag,
    [countKey]: Math.max(0, (current[countKey] ?? 0) + (nextFlag ? 1 : -1)),
  };
  setCachedEngagement(portfolioId, next);
  return next;
}

function revertOptimisticToggle(portfolioId, field) {
  const kind = field === 'liked' ? 'like' : 'copy';
  const state = getSyncMap(kind).get(portfolioId);
  if (!state) return getPortfolioEngagementSync(portfolioId);

  const current = getPortfolioEngagementSync(portfolioId);
  const countKey = field === 'liked' ? 'likes' : 'copies';
  const reverted = {
    ...current,
    [field]: state.synced,
    [countKey]: Math.max(
      0,
      (current[countKey] ?? 0) - (current[field] ? 1 : 0) + (state.synced ? 1 : 0)
    ),
  };
  setCachedEngagement(portfolioId, reverted);

  state.desired = state.synced;
  getSyncMap(kind).set(portfolioId, state);
  return reverted;
}

function scheduleDebouncedSync(portfolioId, kind) {
  const map = getSyncMap(kind);
  const field = kind === 'like' ? 'liked' : 'copied';
  const rpc = kind === 'like' ? 'toggle_portfolio_like' : 'toggle_portfolio_copy';
  const current = getPortfolioEngagementSync(portfolioId);
  const state = ensureSyncState(portfolioId, kind, current[field]);

  state.desired = current[field];
  if (state.timer) clearTimeout(state.timer);

  state.timer = setTimeout(() => {
    state.timer = null;
    void flushDebouncedSync(portfolioId, kind, rpc, field);
  }, SYNC_DEBOUNCE_MS);
}

async function flushDebouncedSync(portfolioId, kind, rpc, field) {
  const map = getSyncMap(kind);
  const state = map.get(portfolioId);
  if (!state || state.desired === state.synced || state.syncing) return;

  state.syncing = true;
  try {
    const { error } = await supabase.rpc(rpc, { p_portfolio_id: portfolioId });
    if (error) throw error;
    state.synced = state.desired;
  } catch (err) {
    console.error(`${rpc} failed`, err);
    revertOptimisticToggle(portfolioId, field);
  } finally {
    state.syncing = false;
    if (state.desired !== state.synced) {
      scheduleDebouncedSync(portfolioId, kind);
    }
  }
}

export async function fetchPortfolioEngagement(portfolioId) {
  if (!useBackend(portfolioId)) {
    const local = localStore.getPortfolioSocial(portfolioId);
    setCachedEngagement(portfolioId, local);
    return local;
  }

  const { data, error } = await supabase.rpc('get_portfolio_engagement', {
    p_portfolio_id: portfolioId,
  });
  if (error) throw error;

  const { data: comments, error: commentsError } = await supabase
    .from('social_portfolio_comments')
    .select('id, author_id, body, created_at')
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: true });

  if (commentsError) throw commentsError;

  const mapped = mapRemoteEngagement(
    data,
    (comments ?? []).map((row) => ({
      id: row.id,
      authorId: row.author_id,
      body: row.body,
      createdAt: row.created_at,
    }))
  );
  setCachedEngagement(portfolioId, mapped, { fromServer: true });
  return getPortfolioEngagementSync(portfolioId);
}

export async function loadPortfolioEngagement(portfolioId) {
  try {
    return await fetchPortfolioEngagement(portfolioId);
  } catch (err) {
    console.error('loadPortfolioEngagement failed', err);
    return getPortfolioEngagementSync(portfolioId);
  }
}

export async function prefetchPortfoliosEngagement(portfolioIds = []) {
  const ids = portfolioIds.filter((id) => isBackendPortfolioId(id));
  if (!ids.length) return;
  await Promise.all(ids.map((id) => loadPortfolioEngagement(id)));
}

export function togglePortfolioLike(portfolioId) {
  if (!useBackend(portfolioId)) {
    const next = localStore.togglePortfolioLike(portfolioId);
    setCachedEngagement(portfolioId, localStore.getPortfolioSocial(portfolioId));
    return next;
  }

  const next = applyOptimisticToggle(portfolioId, 'liked');
  scheduleDebouncedSync(portfolioId, 'like');
  return next;
}

export function togglePortfolioCopy(portfolioId) {
  if (!useBackend(portfolioId)) {
    localStore.togglePortfolioCopy(portfolioId);
    setCachedEngagement(portfolioId, localStore.getPortfolioSocial(portfolioId));
    return localStore.getPortfolioSocial(portfolioId);
  }

  const next = applyOptimisticToggle(portfolioId, 'copied');
  scheduleDebouncedSync(portfolioId, 'copy');
  return next;
}

/** True once server has confirmed copy (for side effects like duplicating a portfolio). */
export async function confirmPortfolioCopy(portfolioId) {
  if (!useBackend(portfolioId)) {
    return getPortfolioEngagementSync(portfolioId);
  }

  const state = copySyncByPortfolio.get(portfolioId);
  if (!state || state.desired === state.synced) {
    return getPortfolioEngagementSync(portfolioId);
  }

  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
    await flushDebouncedSync(portfolioId, 'copy', 'toggle_portfolio_copy', 'copied');
  } else if (state.syncing) {
    await new Promise((resolve) => {
      const check = () => {
        const current = copySyncByPortfolio.get(portfolioId);
        if (!current?.syncing) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  }

  return getPortfolioEngagementSync(portfolioId);
}

export async function recordPortfolioShare(portfolioId) {
  if (!useBackend(portfolioId)) {
    localStore.incrementPortfolioShare(portfolioId);
    setCachedEngagement(portfolioId, localStore.getPortfolioSocial(portfolioId));
    return localStore.getPortfolioSocial(portfolioId);
  }

  const current = getPortfolioEngagementSync(portfolioId);
  const next = { ...current, shares: (current.shares ?? 0) + 1 };
  setCachedEngagement(portfolioId, next);

  try {
    const { error } = await supabase.rpc('record_portfolio_share', {
      p_portfolio_id: portfolioId,
    });
    if (error) throw error;
  } catch (err) {
    console.error('recordPortfolioShare failed', err);
    setCachedEngagement(portfolioId, current);
  }

  return getPortfolioEngagementSync(portfolioId);
}

export async function addPortfolioComment(portfolioId, text) {
  const body = text.trim();
  if (!body) return getPortfolioEngagementSync(portfolioId);

  if (!useBackend(portfolioId)) {
    localStore.addPortfolioComment(portfolioId, body);
    setCachedEngagement(portfolioId, localStore.getPortfolioSocial(portfolioId));
    return localStore.getPortfolioSocial(portfolioId);
  }

  const current = getPortfolioEngagementSync(portfolioId);
  const optimisticComment = {
    id: `pending_${Date.now()}`,
    authorId: getAppCurrentUserId(),
    body,
    createdAt: new Date().toISOString(),
    pending: true,
  };
  setCachedEngagement(portfolioId, {
    ...current,
    comments: [...(current.comments ?? []), optimisticComment],
  });

  try {
    const { error } = await supabase.rpc('add_portfolio_comment', {
      p_portfolio_id: portfolioId,
      p_body: body,
    });
    if (error) throw error;
    return fetchPortfolioEngagement(portfolioId);
  } catch (err) {
    console.error('addPortfolioComment failed', err);
    setCachedEngagement(portfolioId, current);
    throw err;
  }
}

export async function markPortfolioCommentsRead(portfolioId) {
  if (!useBackend(portfolioId)) {
    localStore.markPortfolioCommentsRead(portfolioId);
    const local = localStore.getPortfolioSocial(portfolioId);
    setCachedEngagement(portfolioId, local);
    return local;
  }

  const current = getPortfolioEngagementSync(portfolioId);
  if ((current.unreadComments ?? 0) === 0) return current;

  setCachedEngagement(portfolioId, { ...current, unreadComments: 0 });

  try {
    const { error } = await supabase.rpc('mark_portfolio_comments_read', {
      p_portfolio_id: portfolioId,
    });
    if (error) throw error;
  } catch (err) {
    console.error('markPortfolioCommentsRead failed', err);
    setCachedEngagement(portfolioId, current);
  }

  return getPortfolioEngagementSync(portfolioId);
}

export function subscribePortfolioEngagement(listener) {
  listeners.add(listener);
  const unsubLocal = localStore.subscribePortfolioSocial(listener);
  return () => {
    listeners.delete(listener);
    unsubLocal();
  };
}

export function getPortfolioEngagementSync(portfolioId) {
  if (engagementCache.has(portfolioId)) {
    return engagementCache.get(portfolioId);
  }
  return localStore.getPortfolioSocial(portfolioId);
}

export function clearPortfolioEngagementCache() {
  engagementCache.clear();
  likeSyncByPortfolio.clear();
  copySyncByPortfolio.clear();
  emit();
}
