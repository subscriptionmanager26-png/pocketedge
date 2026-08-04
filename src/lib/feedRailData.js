import {
  fetchMarketPreview,
  loadSearchIndex,
  lookupMarketAssetsBatch,
  resolveMarketIndex,
} from './marketDataApi';
import { rankMostWatchedSecurities } from './ideaSecurities';
import { fetchFeedPosts, fetchPublicFeedPosts, usePostBackend } from './socialPostApi';
import { supabase, isSupabaseConfigured } from './supabase';
import { skipAuthForDev } from './sessionStore';
import { PEOPLE } from '../data/mockData';
import { isFollowing } from './socialGraphStore';
import { getRailIndexIds, getRailSectorIds } from './feedRailPrefs';

const OVERVIEW_INDEX_IDS = ['NIFTY 50', 'NIFTY 500'];

function useBackend() {
  return isSupabaseConfigured() && !skipAuthForDev();
}

function formatIndexValue(item) {
  const price = item?.price ?? item?.value;
  if (price == null || !Number.isFinite(Number(price))) return '—';
  return Number(price).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function toRailIndexRow(item) {
  if (!item) return null;
  const id = String(item.id || item.symbol || '').trim();
  if (!id) return null;
  return {
    id,
    symbol: item.symbol || id,
    name: item.name || item.symbol || id,
    group: item.group || '',
    value: formatIndexValue(item),
    changePct: item.changePct,
    assetType: 'index',
  };
}

async function resolveIndexRows(ids, { force = false } = {}) {
  if (!ids.length) return [];

  // Prefer one batch (and bypass stale client cache when force) so Overview
  // shows the post-close / CAS settlement levels rather than a mid-session hit.
  if (force) {
    try {
      const batch = await lookupMarketAssetsBatch(ids, { force: true });
      const rows = ids.map((id) => {
        const item =
          batch.get(id) ??
          batch.get(String(id).toUpperCase()) ??
          batch.get(String(id).toLowerCase());
        return item?.assetType === 'index' || item?.assetType == null
          ? toRailIndexRow(item)
          : null;
      });
      if (rows.some(Boolean)) return rows.filter(Boolean);
    } catch {
      /* fall through */
    }
  }

  const rows = await Promise.all(
    ids.map(async (id) => {
      try {
        return toRailIndexRow(await resolveMarketIndex(id));
      } catch {
        return null;
      }
    })
  );
  return rows.filter(Boolean);
}

export async function loadRailOverviewIndices() {
  return resolveIndexRows(OVERVIEW_INDEX_IDS, { force: true });
}

export async function loadRailTrackedIndices() {
  return resolveIndexRows(getRailIndexIds(), { force: true });
}

export async function loadRailTrackedSectors() {
  return resolveIndexRows(getRailSectorIds(), { force: true });
}

/** Catalog for pickers — prefer search index (full set, light payload). */
export async function loadIndexCatalog() {
  try {
    const items = await loadSearchIndex('indices');
    return (items ?? [])
      .map((item) => ({
        id: String(item.id || item.symbol || '').trim(),
        name: item.name || item.symbol || item.id,
        symbol: item.symbol || item.id,
        group: item.group || '',
      }))
      .filter((item) => item.id);
  } catch {
    return [];
  }
}

export function isSectoralIndex(item) {
  return String(item?.group ?? '')
    .toUpperCase()
    .includes('SECTORAL');
}

export function isBroadOrDerivativesIndex(item) {
  const group = String(item?.group ?? '').toUpperCase();
  return (
    group.includes('BROAD MARKET') ||
    group.includes('DERIVATIVES') ||
    group.includes('STRATEGY') ||
    group.includes('THEMATIC')
  );
}

/** Top performers = largest positive 1D moves. */
export async function loadRailTrending(limit = 5) {
  const payload = await fetchMarketPreview('stocks').catch(() => null);
  const items = (payload?.items ?? []).filter(
    (item) => item?.changePct != null && Number(item.changePct) > 0
  );
  const ranked = rankMostWatchedSecurities(items, limit);
  return {
    live: payload?.source === 'rpc',
    items: ranked.map((item) => ({
      ticker: item.symbol || item.id || '—',
      name: item.name || item.symbol || 'Stock',
      changePct: item.changePct,
      assetType: item.assetType || 'stock',
      logoIconUrl: item.logoIconUrl ?? null,
      seed: item,
    })),
  };
}

function discussionTitle(post) {
  const raw = String(post?.body ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return 'Untitled discussion';
  return raw.length > 96 ? `${raw.slice(0, 96).trim()}…` : raw;
}

export async function loadRailDiscussions(limit = 4, { guestMode = false } = {}) {
  let posts = [];
  try {
    if (guestMode || !usePostBackend()) {
      posts = await fetchPublicFeedPosts({ limit: 80 });
    } else {
      posts = await fetchFeedPosts({ limit: 80 });
    }
  } catch {
    posts = [];
  }

  return [...posts]
    .sort((a, b) => {
      const likeDelta = Number(b.likes ?? 0) - Number(a.likes ?? 0);
      if (likeDelta !== 0) return likeDelta;
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    })
    .slice(0, limit)
    .map((post) => ({
      id: post.id,
      title: discussionTitle(post),
      likes: Number(post.likes ?? 0),
      replies: Number(post.commentCount ?? post.comments?.length ?? 0),
      createdAt: post.createdAt,
    }));
}

export async function loadRailPeople(limit = 4) {
  if (useBackend()) {
    try {
      const { data, error } = await supabase.rpc('list_suggested_people', {
        p_limit: limit,
      });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      return rows.map((row) => {
        const id = String(row.user_id ?? row.userId ?? '');
        const name = row.display_name || row.displayName || row.username || 'Investor';
        return {
          id,
          name,
          handle: row.username || '',
          avatar: String(name).trim().charAt(0).toUpperCase() || '?',
          avatarUrl: row.avatar_url ?? row.avatarUrl ?? null,
          role: row.focus || 'Investor',
          followerCount: Number(row.follower_count ?? row.followerCount ?? 0),
          following: isFollowing(id),
        };
      });
    } catch (err) {
      console.warn('list_suggested_people failed', err);
    }
  }

  // Mock / offline fallback — prefer people with more followers, then id as join proxy.
  return [...PEOPLE]
    .map((p) => ({
      id: p.id,
      name: p.name,
      handle: p.handle,
      avatar: (p.name || '?').trim().charAt(0).toUpperCase(),
      avatarUrl: null,
      role: p.focus || p.role || 'Investor',
      followerCount: Number(p.followers ?? 0),
      following: isFollowing(p.id),
    }))
    .sort((a, b) => {
      const d = b.followerCount - a.followerCount;
      if (d !== 0) return d;
      return String(b.id).localeCompare(String(a.id));
    })
    .slice(0, limit);
}
