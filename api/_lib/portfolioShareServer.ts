import { createClient } from '@supabase/supabase-js';

const TOP = 10;

export function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
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

function estimate1MReturn(holdings) {
  const pcts = (holdings ?? [])
    .map((h) => Number(h?.changePct ?? h?.change_pct))
    .filter((n) => Number.isFinite(n));
  if (!pcts.length) return 0;
  const avg = pcts.reduce((sum, n) => sum + n, 0) / pcts.length;
  return Number((avg * 8).toFixed(1));
}

export function buildSnapshotFromPortfolio(portfolio, { sort = 'allocation' } = {}) {
  const holdings = (portfolio.holdings ?? []).filter((h) => h?.ticker);
  const totalValue = holdings.reduce((sum, h) => {
    const qty = Number(h?.qty) || 0;
    const price = Number(h?.price) || Number(h?.avg) || 0;
    return sum + (Number(h?.value) || qty * price);
  }, 0);

  let rows = holdings.map((h) => ({
    ticker: h.ticker,
    label: h.assetName || h.ticker,
    weight: Number(holdingWeight(h, totalValue).toFixed(1)),
    totalReturnPct: holdingReturnPct(h),
  }));

  rows =
    sort === 'performance'
      ? rows.sort((a, b) => b.totalReturnPct - a.totalReturnPct)
      : rows.sort((a, b) => b.weight - a.weight);

  const returnPct = Number(portfolio.total_return_pct ?? portfolio.totalReturnPct ?? 0) || 0;

  return {
    portfolioId: portfolio.id,
    name: portfolio.name ?? 'Portfolio',
    returnPct,
    holdingsCount: rows.length,
    topHoldings: rows.slice(0, TOP),
    sort,
  };
}

export async function fetchPublicPortfolioShareData(portfolioId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data: portfolio, error } = await supabase
    .from('social_portfolios')
    .select('id, name, objective, thesis, holdings, owner_id, is_draft, is_archived')
    .eq('id', portfolioId)
    .maybeSingle();

  if (error || !portfolio || portfolio.is_draft || portfolio.is_archived) return null;

  const { data: profile } = await supabase
    .from('social_profiles')
    .select('username, display_name')
    .eq('user_id', portfolio.owner_id)
    .maybeSingle();

  const { data: totalReturn } = await supabase.rpc('portfolio_total_return_pct', {
    p_holdings: portfolio.holdings ?? [],
  });

  return {
    portfolio: {
      ...portfolio,
      total_return_pct: totalReturn,
    },
    ownerHandle: profile?.username ?? null,
    ownerName: profile?.display_name ?? null,
  };
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
  return `${sign}${n.toFixed(1)}%`;
}
