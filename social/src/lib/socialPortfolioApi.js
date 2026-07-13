import {
  CURRENT_USER,
  addUserPortfolio,
  applyPortfolioHoldingsUpdate,
  deleteUserPortfolio,
  enrichUserPortfolio,
  getUserPortfolio,
  getUserPortfolios,
} from '../data/mockData';
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

function useBackend() {
  return isSupabaseConfigured() && !skipAuthForDev();
}

export function isLocalDraftId(portfolioId) {
  return String(portfolioId ?? '').startsWith('pf_local_');
}

function mapRpcRow(row) {
  if (!row) return null;
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return enrichUserPortfolio(portfolio);
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
    name: '',
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

export async function fetchUserPortfolios(ownerId) {
  if (!useBackend()) {
    return getUserPortfolios(ownerId);
  }

  const drafts = getLocalDrafts(ownerId).map(enrichUserPortfolio);

  const { data, error } = await supabase.rpc('list_user_portfolios', {
    p_owner_id: ownerId,
  });

  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return [...drafts, ...rows.map(mapRpcRow)];
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
  return data ? mapRpcRow(data) : null;
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
    name: '',
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
    invalidateAuthorPositions(ownerId);
    return mapRpcRow(data);
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
  invalidateAuthorPositions(ownerId);
  return mapRpcRow(data);
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
