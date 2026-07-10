import { supabase, isSupabaseConfigured } from './supabase';
import { skipAuthForDev } from './sessionStore';
import * as localStore from './portfolioSocialStore';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export async function fetchPortfolioEngagement(portfolioId) {
  if (!useBackend(portfolioId)) {
    return localStore.getPortfolioSocial(portfolioId);
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

  return mapRemoteEngagement(
    data,
    (comments ?? []).map((row) => ({
      id: row.id,
      authorId: row.author_id,
      body: row.body,
      createdAt: row.created_at,
    }))
  );
}

export async function togglePortfolioLike(portfolioId) {
  if (!useBackend(portfolioId)) {
    return localStore.togglePortfolioLike(portfolioId);
  }

  const { error } = await supabase.rpc('toggle_portfolio_like', {
    p_portfolio_id: portfolioId,
  });
  if (error) throw error;
  return fetchPortfolioEngagement(portfolioId);
}

export async function togglePortfolioCopy(portfolioId) {
  if (!useBackend(portfolioId)) {
    return localStore.togglePortfolioCopy(portfolioId);
  }

  const { error } = await supabase.rpc('toggle_portfolio_copy', {
    p_portfolio_id: portfolioId,
  });
  if (error) throw error;
  return fetchPortfolioEngagement(portfolioId);
}

export async function recordPortfolioShare(portfolioId) {
  if (!useBackend(portfolioId)) {
    return localStore.incrementPortfolioShare(portfolioId);
  }

  const { error } = await supabase.rpc('record_portfolio_share', {
    p_portfolio_id: portfolioId,
  });
  if (error) throw error;
  return fetchPortfolioEngagement(portfolioId);
}

export async function addPortfolioComment(portfolioId, text) {
  if (!useBackend(portfolioId)) {
    return localStore.addPortfolioComment(portfolioId, text);
  }

  const { error } = await supabase.rpc('add_portfolio_comment', {
    p_portfolio_id: portfolioId,
    p_body: text,
  });
  if (error) throw error;
  return fetchPortfolioEngagement(portfolioId);
}

export async function markPortfolioCommentsRead(portfolioId) {
  if (!useBackend(portfolioId)) {
    localStore.markPortfolioCommentsRead(portfolioId);
    return localStore.getPortfolioSocial(portfolioId);
  }

  const { error } = await supabase.rpc('mark_portfolio_comments_read', {
    p_portfolio_id: portfolioId,
  });
  if (error) throw error;
  return fetchPortfolioEngagement(portfolioId);
}

export function subscribePortfolioEngagement(listener) {
  return localStore.subscribePortfolioSocial(listener);
}

export function getPortfolioEngagementSync(portfolioId) {
  return localStore.getPortfolioSocial(portfolioId);
}
