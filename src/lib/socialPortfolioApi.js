import {
  CURRENT_USER,
  addUserPortfolio,
  applyPortfolioHoldingsUpdate,
  deleteUserPortfolio,
  enrichUserPortfolio,
  getPerson,
  getUserPortfolio,
  getUserPortfolios,
  USER_PORTFOLIOS,
} from '../data/mockData';
import { enrichPortfolioHoldingsLogos } from './portfolioAssetUniverse';
import { supabase, isSupabaseConfigured } from './supabase';
import { skipAuthForDev } from './sessionStore';
import { isBackendPortfolioId } from './portfolioEngagementApi';
import {
  addLocalDraft,
  getLocalDraft,
  getLocalDrafts,
  removeLocalDraft,
} from './localPortfolioDraftStore';
import { invalidateAuthorPositions } from './authorPositionsStore';
import { cachedFetch, invalidateCache, getCached, setCached } from './queryCache';
import { peekPortfoliosCache, writePortfoliosCache, invalidatePortfoliosTabCache } from './tabCache';

const PORTFOLIOS_TTL_MS = 45_000;

function useBackend() {
  return isSupabaseConfigured() && !skipAuthForDev();
}

function invalidatePortfolioCaches(ownerId) {
  invalidateCache('user-portfolios', ownerId);
  invalidateAuthorPositions(ownerId);
  invalidatePortfoliosTabCache(ownerId);
}

/** Sync peek for instant paint; null if cold. */
export function peekUserPortfolios(ownerId) {
  if (!useBackend()) return null;
  const mem = getCached('user-portfolios', ownerId, PORTFOLIOS_TTL_MS);
  if (mem !== undefined) return mem;
  const session = peekPortfoliosCache(ownerId);
  if (!Array.isArray(session) || !session.length) return null;
  return session.map(mapRpcRow);
}

export function isLocalDraftId(portfolioId) {
  return String(portfolioId ?? '').startsWith('pf_local_');
}

function mapRpcRow(row) {
  if (!row) return null;
  const totalReturnPct = Number(row.total_return_pct ?? row.totalReturnPct);
  const portfolio = {
    id: row.id,
    kind: row.kind ?? 'live',
    isDraft: false,
    isArchived: row.is_archived ?? false,
    name: row.name ?? '',
    objective: row.objective ?? '',
    thesis: row.thesis ?? '',
    sourcePortfolioId: row.source_portfolio_id ?? null,
    sourceUserId: row.source_user_id ?? null,
    sourcePortfolioName: row.source_portfolio_name ?? null,
    sourceUserName: row.source_user_name ?? null,
    watchlistBaseInvestment: row.watchlist_base_investment ?? null,
    tickers: row.tickers ?? [],
    holdings: row.holdings ?? [],
    // Present on public (non-owner) payloads; owner rows omit and derive client-side.
    totalReturnPct: Number.isFinite(totalReturnPct) ? totalReturnPct : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  const enriched = enrichUserPortfolio(portfolio);
  if (portfolio.totalReturnPct != null && !Number.isFinite(Number(enriched.totalPnlPct))) {
    enriched.totalPnlPct = portfolio.totalReturnPct;
  }
  if (portfolio.totalReturnPct != null) {
    enriched.totalReturnPct = portfolio.totalReturnPct;
  }
  return enriched;
}

async function enrichPortfolioRowLogos(portfolio) {
  if (!portfolio?.holdings?.length) return portfolio;
  const holdings = await enrichPortfolioHoldingsLogos(portfolio.holdings);
  if (holdings === portfolio.holdings) return portfolio;
  return enrichUserPortfolio({ ...portfolio, holdings });
}

function mapTableRow(row) {
  return mapRpcRow(row);
}

function blankDraft(ownerId) {
  return enrichUserPortfolio({
    id: `pf_local_${Date.now()}`,
    ownerId,
    kind: 'live',
    isDraft: true,
    name: 'My portfolio',
    objective: '',
    thesis: '',
    totalValue: 0,
    invested: 0,
    totalPnlPct: 0,
    xirr: 0,
    holdings: [],
    tickers: [],
  });
}

export async function fetchUserPortfolios(ownerId, { force = false } = {}) {
  if (!useBackend()) {
    return getUserPortfolios(ownerId);
  }

  if (force) {
    invalidateCache('user-portfolios', ownerId);
  }

  return cachedFetch('user-portfolios', ownerId, PORTFOLIOS_TTL_MS, async () => {
    const drafts = getLocalDrafts(ownerId).map(enrichUserPortfolio);

    const { data, error } = await supabase.rpc('list_user_portfolios', {
      p_owner_id: ownerId,
    });

    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    const mapped = rows.map(mapRpcRow);
    const immediate = [...drafts, ...mapped];
    writePortfoliosCache(ownerId, immediate);

    Promise.all(mapped.map((p) => enrichPortfolioRowLogos(p)))
      .then((withLogos) => {
        const enriched = [...drafts, ...withLogos];
        setCached('user-portfolios', ownerId, enriched);
        writePortfoliosCache(ownerId, enriched);
      })
      .catch(() => {});

    return immediate;
  });
}

export async function fetchUserPortfolio(ownerId, portfolioId) {
  if (isLocalDraftId(portfolioId)) {
    const draft = getLocalDraft(ownerId, portfolioId);
    return draft ? enrichUserPortfolio(draft) : null;
  }

  if (!useBackend() || !isBackendPortfolioId(portfolioId)) {
    return getUserPortfolio(ownerId, portfolioId);
  }

  const { data, error } = await supabase.rpc('get_user_portfolio', {
    p_owner_id: ownerId,
    p_portfolio_id: portfolioId,
  });

  if (error) throw error;
  const portfolio = data ? mapRpcRow(data) : null;
  if (!portfolio) return null;

  // Return immediately; logos fill in the background (same as list fetch).
  enrichPortfolioRowLogos(portfolio)
    .then((withLogos) => {
      if (!withLogos) return;
      const list = getCached('user-portfolios', ownerId, PORTFOLIOS_TTL_MS);
      if (Array.isArray(list)) {
        const idx = list.findIndex((p) => p.id === withLogos.id);
        const next = idx < 0 ? [...list, withLogos] : list.map((p, i) => (i === idx ? withLogos : p));
        setCached('user-portfolios', ownerId, next);
      }
      const peek = peekPortfoliosCache(ownerId);
      if (Array.isArray(peek)) {
        const idx = peek.findIndex((p) => p.id === withLogos.id);
        const next = idx < 0 ? [...peek, withLogos] : peek.map((p, i) => (i === idx ? withLogos : p));
        writePortfoliosCache(ownerId, next);
      }
    })
    .catch(() => {});

  return portfolio;
}

/** Drafts live in the browser only — never written to Supabase until published. */
export async function createDraftPortfolio(ownerId) {
  const draft = blankDraft(ownerId);

  if (useBackend()) {
    return addLocalDraft(ownerId, draft);
  }

  return addUserPortfolio(CURRENT_USER.id, {
    id: draft.id.replace('pf_local_', 'pf_'),
    kind: 'live',
    isDraft: true,
    name: 'My portfolio',
    objective: '',
    thesis: '',
    totalValue: 0,
    invested: 0,
    totalPnlPct: 0,
    xirr: 0,
    holdings: [],
    tickers: [],
  });
}

export async function saveSocialPortfolio(ownerId, portfolioId, patch) {
  const holdings = patch.holdings ?? [];
  const tickers = patch.tickers ?? holdings.map((h) => h.ticker).filter(Boolean);

  if (isLocalDraftId(portfolioId)) {
    if (!useBackend()) {
      return applyPortfolioHoldingsUpdate(ownerId, portfolioId, holdings, {
        ...patch,
        tickers,
      });
    }

    if (patch.isDraft !== false) {
      throw new Error('Draft portfolios cannot be saved to the server');
    }

    const { data, error } = await supabase.rpc('upsert_social_portfolio', {
      p_id: null,
      p_kind: patch.kind ?? 'live',
      p_name: patch.name ?? '',
      p_objective: patch.objective ?? '',
      p_thesis: patch.thesis ?? '',
      p_is_draft: false,
      p_tickers: tickers,
      p_holdings: holdings,
      p_watchlist_base_investment: patch.watchlistBaseInvestment ?? null,
    });

    if (error) throw error;
    removeLocalDraft(ownerId, portfolioId);
    invalidatePortfolioCaches(ownerId);
    const mapped = mapRpcRow(data);
    seedPortfoliosCacheAfterSave(ownerId, mapped, portfolioId);
    return mapped;
  }

  if (!useBackend()) {
    return applyPortfolioHoldingsUpdate(ownerId, portfolioId, holdings, {
      ...patch,
      tickers,
    });
  }

  const { data, error } = await supabase.rpc('upsert_social_portfolio', {
    p_id: portfolioId,
    p_kind: patch.kind ?? null,
    p_name: patch.name ?? null,
    p_objective: patch.objective ?? null,
    p_thesis: patch.thesis ?? null,
    p_is_draft: false,
    p_tickers: tickers,
    p_holdings: holdings,
    p_watchlist_base_investment: patch.watchlistBaseInvestment ?? null,
  });

  if (error) throw error;
  invalidatePortfolioCaches(ownerId);
  const mapped = mapRpcRow(data);
  seedPortfoliosCacheAfterSave(ownerId, mapped, portfolioId);
  return mapped;
}

function seedPortfoliosCacheAfterSave(ownerId, saved, previousId = null) {
  if (!saved || !ownerId) return;
  const peek = peekPortfoliosCache(ownerId);
  const base = Array.isArray(peek) ? peek : [];
  const without = base.filter(
    (p) => p.id !== saved.id && (previousId == null || p.id !== previousId)
  );
  const next = [saved, ...without];
  setCached('user-portfolios', ownerId, next);
  writePortfoliosCache(ownerId, next);
}

/** Drop an in-progress local draft. Published portfolios cannot be deleted. */
export function discardLocalDraft(ownerId, portfolioId) {
  if (isLocalDraftId(portfolioId)) {
    if (useBackend()) {
      return removeLocalDraft(ownerId, portfolioId);
    }
    return deleteUserPortfolio(ownerId, portfolioId);
  }
  return false;
}

/**
 * Anonymous/share view of a published portfolio (summary only for guests).
 * Holdings are stripped client-side so the SPA can gate them behind sign-in.
 * @returns {Promise<{ portfolio: object, ownerId: string|null, ownerHandle: string|null, ownerName: string|null }|null>}
 */
export async function fetchPublicPortfolioShare(portfolioId) {
  if (!portfolioId) return null;

  if (!useBackend()) {
    for (const [ownerId, list] of Object.entries(USER_PORTFOLIOS)) {
      const found = (list ?? []).find(
        (p) => p.id === portfolioId && !p.isDraft && !p.isArchived
      );
      if (!found) continue;
      const owner = getPerson(ownerId);
      const mapped = enrichUserPortfolio(found);
      return {
        portfolio: {
          ...mapped,
          holdings: [],
          tickers: [],
        },
        ownerId,
        ownerHandle: owner?.handle ?? null,
        ownerName: owner?.name ?? null,
      };
    }
    return null;
  }

  const { data, error } = await supabase.rpc('get_public_portfolio_share', {
    p_portfolio_id: portfolioId,
  });
  if (error) throw error;
  if (!data?.portfolio) return null;

  const mapped = mapRpcRow(data.portfolio);
  if (!mapped) return null;

  return {
    portfolio: {
      ...mapped,
      holdings: [],
      tickers: [],
    },
    ownerId: data.portfolio.owner_id ?? mapped.ownerId ?? null,
    ownerHandle: data.ownerHandle ?? data.owner_handle ?? null,
    ownerName: data.ownerName ?? data.owner_name ?? null,
  };
}

/**
 * Discover published portfolios across the network (public-redacted).
 * @returns {Promise<Array<{ portfolio: object, owner: { id, name, handle, avatarUrl?, bio? } }>>}
 */
export async function fetchDiscoverPortfolios({ query = '', limit = 20, offset = 0 } = {}) {
  if (!useBackend()) {
    const needle = String(query ?? '').trim().toLowerCase();
    const rows = [];
    for (const [ownerId, list] of Object.entries(USER_PORTFOLIOS)) {
      const owner = getPerson(ownerId);
      if (!owner) continue;
      for (const raw of list ?? []) {
        if (raw.isDraft || raw.isArchived) continue;
        const portfolio = enrichUserPortfolio(raw);
        const hay = [
          portfolio.name,
          portfolio.objective,
          portfolio.thesis,
          owner.name,
          owner.handle,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (needle && !hay.includes(needle)) continue;
        rows.push({
          portfolio,
          owner: {
            id: owner.id,
            name: owner.name,
            handle: owner.handle,
            avatarUrl: owner.avatarUrl ?? null,
            bio: owner.bio ?? null,
          },
        });
      }
    }
    rows.sort(
      (a, b) =>
        new Date(b.portfolio.updatedAt ?? 0).getTime() -
        new Date(a.portfolio.updatedAt ?? 0).getTime()
    );
    return rows.slice(offset, offset + limit);
  }

  const { data, error } = await supabase.rpc('list_discover_portfolios', {
    p_query: query?.trim() || null,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((row) => {
      const portfolio = mapRpcRow(row.portfolio);
      const ownerRaw = row.owner ?? {};
      if (!portfolio || !ownerRaw.id) return null;
      return {
        portfolio,
        owner: {
          id: ownerRaw.id,
          name: ownerRaw.name ?? ownerRaw.handle ?? 'Investor',
          handle: ownerRaw.handle ?? '',
          avatarUrl: ownerRaw.avatarUrl ?? ownerRaw.avatar_url ?? null,
          bio: ownerRaw.bio ?? null,
        },
      };
    })
    .filter(Boolean);
}
