/** ETF type filters shown on the iNAV tracker. */
export const ETF_INAV_CATEGORIES = [
  'International',
  'Broad Market Index',
  'Gold',
  'Silver',
  'Debt',
  'Factor Index',
  'Sectoral/Thematic Index',
];

/**
 * Classify an ETF from NSE name / symbol / optional AMC scheme name.
 * Heuristic only — good enough for tracker filtering.
 */
export function classifyEtfCategory({ name = '', symbol = '', etfName = '' } = {}) {
  const blob = `${name} ${symbol} ${etfName}`.toUpperCase();

  if (
    /\bSILVER\b/.test(blob) ||
    /SILVER(?:BEES|IETF|CASE|AXIS|ADD|BND|360)?/.test(blob) ||
    blob.includes('SILVERB')
  ) {
    return 'Silver';
  }

  if (
    /\bGOLD\b/.test(blob) ||
    /GOLD(?:BEES|IETF|CASE|AXIS|ADD|BND|360|SHARE|IWIN)?/.test(blob) ||
    blob.includes('GOLDIETF') ||
    blob.includes('GOLDBEES')
  ) {
    // Prefer silver if both somehow match (already returned).
    return 'Gold';
  }

  if (
    /HANG\s*SENG|NASDAQ|S&P\s*500|SP500|HONG\s*KONG|TAIWAN|JAPAN|CHINA|DOW\s*JONES|NYSE|MSCI\s*WORLD|MSCI\s*EM|INTERNATIONAL|US\s+|&\s*US\b|GLOBAL(?!\s*INFRA)/.test(
      blob,
    )
  ) {
    return 'International';
  }

  if (
    /G-?SEC|GILT|LIQUID|BOND|DEBT|OVERNIGHT|1D\s*RATE|GSEC|CASHIETF|BBETF|BHARAT\s*BOND/.test(blob)
  ) {
    return 'Debt';
  }

  if (
    /MOMENTUM|QUALITY|VALUE|LOW\s*VOL|LOWVOL|ALPHA|EQUAL\s*WEIGHT|FACTOR|MULTICAP\s*MOMENTUM/.test(
      blob,
    )
  ) {
    return 'Factor Index';
  }

  if (
    /BANK|IT\b|HEALTH|PHARMA|AUTO|METAL|ENERGY|FMCG|INFRA|PSU|DEFENCE|DEFENSE|CONSUMPTION|REALTY|OIL|GAS|CHEMICAL|CAPITAL\s*MARKET|INTERNET|RAIL|EV\b|PRIVATE\s*BANK|HEALTHCARE|COMMODIT|POWER|HOSPITAL|PSE\b|DIGITAL|INSURANCE|CPSE/.test(
      blob,
    )
  ) {
    return 'Sectoral/Thematic Index';
  }

  return 'Broad Market Index';
}
