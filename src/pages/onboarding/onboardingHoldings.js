/**
 * Broker holdings screenshot parsing for onboarding.
 * Uses Zerodha Kite (mobile + desktop) and Groww OCR from mcp-playground.
 */

const ACCEPTED_SOURCES = new Set(['kite', 'groww-stocks', 'groww-mf']);

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
    const index = i;
    const report = (pctWithinFile) => {
      const clamped = Math.max(0, Math.min(100, Number(pctWithinFile) || 0));
      const percent = Math.min(
        99,
        Math.round(((index + clamped / 100) / images.length) * 100)
      );
      onProgress?.({
        percent,
        current: index + 1,
        total: images.length,
        fileName: file.name || `Screenshot ${index + 1}`,
      });
    };

    // Always announce the new milestone before OCR starts so the UI advances
    // even if the worker logger is quiet briefly.
    report(0);
    // Yield so React can paint "Screenshot N of M" before heavy OCR work.
    await new Promise((resolve) => setTimeout(resolve, 32));

    try {
      const raw = await parseScreenshot(file, {
        onProgress: (pct) => report(pct),
      });
      const normalized = toPlaygroundHoldings(raw);
      if (normalized?.source && !ACCEPTED_SOURCES.has(normalized.source)) {
        lastError = new Error(
          `“${file.name || 'screenshot'}” does not look like a Zerodha or Groww holdings screen.`
        );
        report(100);
        continue;
      }
      const rows = playgroundHoldingsToExtracted(normalized);
      if (!rows.length) {
        lastError = new Error(
          `No holdings found in “${file.name || 'screenshot'}”. Use a clear Zerodha Kite or Groww holdings screen.`
        );
        report(100);
        continue;
      }
      extracted.push(...rows);
      report(100);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      report(100);
    }
  }

  onProgress?.({
    percent: 100,
    current: images.length,
    total: images.length,
    fileName: '',
  });

  try {
    await terminateOcrWorker();
  } catch {
    /* ignore worker cleanup errors */
  }

  if (!extracted.length) {
    throw (
      lastError ??
      new Error('No holdings found. Use clear Zerodha Kite or Groww holdings screenshots.')
    );
  }

  return mergeHoldingsToEditRows(extracted);
}

function playgroundHoldingsToExtracted(parsed) {
  const rows = [];
  const isGrowwMf = parsed?.source === 'groww-mf';

  for (const h of parsed?.holdings ?? []) {
    const name = String(h.name ?? h.raw?.tradingsymbol ?? '').trim();
    if (!name) continue;

    const ticker = name.toUpperCase();

    let qty = Number(h.units);
    let invested = Number(h.invested);
    const avg = Number(h.raw?.average_price);

    if ((!Number.isFinite(invested) || invested <= 0) && Number.isFinite(qty) && qty > 0 && Number.isFinite(avg)) {
      invested = qty * avg;
    }

    // Groww MF screens often omit units — keep the row using invested only.
    if ((!Number.isFinite(qty) || qty <= 0) && isGrowwMf && Number.isFinite(invested) && invested > 0) {
      qty = 1;
    }

    if (!Number.isFinite(qty) || qty <= 0) continue;

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
    const isin = String(row.isin ?? '').trim().toUpperCase();
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
        isin: /^[A-Z0-9]{12}$/.test(isin) ? isin : null,
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
      isin: prior.isin || (/^[A-Z0-9]{12}$/.test(isin) ? isin : null),
    });
  }

  return [...byTicker.values()].map((row) => {
    const avg = row.qty > 0 ? row.invested / row.qty : 0;
    return {
      id: crypto.randomUUID(),
      ticker: row.ticker,
      name: row.name,
      isin: row.isin,
      qty: String(row.qty),
      invested: String(Math.round(row.invested * 100) / 100),
      avg: String(Math.round(avg * 10000) / 10000),
    };
  });
}
