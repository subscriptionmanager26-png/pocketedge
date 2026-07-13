import { STOCKS } from '../data/mockData';
import { holdingDisplayLabel } from './portfolioAssetUniverse';

/** Build a privacy-safe portfolio snapshot for sharing as a post. */
export function buildPortfolioShare(portfolio, period = '1M') {
  if (!portfolio) return null;
  const holdings = (portfolio.holdings ?? []).filter(Boolean);
  const totalValue = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0);
  const topHoldings = holdings
    .map((h) => {
      const weight = totalValue > 0 ? ((h.value ?? 0) / totalValue) * 100 : 0;
      const label = holdingDisplayLabel(h);
      return {
        ticker: h.ticker,
        label,
        name: h.assetName ?? STOCKS[h.ticker]?.name ?? '',
        weight: Number(weight.toFixed(1)),
        returnPct:
          typeof h.pnlPct === 'number'
            ? h.pnlPct
            : STOCKS[h.ticker]?.changePct ?? 0,
      };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);

  const returns = portfolio.returns ?? {};
  const returnPct =
    returns[period] ??
    portfolio.return1M ??
    portfolio.totalPnlPct ??
    portfolio.todayPnlPct ??
    0;

  const tickers = holdings.map((h) => h.ticker).filter(Boolean);

  return {
    portfolioId: portfolio.id,
    name: portfolio.name,
    thesis: portfolio.thesis ?? portfolio.objective ?? '',
    period,
    returnPct: Number(returnPct) || 0,
    holdingsCount: holdings.length,
    topHoldings,
    tickers,
  };
}

export function defaultPortfolioShareBody(share) {
  if (!share) return '';
  if (share.thesis) return share.thesis;
  const names = (share.topHoldings ?? [])
    .slice(0, 3)
    .map((h) => `@${h.ticker}`)
    .join(' ');
  return names
    ? `Sharing my portfolio focus — ${names}`
    : `Sharing my portfolio: ${share.name}`;
}
