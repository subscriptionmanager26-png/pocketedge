/**
 * Map ucits.info exchange + ticker to Yahoo Finance symbols.
 */

import { fetchYahooChart } from './yahoo-fetch.mjs';
import { fetchYahooQuoteSummary } from './yahoo-quote-summary.mjs';

const EXCHANGE_SUFFIXES = {
  LSE: ['.L'],
  XETR: ['.DE'],
  XDUS: ['.DE'],
  XBER: ['.DE'],
  XHAN: ['.DE'],
  XHAM: ['.DE'],
  Munich: ['.DE', '.MU'],
  FSX: ['.F', '.DE'],
  SIX: ['.SW'],
  MTA: ['.MI'],
  AMS: ['.AS'],
  Euronext: ['.PA', '.AS', '.BR'],
  NASDAQ: [''],
  NYSE: [''],
  AMEX: [''],
};

export function yahooSymbolCandidates(symbol, exchange) {
  const base = String(symbol || '').trim().toUpperCase();
  if (!base) return [];

  const suffixes = EXCHANGE_SUFFIXES[exchange] || ['.L', '.DE', '.PA', '.AS', '.MI', '.SW'];
  const candidates = suffixes.map((suffix) => `${base}${suffix}`);
  return [...new Set(candidates)];
}

export async function resolveYahooSymbolForUcits(instrument) {
  const candidates = yahooSymbolCandidates(instrument.symbol, instrument.exchange);

  for (const candidate of candidates) {
    const chart = await fetchYahooChart(candidate);
    if (chart?.price) {
      return {
        yahooSymbol: candidate,
        currency: chart.currency,
        exchangeName: chart.exchange,
      };
    }

    const summary = await fetchYahooQuoteSummary(candidate, 'quoteType');
    if (summary?.quoteType?.symbol) {
      return {
        yahooSymbol: candidate,
        currency: null,
        exchangeName: summary.quoteType.exchange || null,
      };
    }
  }

  return null;
}
