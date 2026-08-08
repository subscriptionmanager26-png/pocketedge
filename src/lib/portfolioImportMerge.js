import { resolvePortfolioAssets } from './portfolioAssetUniverse';

const ISIN_RE = /^[A-Z0-9]{12}$/;
const AMFI_RE = /^\d{6,}$/;

export function holdingIsin(value) {
  const isin = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  return ISIN_RE.test(isin) ? isin : null;
}

export function holdingAmfi(value) {
  const raw = String(value ?? '').trim();
  return AMFI_RE.test(raw) ? raw : null;
}

export function holdingFallbackName(value) {
  const text =
    typeof value === 'string' || value == null
      ? String(value ?? '')
      : String(value?.name ?? value?.ticker ?? '');
  const cleaned = text.trim().toUpperCase();
  // Broker/exchange series badges are temporary suffixes: GOLDBEES-X,
  // GOLDBEES - SE, etc. Keep the stable root for non-ISIN matching.
  return cleaned.replace(/\s*-\s*[A-Z]{1,3}$/, '').trim();
}

/** Compact alphanumeric name for fuzzy scheme/security matching. */
export function normalizeMatchName(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

export function qtysEqual(a, b) {
  const na = Number(String(a ?? '').replace(/,/g, '').trim());
  const nb = Number(String(b ?? '').replace(/,/g, '').trim());
  if (Number.isFinite(na) && Number.isFinite(nb)) {
    return Math.abs(na - nb) < 1e-6;
  }
  return String(a ?? '').trim() === String(b ?? '').trim();
}

/**
 * Identity aliases for merge matching (order = preference).
 * Covers resolved key, ISIN, AMFI/scheme code, symbol, and normalized name.
 */
export function holdingMatchAliases(row, asset = null) {
  const aliases = [];
  const seen = new Set();
  const add = (raw, { asName = false } = {}) => {
    if (raw == null) return;
    let token;
    if (asName) {
      const name = normalizeMatchName(raw);
      if (name.length < 6) return;
      token = `NAME:${name}`;
    } else {
      token = String(raw).trim().toUpperCase();
      if (!token) return;
    }
    if (seen.has(token)) return;
    seen.add(token);
    aliases.push(token);
  };

  add(asset?.key);
  add(row?.ticker);
  add(holdingIsin(row?.isin));
  add(holdingIsin(asset?.isin));
  add(holdingIsin(row?.ticker));
  add(holdingAmfi(row?.amfi));
  add(holdingAmfi(row?.amfiCode));
  add(holdingAmfi(row?.schemeCode));
  add(holdingAmfi(row?.ticker));
  add(holdingAmfi(asset?.key));
  add(asset?.symbol);

  const displayName = row?.name || asset?.name || '';
  add(displayName, { asName: true });
  if (asset?.name && asset.name !== displayName) add(asset.name, { asName: true });
  // Symbol-style fallback name (stocks with empty row.name).
  add(holdingFallbackName(row), { asName: true });

  return aliases;
}

function indexAlias(map, alias, row) {
  if (!alias || map.has(alias)) return;
  map.set(alias, row);
}

function findIndexed(map, aliases) {
  for (const alias of aliases) {
    const hit = map.get(alias);
    if (hit) return hit;
  }
  return null;
}

/** Prefer the single published live book; else oldest published. */
export function pickMainPortfolio(portfolios) {
  const published = (portfolios ?? []).filter((p) => p && !p.isDraft && !p.isArchived);
  if (!published.length) return null;
  const live = published.filter((p) => (p.kind ?? 'live') !== 'watchlist');
  if (live.length === 1) return live[0];
  const pool = live.length ? live : published;
  const named = pool.find((p) => /^my portfolio$/i.test(String(p.name ?? '').trim()));
  if (named) return named;
  return [...pool].sort(
    (a, b) =>
      new Date(a.createdAt ?? a.created_at ?? 0).getTime() -
      new Date(b.createdAt ?? b.created_at ?? 0).getTime()
  )[0];
}

/**
 * Sync merge once tokens are resolved into `assetsByToken`.
 * Exported for tests / smoke scripts.
 */
export function mergePortfolioImportWithAssets({
  currentRows,
  importedRows,
  assetsByToken,
  makeRowId,
}) {
  const incoming = importedRows.filter((row) => String(row.ticker ?? '').trim());
  const current = currentRows.filter((row) => String(row.ticker ?? '').trim());
  if (!incoming.length) {
    return { merged: current, reviewRows: [], staleRows: [], unmappedCount: 0 };
  }

  const importedByAlias = new Map();
  const importedList = [];

  for (const row of incoming) {
    const asset =
      assetsByToken.get(String(row.ticker ?? '').trim()) ||
      assetsByToken.get(String(row.isin ?? '').trim()) ||
      assetsByToken.get(String(row.amfi ?? row.amfiCode ?? row.schemeCode ?? '').trim()) ||
      null;
    const key = asset?.key ?? String(row.ticker).trim();
    const isin = holdingIsin(row.isin) || holdingIsin(asset?.isin) || holdingIsin(row.ticker);
    const amfi =
      holdingAmfi(row.amfi) ||
      holdingAmfi(row.amfiCode) ||
      holdingAmfi(row.schemeCode) ||
      holdingAmfi(asset?.key) ||
      holdingAmfi(row.ticker);
    const prepared = {
      ...row,
      ticker: key,
      name: asset ? (asset.kind === 'fund' ? asset.name : asset.symbol ?? row.name) : row.name,
      isin,
      amfi: amfi || null,
      unmapped: !asset,
      missingFromImport: false,
      _importId: row.id || `imp_${importedList.length}_${key}`,
    };
    importedList.push(prepared);

    for (const alias of holdingMatchAliases(prepared, asset)) {
      indexAlias(importedByAlias, alias, prepared);
    }
  }

  const merged = [];
  const reviewRows = [];
  const staleRows = [];
  const consumed = new Set();

  for (const row of current) {
    const asset =
      assetsByToken.get(String(row.ticker ?? '').trim()) ||
      assetsByToken.get(String(row.isin ?? '').trim()) ||
      assetsByToken.get(String(row.amfi ?? row.amfiCode ?? row.schemeCode ?? '').trim()) ||
      null;
    const key = asset?.key ?? String(row.ticker).trim();
    const aliases = holdingMatchAliases(
      {
        ...row,
        ticker: key,
        isin: holdingIsin(row.isin) || holdingIsin(asset?.isin),
        amfi: holdingAmfi(row.amfi) || holdingAmfi(row.amfiCode) || holdingAmfi(asset?.key),
        name: row.name || asset?.name || '',
      },
      asset
    );
    const imported = findIndexed(importedByAlias, aliases);

    if (imported && !consumed.has(imported._importId)) {
      const next = {
        ...row,
        ...imported,
        ticker: key || imported.ticker,
        isin: imported.isin ?? holdingIsin(row.isin) ?? holdingIsin(asset?.isin),
        amfi: imported.amfi ?? holdingAmfi(row.amfi) ?? holdingAmfi(asset?.key),
        id: row.id,
        missingFromImport: false,
      };
      delete next._importId;
      merged.push(next);
      consumed.add(imported._importId);
      reviewRows.push({
        ...next,
        matchStatus: qtysEqual(row.qty, imported.qty) ? 'unchanged' : 'updated',
        priorQty: row.qty,
      });
    } else {
      const stale = {
        ...row,
        isin: holdingIsin(row.isin) ?? holdingIsin(asset?.isin),
        missingFromImport: true,
      };
      merged.push(stale);
      staleRows.push(stale);
    }
  }

  for (const imported of importedList) {
    if (consumed.has(imported._importId)) continue;
    const next = {
      ...imported,
      id: typeof makeRowId === 'function' ? makeRowId() : `row_${imported.ticker}`,
      missingFromImport: false,
    };
    delete next._importId;
    merged.push(next);
    reviewRows.push({ ...next, matchStatus: 'new' });
  }

  const unmappedCount = incoming.filter((row) => {
    const token = String(row.ticker ?? '').trim();
    const isin = String(row.isin ?? '').trim();
    const amfi = String(row.amfi ?? row.amfiCode ?? row.schemeCode ?? '').trim();
    return !assetsByToken.has(token) && !assetsByToken.has(isin) && !assetsByToken.has(amfi);
  }).length;

  return { merged, reviewRows, staleRows, unmappedCount };
}

/**
 * Preview merge of imported edit-rows into current edit-rows (no blank trailer).
 * Matches duplicates by resolved asset key, ISIN, AMFI/scheme code, or name:
 * - same identity + same qty → unchanged
 * - same identity + different qty → updated
 * - import-only → new
 * - current-only → stale
 *
 * @returns {{ merged: object[], reviewRows: object[], staleRows: object[], unmappedCount: number }}
 */
export async function previewPortfolioImportMerge({ currentRows, importedRows, makeRowId }) {
  const incoming = importedRows.filter((row) => String(row.ticker ?? '').trim());
  const current = currentRows.filter((row) => String(row.ticker ?? '').trim());
  if (!incoming.length) {
    return { merged: current, reviewRows: [], staleRows: [], unmappedCount: 0 };
  }

  const resolveTokens = [
    ...current.flatMap((row) => [row.ticker, row.isin, row.amfi, row.amfiCode, row.schemeCode]),
    ...incoming.flatMap((row) => [row.ticker, row.isin, row.amfi, row.amfiCode, row.schemeCode]),
  ];
  const assetsByToken = await resolvePortfolioAssets(resolveTokens);
  return mergePortfolioImportWithAssets({
    currentRows: current,
    importedRows: incoming,
    assetsByToken,
    makeRowId,
  });
}

/** Merge onboarding holdings `{ ticker, qty }` by ticker (sum qty). Cost basis ignored. */
export function mergeOnboardingHoldings(existing, incoming) {
  const byTicker = new Map();
  for (const h of [...(existing ?? []), ...(incoming ?? [])]) {
    const ticker = String(h?.ticker ?? '').trim().toUpperCase();
    if (!ticker) continue;
    const qty = Number(h.qty) || 0;
    const prev = byTicker.get(ticker);
    if (!prev) {
      byTicker.set(ticker, {
        ticker,
        qty,
        avg: 0,
        isin: h.isin ?? null,
        amfi: h.amfi ?? h.amfiCode ?? null,
      });
      continue;
    }
    byTicker.set(ticker, {
      ticker,
      qty: prev.qty + qty,
      avg: 0,
      isin: prev.isin || h.isin || null,
      amfi: prev.amfi || h.amfi || h.amfiCode || null,
    });
  }
  return [...byTicker.values()];
}
