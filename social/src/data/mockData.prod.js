/** Production stub — keeps API surface without shipping demo fixtures. */

export const CURRENT_USER = {
  id: 'u_me',
  name: 'Investor',
  handle: 'investor',
  avatar: 'I',
  xirr: 0,
  followers: 0,
  following: 0,
  assetsInfluenced: 0,
  bio: '',
  location: '',
  joinedAt: null,
  focus: '',
  portfolioPublic: true,
  showHoldingsPublic: true,
  showXirrPublic: true,
};

export const PEOPLE = [];
export const AUTHOR_POSITIONS = {};
export const STOCKS = {};
export const TOPICS = [];
export const FOLLOWING_IDS = new Set();
export const USER_FOLLOWING_SEED = {};
export const MY_PORTFOLIO = {
  id: 'pf_empty',
  kind: 'live',
  name: '',
  holdings: [],
  tickers: [],
  totalValue: 0,
  invested: 0,
  totalPnlPct: 0,
  xirr: 0,
};
export const USER_PORTFOLIOS = {};
export const PORTFOLIO_CHANGES = [];
export const POSTS = [];
export const PORTFOLIO_UPDATES = {};
export const USER_TRADES = {};
export const WATCHLIST_BASE_INVESTMENT = 10_000;

export function getPerson(id) {
  if (!id) return CURRENT_USER;
  if (id === CURRENT_USER.id) return CURRENT_USER;
  return {
    id,
    name: 'Member',
    handle: 'member',
    avatar: 'M',
    xirr: 0,
    followers: 0,
    following: 0,
    assetsInfluenced: 0,
    bio: '',
    location: '',
    joinedAt: null,
    focus: '',
    portfolioPublic: true,
    showHoldingsPublic: true,
    showXirrPublic: true,
  };
}

export function normalizeHandle(handle) {
  return String(handle ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
}

export function getPersonByHandle(handle) {
  const normalized = normalizeHandle(handle);
  if (!normalized) return null;
  if (normalized === CURRENT_USER.handle) return CURRENT_USER;
  return null;
}

export function getHandleForUserId(userId) {
  return getPerson(userId)?.handle ?? null;
}

export function getUserIdForHandle(handle) {
  return getPersonByHandle(handle)?.id ?? null;
}

export function getPosition() {
  return null;
}

export function getPortfolioWeightPct() {
  return null;
}

export function getUserTrades() {
  return [];
}

export function recordPortfolioTrade() {
  return null;
}

export function recalcHolding(holding) {
  const price = holding.price ?? holding.avg ?? 0;
  const qty = Number(holding.qty) || 0;
  const avg = Number(holding.avg) || 0;
  const value = qty * price;
  const cost = qty * avg;
  const pnl = value - cost;
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
  return {
    ...holding,
    qty,
    avg,
    price,
    value,
    pnl,
    pnlPct,
    spark: holding.spark ?? [],
  };
}

export function recalcPortfolioTotals(holdings) {
  const rows = holdings.map(recalcHolding);
  const totalValue = rows.reduce((sum, h) => sum + (h.value ?? 0), 0);
  const invested = rows.reduce((sum, h) => sum + (h.qty ?? 0) * (h.avg ?? 0), 0);
  const totalPnlPct = invested > 0 ? ((totalValue - invested) / invested) * 100 : 0;
  return { holdings: rows, totalValue, invested, totalPnlPct };
}

export function applyPortfolioHoldingsUpdate() {
  return null;
}

function estimateReturns(portfolio) {
  const base1M = Number(portfolio?.return1M ?? portfolio?.totalPnlPct ?? 0);
  const fromData = portfolio?.returns ?? {};
  return {
    '1D': fromData['1D'] ?? Number((base1M / 20).toFixed(1)),
    '1W': fromData['1W'] ?? Number((base1M / 4).toFixed(1)),
    '1M': fromData['1M'] ?? base1M,
    '1Y': fromData['1Y'] ?? Number((base1M * 8).toFixed(1)),
  };
}

export function getPortfolioReturn(portfolio, period = '1M') {
  const returns = portfolio?.returns ?? estimateReturns(portfolio ?? {});
  return returns[period] ?? returns['1M'] ?? 0;
}

export function enrichUserPortfolio(portfolio) {
  const returns = estimateReturns(portfolio);
  return {
    ...portfolio,
    kind: portfolio.kind ?? 'live',
    objective: portfolio.objective ?? portfolio.description ?? '',
    thesis: portfolio.thesis ?? portfolio.description ?? '',
    tickers:
      portfolio.tickers ??
      (portfolio.holdings ?? []).map((h) => h?.ticker).filter(Boolean),
    holdingsCount: (portfolio.holdings ?? []).length,
    return1M: returns['1M'],
    returns,
  };
}

export function getUserPortfolios() {
  return [];
}

export function getUserPortfolio() {
  return null;
}

export function addUserPortfolio(_userId, portfolio) {
  return portfolio;
}

export function isCopiedPortfolio(portfolio) {
  return Boolean(portfolio?.sourcePortfolioId);
}

export function copyPortfolioForUser() {
  return null;
}

export function deleteUserPortfolio() {
  return false;
}

export function resolveWatchlistHoldings(portfolio) {
  return portfolio?.holdings ?? [];
}

export function computePortfolioDisplayMetrics(portfolio) {
  const holdings = portfolio?.holdings ?? [];
  const { totalValue, invested, totalPnlPct } = recalcPortfolioTotals(holdings);
  return {
    totalValue: portfolio?.totalValue ?? totalValue,
    invested: portfolio?.invested ?? invested,
    totalPnlPct: portfolio?.totalPnlPct ?? totalPnlPct,
    xirr: portfolio?.xirr ?? 0,
  };
}

export function updateUserPortfolio() {
  return null;
}

export function getPublicPortfolio() {
  return null;
}

export function primaryHoldingsLabel() {
  return '';
}
