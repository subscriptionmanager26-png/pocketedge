import { createClient } from '@supabase/supabase-js';
import { supabaseServerConfig } from './supabaseServer.js';

const TOP = 10;
const TOP_PERFORMERS = 5;

export function getSupabaseAdmin() {
  const { url, serviceRoleKey } = supabaseServerConfig();
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Prefer service role; fall back to anon for the public redacted share RPC. */
export function getSupabaseForPublicShare() {
  const admin = getSupabaseAdmin();
  if (admin) return admin;
  const { url, anonKey } = supabaseServerConfig();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function holdingWeight(h, totalValue) {
  const fromWeight = Number(h?.weightPct ?? h?.weight);
  if (Number.isFinite(fromWeight) && fromWeight > 0) return fromWeight;
  const qty = Number(h?.qty) || 0;
  const price = Number(h?.price) || Number(h?.avg) || 0;
  const value = Number(h?.value) || qty * price;
  return totalValue > 0 ? (value / totalValue) * 100 : 0;
}

function holdingReturnPct(h) {
  const stored = Number(h?.pnlPct ?? h?.pnl_pct);
  if (Number.isFinite(stored)) return stored;
  const qty = Number(h?.qty) || 0;
  const avg = Number(h?.avg) || 0;
  const price = Number(h?.price) || avg;
  if (qty > 0 && avg > 0) return ((price - avg) / avg) * 100;
  return 0;
}

function holdingSectorKey(h) {
  return String(h?.sector || h?.category || h?.assetType || 'Other').trim() || 'Other';
}

export function buildSnapshotFromPortfolio(portfolio, { sort = 'allocation' } = {}) {
  const holdings = (portfolio.holdings ?? []).filter((h) => h?.ticker);
  const totalValue = holdings.reduce((sum, h) => {
    const qty = Number(h?.qty) || 0;
    const price = Number(h?.price) || Number(h?.avg) || 0;
    return sum + (Number(h?.value) || qty * price);
  }, 0);

  const rows = holdings.map((h) => ({
    ticker: h.ticker,
    label: h.assetName || h.ticker,
    logoIconUrl: h.logoIconUrl ?? h.logo_icon_url ?? null,
    weight: Number(holdingWeight(h, totalValue).toFixed(1)),
    totalReturnPct: holdingReturnPct(h),
    sector: holdingSectorKey(h),
  }));

  const byAllocation = [...rows].sort((a, b) => b.weight - a.weight);
  const byPerformance = [...rows].sort((a, b) => b.totalReturnPct - a.totalReturnPct);
  const topHoldings =
    sort === 'performance' ? byPerformance.slice(0, TOP) : byAllocation.slice(0, TOP);

  const returnPct = Number(portfolio.total_return_pct ?? portfolio.totalReturnPct ?? 0) || 0;

  return {
    portfolioId: portfolio.id,
    name: portfolio.name ?? 'Portfolio',
    returnPct,
    holdingsCount: rows.length,
    sectorsCount: new Set(rows.map((r) => r.sector)).size,
    topHoldings,
    topByAllocation: byAllocation.slice(0, TOP),
    topPerformers: byPerformance.slice(0, TOP_PERFORMERS),
    sort,
  };
}

export async function fetchPublicPortfolioShareData(portfolioId) {
  const supabase = getSupabaseForPublicShare();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.rpc('get_public_portfolio_share', {
      p_portfolio_id: portfolioId,
    });

    if (error || !data) return null;

    const portfolio = data.portfolio ?? data?.portfolio;
    if (!portfolio) return null;

    return {
      portfolio,
      ownerHandle: data.ownerHandle ?? data.owner_handle ?? null,
      ownerName: data.ownerName ?? data.owner_name ?? null,
    };
  } catch {
    return null;
  }
}

export function siteOrigin(request) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  if (host) return `${proto}://${host}`;
  return 'https://www.pocketedge.in';
}

export function profilePortfolioUrl(origin, handle, portfolioId) {
  const h = String(handle ?? '').replace(/^@/, '');
  if (!h) return `${origin}/feed`;
  return `${origin}/@${encodeURIComponent(h)}/portfolio/${encodeURIComponent(portfolioId)}`;
}

export function shareLandingUrl(origin, portfolioId, sort) {
  const base = `${origin}/share/portfolio/${encodeURIComponent(portfolioId)}`;
  if (sort && sort !== 'allocation') return `${base}?sort=${encodeURIComponent(sort)}`;
  return base;
}

export function ogImageUrl(origin, portfolioId, sort) {
  const params = new URLSearchParams({ id: portfolioId });
  if (sort && sort !== 'allocation') params.set('sort', sort);
  return `${origin}/api/og/portfolio?${params.toString()}`;
}

export function isSocialBot(userAgent) {
  const ua = String(userAgent ?? '').toLowerCase();
  return (
    ua.includes('facebookexternalhit') ||
    ua.includes('twitterbot') ||
    ua.includes('linkedinbot') ||
    ua.includes('slackbot') ||
    ua.includes('whatsapp') ||
    ua.includes('telegrambot') ||
    ua.includes('discordbot') ||
    ua.includes('googlebot')
  );
}

export function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function ownerPossessiveLabel(handle) {
  const raw = String(handle ?? '')
    .replace(/^@/, '')
    .trim();
  if (!raw) return 'My';
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);
  return /s$/i.test(label) ? `${label}'` : `${label}'s`;
}

export const SHARE_CARD_WIDTH = 375;
export const SHARE_CARD_HEIGHT = 667;
/** 2× OG output for sharper link previews and download fallback. */
export const SHARE_OG_SCALE = 2;

export const SHARE_LABEL_BUBBLE_LG = 28;
export const SHARE_LABEL_BUBBLE_SM = 24;
export const SHARE_LABEL_TILE = 48;

export function shortShareLabel(label, max = 16) {
  const text = String(label ?? '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
