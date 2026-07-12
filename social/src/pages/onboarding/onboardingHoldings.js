/**
 * Broker holdings screenshot parsing for onboarding.
 * Uses the Zerodha Kite + Groww OCR pipeline from mcp-playground.
 */

const SYMBOL_RE = /^[A-Z][A-Z0-9&-]{1,14}$/;

/**
 * Parse one or more broker holdings screenshots and merge into edit rows
 * shaped like the in-app portfolio table: ticker, invested, qty.
 */
export async function parseZerodhaHoldingsScreenshots(files, { onProgress } = {}) {
  const images = [...(files ?? [])].filter((file) => file?.type?.startsWith('image/'));
  if (!images.length) {
    throw new Error('Please upload at least one screenshot image (PNG or JPG).');
  }

  const { parseScreenshot, toPlaygroundHoldings, terminateOcrWorker } = await import(
    '../../lib/brokerScreenshotOcr/screenshotOcr.js'
  );

  const extracted = [];
  let lastError = null;

  for (let i = 0; i < images.length; i += 1) {
    const file = images[i];
    const base = Math.round((i / images.length) * 100);
    const span = Math.round(100 / images.length);

    try {
      const raw = await parseScreenshot(file, {
        onProgress: (pct) => {
          const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
          onProgress?.(Math.min(99, base + Math.round((clamped / 100) * span)));
        },
      });
      const normalized = toPlaygroundHoldings(raw);
      const rows = playgroundHoldingsToExtracted(normalized);
      if (!rows.length) {
        lastError = new Error(
          `No holdings found in “${file.name || 'screenshot'}”. Use a clear Zerodha Kite or Groww holdings screen.`
        );
        continue;
      }
      extracted.push(...rows);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  onProgress?.(100);

  try {
    await terminateOcrWorker();
  } catch {
    /* ignore worker cleanup errors */
  }

  if (!extracted.length) {
    throw lastError ?? new Error('No holdings found. Use clear Zerodha or Groww holdings screenshots.');
  }

  return mergeHoldingsToEditRows(extracted);
}

function playgroundHoldingsToExtracted(parsed) {
  const source = parsed?.source ?? '';
  const rows = [];

  for (const h of parsed?.holdings ?? []) {
    const name = String(h.name ?? h.raw?.tradingsymbol ?? '').trim();
    if (!name) continue;

    let ticker = '';
    if (source === 'kite' || SYMBOL_RE.test(name.toUpperCase())) {
      ticker = name.toUpperCase();
    } else {
      // Groww often gives company / fund names — keep searchable text in ticker field.
      ticker = name;
    }

    const qty = Number(h.units);
    let invested = Number(h.invested);
    const avg = Number(h.raw?.average_price);

    if ((!Number.isFinite(invested) || invested <= 0) && Number.isFinite(qty) && qty > 0 && Number.isFinite(avg)) {
      invested = qty * avg;
    }

    // Mutual funds may lack units; keep invested so user can fill qty in review.
    const isMf = source === 'groww-mf' || h.assetType === 'MF';
    if (!Number.isFinite(qty) || qty <= 0) {
      if (!isMf) continue;
      rows.push({
        ticker,
        name,
        qty: 1,
        avg: Number.isFinite(invested) && invested > 0 ? invested : 0,
        invested: Number.isFinite(invested) ? invested : 0,
      });
      continue;
    }

    if (!Number.isFinite(invested) || invested < 0) {
      if (!ticker) continue;
      rows.push({
        ticker,
        name,
        qty,
        avg: Number.isFinite(avg) ? avg : 0,
        invested: Number.isFinite(avg) ? qty * avg : 0,
      });
      continue;
    }

    rows.push({
      ticker,
      name,
      qty,
      avg: qty > 0 ? invested / qty : 0,
      invested,
    });
  }

  return rows;
}

export function mergeHoldingsToEditRows(rows) {
  const byTicker = new Map();

  for (const row of rows) {
    const ticker = String(row.ticker ?? '').trim();
    const key = ticker.toUpperCase();
    const qty = Number(row.qty) || 0;
    const invested = Number(row.invested);
    const avg = Number(row.avg) || 0;
    if (!ticker || qty <= 0) continue;

    const rowInvested =
      Number.isFinite(invested) && invested >= 0 ? invested : qty * avg;

    const prior = byTicker.get(key);
    if (!prior) {
      byTicker.set(key, {
        ticker,
        name: row.name ?? '',
        qty,
        invested: rowInvested,
      });
      continue;
    }

    const nextQty = prior.qty + qty;
    const nextInvested = prior.invested + rowInvested;
    byTicker.set(key, {
      ...prior,
      qty: nextQty,
      invested: nextInvested,
      name: prior.name || row.name || '',
    });
  }

  return [...byTicker.values()].map((row) => ({
    id: crypto.randomUUID(),
    ticker: row.ticker,
    name: row.name,
    qty: String(row.qty),
    invested: String(Math.round(row.invested * 100) / 100),
  }));
}
