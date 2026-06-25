import { fetchJustEtfProfileHtml } from './justetf-profile.mjs';

function parseMoneyMillions(text = '') {
  const match = String(text)
    .replace(/\u00a0/g, ' ')
    .match(/([A-Z]{3})\s*([\d.,]+)\s*(m|million|bn|billion)?/i);
  if (!match) return null;

  const currency = match[1].toUpperCase();
  const rawNumber = Number(match[2].replace(/,/g, ''));
  if (!Number.isFinite(rawNumber) || rawNumber <= 0) return null;

  const unit = (match[3] || 'm').toLowerCase();
  let millions = rawNumber;
  if (unit.startsWith('b')) millions = rawNumber * 1000;

  return {
    currency,
    millions,
    aum: millions * 1_000_000,
  };
}

export function extractFundSizeFromHtml(html) {
  const patterns = [
    /data-testid="etf-profile-header_fund-size-value-wrapper"[^>]*>\s*<span>\s*([A-Z]{3}\s*[\d.,]+)\s*<\/span>\s*m/i,
    /data-testid="etf-basics_row_fund-size"[\s\S]*?<div>\s*([A-Z]{3}\s*[\d.,]+)\s*m/i,
    /(\d[\d.,]*)\s*m\s+Euro\s+assets\s+under\s+management/i,
    /Fund size[\s\S]{0,120}?([A-Z]{3}\s*[\d.,]+)\s*m/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    const parsed = parseMoneyMillions(match[1].includes(' ') ? `${match[1]} m` : `EUR ${match[1]} m`);
    if (parsed) return parsed;
  }

  return null;
}

export function formatAumFromMillions(millions, currency) {
  const abs = Math.abs(millions);
  let fmt;
  if (abs >= 1_000_000) fmt = `${(millions / 1_000_000).toFixed(2)}T`;
  else if (abs >= 1_000) fmt = `${(millions / 1_000).toFixed(2)}B`;
  else if (abs >= 1) fmt = `${Math.round(millions)}M`;
  else fmt = `${Math.round(millions * 1000)}K`;

  return { aumFmt: fmt, aumCurrency: currency, aum: millions * 1_000_000, aumMillions: millions };
}

export async function fetchJustEtfAum(isin, { delayMs = 150, retries = 3 } = {}) {
  if (!isin) return null;

  const html = await fetchJustEtfProfileHtml(isin, { delayMs, retries });
  if (!html) return null;

  const parsed = extractFundSizeFromHtml(html);
  if (!parsed) return null;

  const formatted = formatAumFromMillions(parsed.millions, parsed.currency);
  return {
    ...formatted,
    aumSource: 'justetf',
    aumSymbol: isin,
  };
}
