/** Shared SEO title/description helpers — keep SPA meta aligned with bot HTML. */

export function truncateSeo(text, max = 155) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trim()}…`;
}

export function stockSeoMeta({ name, symbol, isEtf = false, excerpt = null }) {
  const label = name || symbol;
  return {
    title: `${label} (${symbol})${isEtf ? ' ETF' : ''} · PocketEdge`,
    description: excerpt
      ? truncateSeo(excerpt)
      : `${label} (${symbol}) — ${
          isEtf ? 'ETF' : 'stock'
        } quotes and company overview on PocketEdge.`,
  };
}

export function fundSeoMeta({ name, schemeCode, categoryLine = '' }) {
  const label = name || `Fund ${schemeCode}`;
  return {
    title: `${label} · PocketEdge`,
    description: categoryLine
      ? truncateSeo(
          `${label} — ${categoryLine}. Mutual fund NAV, returns, and holdings on PocketEdge.`
        )
      : `${label} mutual fund details on PocketEdge.`,
  };
}

export function briefSeoMeta({ name, symbol, kicker = '' }) {
  const label = name || symbol;
  return {
    title: `${label} business model · PocketEdge`,
    description: kicker
      ? truncateSeo(kicker)
      : `What ${symbol} does and how the business works — company brief on PocketEdge.`,
  };
}

export function indexSeoMeta({ name }) {
  const label = name || 'Index';
  return {
    title: `${label} index · PocketEdge`,
    description: `${label} index level and overview on PocketEdge.`,
  };
}

export function commoditySeoMeta({ name }) {
  const label = name || 'Commodity';
  return {
    title: `${label} · PocketEdge`,
    description: `${label} commodity price and overview on PocketEdge.`,
  };
}
