import { resolvePortfolioAssets } from './portfolioAssetUniverse';

const ISIN_RE = /^[A-Z0-9]{12}$/;

export function holdingIsin(value) {
  const isin = String(value ?? '').trim().toUpperCase();
  return ISIN_RE.test(isin) ? isin : null;
}

export function holdingFallbackName(row) {
  const value = String(row?.name ?? row?.ticker ?? '').trim().toUpperCase();
  // Broker/exchange series badges are temporary suffixes: GOLDBEES-X,
  // GOLDBEES - SE, etc. Keep the stable root for non-ISIN matching.
  return value.replace(/\s*-\s*[A-Z]{1,3}$/, '').trim();
}

/** Prefer a published live book named My portfolio; else oldest published live; else first published. */
export function pickMainPortfolio(portfolios) {
  const published = (portfolios ?? []).filter((p) => p && !p.isDraft && !p.isArchived);
  if (!published.length) return null;
  const live = published.filter((p) => (p.kind ?? 'live') !== 'watchlist');
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
 * Preview merge of imported edit-rows into current edit-rows (no blank trailer).
 * @returns {{ merged: object[], reviewRows: object[], staleRows: object[], unmappedCount: number }}
 */
export async function previewPortfolioImportMerge({ currentRows, importedRows, makeRowId }) {
  const incoming = importedRows.filter((row) => String(row.ticker ?? '').trim());
  const current = currentRows.filter((row) => String(row.ticker ?? '').trim());
  if (!incoming.length) {
    return { merged: current, reviewRows: [], staleRows: [], unmappedCount: 0 };
  }

  const assetsByToken = await resolvePortfolioAssets([
    ...current.map((row) => row.ticker),
    ...incoming.map((row) => row.ticker),
  ]);

  const importedByIsin = new Map();
  const importedByFallbackName = new Map();
  const importedRowsByKey = new Map();

  for (const row of incoming) {
    const asset = assetsByToken.get(row.ticker);
    const key = asset?.key ?? row.ticker;
    const isin = holdingIsin(row.isin);
    const prepared = {
      ...row,
      ticker: key,
      name: asset ? (asset.kind === 'fund' ? asset.name : asset.symbol ?? '') : row.name,
      isin,
      unmapped: !asset,
      missingFromImport: false,
    };
    importedRowsByKey.set(key, prepared);
    if (isin) importedByIsin.set(isin, prepared);
    else {
      const fallbackName = holdingFallbackName(prepared);
      if (fallbackName) importedByFallbackName.set(fallbackName, prepared);
    }
  }

  const merged = [];
  const reviewRows = [];
  const staleRows = [];
  const consumed = new Set();

  for (const row of current) {
    const asset = assetsByToken.get(row.ticker);
    const key = asset?.key ?? row.ticker;
    const existingIsin = holdingIsin(row.isin) ?? holdingIsin(asset?.isin);
    const imported = existingIsin
      ? importedByIsin.get(existingIsin)
      : importedByFallbackName.get(holdingFallbackName(row));

    if (imported) {
      const next = {
        ...row,
        ...imported,
        isin: imported.isin ?? existingIsin,
        id: row.id,
        missingFromImport: false,
      };
      merged.push(next);
      consumed.add(imported.ticker);
      const qtyChanged = String(row.qty ?? '') !== String(imported.qty ?? '');
      const invChanged = String(row.invested ?? '') !== String(imported.invested ?? '');
      reviewRows.push({
        ...next,
        matchStatus: qtyChanged || invChanged ? 'updated' : 'unchanged',
      });
    } else {
      const stale = { ...row, isin: existingIsin, missingFromImport: true };
      merged.push(stale);
      staleRows.push(stale);
    }
  }

  for (const [key, imported] of importedRowsByKey) {
    if (consumed.has(key)) continue;
    const next = {
      ...imported,
      id: typeof makeRowId === 'function' ? makeRowId() : `row_${key}`,
      missingFromImport: false,
    };
    merged.push(next);
    reviewRows.push({ ...next, matchStatus: 'new' });
  }

  const unmappedCount = incoming.filter((row) => !assetsByToken.has(row.ticker)).length;
  return { merged, reviewRows, staleRows, unmappedCount };
}

/** Merge onboarding holdings `{ ticker, qty, avg }` by ticker (sum qty, VWAP avg). */
export function mergeOnboardingHoldings(existing, incoming) {
  const byTicker = new Map();
  for (const h of [...(existing ?? []), ...(incoming ?? [])]) {
    const ticker = String(h?.ticker ?? '').trim().toUpperCase();
    if (!ticker) continue;
    const qty = Number(h.qty) || 0;
    const avg = Number(h.avg) || 0;
    const prev = byTicker.get(ticker);
    if (!prev) {
      byTicker.set(ticker, { ticker, qty, avg, isin: h.isin ?? null });
      continue;
    }
    const totalQty = prev.qty + qty;
    const invested = prev.qty * prev.avg + qty * avg;
    byTicker.set(ticker, {
      ticker,
      qty: totalQty,
      avg: totalQty > 0 ? invested / totalQty : avg,
      isin: prev.isin || h.isin || null,
    });
  }
  return [...byTicker.values()];
}
