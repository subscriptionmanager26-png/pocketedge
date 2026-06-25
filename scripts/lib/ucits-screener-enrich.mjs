import {
  fetchYahooQuoteSummary,
  inferTrackedIndex,
  parseSectorWeightings,
  parseTopHoldings,
} from './yahoo-quote-summary.mjs';
import { resolveYahooSymbolForUcits } from './ucits-yahoo-symbol.mjs';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function ucitsRowId(row) {
  return `${row.symbol}-${row.exchange}`;
}

export async function enrichUcits(row, { delayMs = 120 } = {}) {
  const resolved = await resolveYahooSymbolForUcits(row);
  if (!resolved) return null;

  if (delayMs > 0) await sleep(delayMs);

  const summary = await fetchYahooQuoteSummary(resolved.yahooSymbol);
  if (!summary?.topHoldings) return null;

  const quoteType = summary.quoteType || {};
  const fundProfile = summary.fundProfile || {};
  const topHoldings = summary.topHoldings || {};
  const longName = quoteType.longName || row.name;
  const trackedIndex = inferTrackedIndex(row.name, longName);

  return {
    id: ucitsRowId(row),
    symbol: row.symbol,
    exchange: row.exchange,
    domicile: row.domicile,
    name: row.name.replace(/&amp;/g, '&'),
    yahooSymbol: resolved.yahooSymbol,
    longName,
    shortName: quoteType.shortName || null,
    quoteType: quoteType.quoteType || 'ETF',
    yahooExchange: quoteType.exchange || resolved.exchangeName || null,
    currency: resolved.currency || null,
    family: fundProfile.family || null,
    legalType: fundProfile.legalType || null,
    expenseRatio:
      fundProfile.feesExpensesInvestment?.annualReportExpenseRatio?.fmt ||
      fundProfile.feesExpensesInvestment?.annualReportExpenseRatio?.raw ||
      null,
    turnover:
      fundProfile.feesExpensesInvestment?.annualHoldingsTurnover?.fmt ||
      fundProfile.feesExpensesInvestment?.annualHoldingsTurnover?.raw ||
      null,
    trackedIndex,
    assetMix: {
      stock: topHoldings.stockPosition?.fmt || null,
      bond: topHoldings.bondPosition?.fmt || null,
      cash: topHoldings.cashPosition?.fmt || null,
      other: topHoldings.otherPosition?.fmt || null,
    },
    sectorWeightings: parseSectorWeightings(topHoldings.sectorWeightings),
    topHoldings: parseTopHoldings(topHoldings.holdings),
    fetchedAt: new Date().toISOString(),
  };
}
