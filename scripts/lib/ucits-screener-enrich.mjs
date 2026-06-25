import {
  fetchYahooQuoteSummary,
  parseSectorWeightings,
  parseTopHoldings,
} from './yahoo-quote-summary.mjs';
import { fetchIsinAlternateAum, fetchJustEtfAumForRow, getUcitsIsinIndex, parseYahooAum } from './ucits-aum.mjs';
import { lookupIsinForUcitsRow } from './ucits-isin-index.mjs';
import { inferTrackedIndex } from './ucits-tracked-index.mjs';
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

  const isinIndex = getUcitsIsinIndex();
  const isin = lookupIsinForUcitsRow(row, isinIndex);

  const summary = await fetchYahooQuoteSummary(resolved.yahooSymbol);
  if (!summary?.topHoldings) return null;

  const quoteType = summary.quoteType || {};
  const fundProfile = summary.fundProfile || {};
  const topHoldings = summary.topHoldings || {};
  const longName = quoteType.longName || row.name;
  const trackedIndex = inferTrackedIndex(row.name, longName);
  const trackedIndexSource = trackedIndex ? 'name' : null;

  let aumFields = parseYahooAum(summary);
  let aumSource = aumFields?.aum != null || aumFields?.aumFmt ? 'yahoo' : null;
  let aumSymbol = resolved.yahooSymbol;

  if (!aumSource) {
    const fallback = await fetchIsinAlternateAum(row, isinIndex, {
      exclude: [resolved.yahooSymbol],
      delayMs,
      isin,
    });
    if (fallback?.aum != null || fallback?.aumFmt) {
      aumFields = fallback;
      aumSource = fallback.aumSource;
      aumSymbol = fallback.aumSymbol;
    } else {
      const justEtf = await fetchJustEtfAumForRow(row, isinIndex, {
        delayMs,
        isin: fallback?.isin || isin,
      });
      if (justEtf?.aum != null || justEtf?.aumFmt) {
        aumFields = justEtf;
        aumSource = justEtf.aumSource;
        aumSymbol = justEtf.aumSymbol;
      }
    }
  }

  return {
    id: ucitsRowId(row),
    symbol: row.symbol,
    exchange: row.exchange,
    domicile: row.domicile,
    isin: isin || aumFields?.isin || null,
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
    aum: aumFields?.aum ?? null,
    aumFmt: aumFields?.aumFmt ?? null,
    aumCurrency: aumFields?.aumCurrency ?? null,
    aumMillions: aumFields?.aumMillions ?? null,
    navPrice: aumFields?.navPrice ?? summary?.summaryDetail?.navPrice?.fmt ?? null,
    aumSource,
    aumSymbol,
    trackedIndex,
    trackedIndexSource,
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
