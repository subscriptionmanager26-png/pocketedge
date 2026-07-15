/**
 * Zerodha Kite *desktop* holdings table OCR.
 * Layout: Instrument | Qty. | Avg. cost | LTP | Invested | Cur. val | P&L | Net chg. | Day chg.
 * Mobile card layout stays in screenshot-ocr.js.
 */

const DESKTOP_LABELS = new Set([
  'instrument',
  'qty',
  'qty.',
  'avg',
  'avg.',
  'cost',
  'ltp',
  'invested',
  'cur',
  'cur.',
  'val',
  'val.',
  'p&l',
  'pnl',
  'net',
  'chg',
  'chg.',
  'day',
  'total',
  'event',
  'family',
  'analytics',
  'download',
  'search',
  'equity',
  'all',
  'holdings',
  'dashboard',
  'orders',
  'positions',
  'bids',
  'funds',
  'current',
  'value',
  'nifty',
  'sensex',
]);

const SYMBOL_RE = /^[A-Z][A-Z0-9&-]{1,18}$/;
const NUM_RE = /^[+-]?[\d,]+\.?\d*%?$/;
const AMT_RE = /^[+-]?[\d,]+\.\d{2}$/;
const PCT_RE = /^[+-]?\d[\d,]*\.?\d*%$/;

const BLOCKED_SYMBOLS = new Set([
  'NIFTY',
  'SENSEX',
  'BANKNIFTY',
  'FINNIFTY',
  'WATCHLIST',
  'DASHBOARD',
  'HOLDINGS',
  'POSITIONS',
  'ORDERS',
  'FUNDS',
  'BIDS',
  'INSTRUMENT',
  'TOTAL',
  'FAMILY',
  'ANALYTICS',
  'DOWNLOAD',
  'SEARCH',
  'DEFAULT',
  'CURRENTVALUE',
  'INVESTED',
  'CI',
]);

function parseIndianNumber(text) {
  if (!text) return null;
  const cleaned = String(text)
    .trim()
    .replace(/,/g, '')
    .replace(/%/g, '')
    .replace(/₹/g, '')
    .replace(/[^\d.\-+]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function fv(raw, value = null, conf = 0) {
  if (raw == null) {
    return { value: null, raw: null, present: false, confidence: 'missing' };
  }
  const confidence = conf >= 75 ? 'high' : conf >= 50 ? 'medium' : 'low';
  return { value, raw, present: true, confidence };
}

function fullText(tokens) {
  return tokens.map((t) => t.text).join(' ').toLowerCase();
}

function normLabel(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[.]/g, '')
    .trim();
}

/**
 * Desktop Kite shows headers once + many numeric rows.
 * Mobile shows a "Qty." label on every card (≥3 qty labels).
 */
export function isKiteDesktopLayout(tokens) {
  const text = fullText(tokens);
  return isKiteDesktopLayoutFromText(text, tokens);
}

export function isKiteDesktopLayoutFromText(text, tokens = []) {
  const lower = String(text || '').toLowerCase();
  const qtyLabels = tokens.filter((t) => /^qty\.?$/i.test(t.text)).length;
  const hasInstrument = /\binstrument\b/i.test(lower);
  const hasAvgCost = /\bavg\.?\s*cost\b/i.test(lower) || (lower.includes('avg') && lower.includes('cost'));
  const hasCurVal = /\bcur\.?\s*val\b/i.test(lower) || (lower.includes('cur') && lower.includes('val'));
  const hasNetChg = lower.includes('net') && lower.includes('chg');
  const hasDesktopNav =
    lower.includes('dashboard') ||
    (lower.includes('holdings') && lower.includes('orders') && lower.includes('positions'));
  const hasHoldingsTitle = /holdings\s*\(\d+\)/i.test(lower) || /\bholdings\b/i.test(lower);
  const desktopRows = countDesktopStyleRows(text);

  // Mobile cards put a "Qty." label on every row.
  if (qtyLabels >= 3 && desktopRows < 2) return false;

  // Strongest signal: OCR already produced several desktop table data rows.
  if (desktopRows >= 2) return true;

  if (hasInstrument && (hasAvgCost || hasCurVal || hasNetChg)) return true;
  if (hasDesktopNav && (hasInstrument || hasAvgCost || desktopRows >= 1)) return true;
  if (hasHoldingsTitle && hasAvgCost && hasNetChg) return true;
  if (hasHoldingsTitle && desktopRows >= 1) return true;
  return false;
}

/** Count lines that look like Kite desktop holdings rows (symbol + several numbers). */
export function countDesktopStyleRows(ocrText) {
  return parseKiteDesktopTextLines(ocrText).length;
}

function clusterRows(tokens, yTol = 10) {
  const sorted = [...tokens].sort((a, b) => a.top - b.top || a.left - b.left);
  const rows = [];
  for (const t of sorted) {
    const cy = t.top + t.height / 2;
    const last = rows[rows.length - 1];
    if (last && Math.abs(cy - last.cy) <= yTol) {
      last.tokens.push(t);
      last.cy = (last.cy * (last.tokens.length - 1) + cy) / last.tokens.length;
    } else {
      rows.push({ cy, tokens: [t] });
    }
  }
  for (const r of rows) {
    r.tokens.sort((a, b) => a.left - b.left);
  }
  return rows;
}

function findHeaderColumns(tokens) {
  const textJoin = (row) => row.tokens.map((t) => t.text).join(' ').toLowerCase();

  const rows = clusterRows(tokens, 8);
  let headerRow = null;
  for (const row of rows) {
    const joined = textJoin(row);
    const score =
      (joined.includes('instrument') ? 3 : 0) +
      (/\bqty\b/.test(joined) ? 2 : 0) +
      (joined.includes('avg') ? 1 : 0) +
      (joined.includes('ltp') ? 2 : 0) +
      (joined.includes('invested') ? 2 : 0) +
      (joined.includes('cur') ? 1 : 0) +
      (joined.includes('p&l') || joined.includes('pnl') ? 2 : 0) +
      (joined.includes('net') ? 1 : 0) +
      (joined.includes('day') ? 1 : 0);
    if (score >= 8) {
      headerRow = row;
      break;
    }
  }

  // Fallback: hunt individual header tokens in the top half
  const topTokens = tokens.filter((t) => t.top < Math.max(...tokens.map((x) => x.top)) * 0.45);
  const pick = (re) => {
    const hits = (headerRow?.tokens || topTokens).filter((t) => re.test(t.text));
    if (!hits.length) return null;
    const t = hits.reduce((a, b) => (a.left < b.left ? a : b));
    return t.left + t.width / 2;
  };

  // Multi-word headers: use left of first word, or mid between words when found adjacent
  function pickPair(reA, reB) {
    const pool = headerRow?.tokens || topTokens;
    for (let i = 0; i < pool.length; i++) {
      if (!reA.test(pool[i].text)) continue;
      for (let j = i + 1; j < Math.min(i + 3, pool.length); j++) {
        if (reB.test(pool[j].text) && Math.abs(pool[j].top - pool[i].top) < 16) {
          return (pool[i].left + pool[j].left + pool[j].width) / 2;
        }
      }
      return pool[i].left + pool[i].width / 2;
    }
    return null;
  }

  const cols = {
    instrument: pick(/^instrument$/i),
    qty: pick(/^qty\.?$/i),
    avg_cost: pickPair(/^avg\.?$/i, /^cost$/i) ?? pick(/^avg\.?$/i),
    ltp: pick(/^ltp$/i),
    invested: pick(/^invested$/i),
    cur_val: pickPair(/^cur\.?$/i, /^val\.?$/i) ?? pick(/^cur\.?$/i),
    pnl: pick(/^p&l$/i) ?? pick(/^pnl$/i),
    net_chg: pickPair(/^net$/i, /^chg\.?$/i) ?? pick(/^net$/i),
    day_chg: pickPair(/^day$/i, /^chg\.?$/i) ?? pick(/^day$/i),
  };

  const headerBottom = headerRow
    ? Math.max(...headerRow.tokens.map((t) => t.top + t.height)) + 4
    : Math.min(...Object.values(cols).filter((v) => v != null)) + 30;

  return { cols, headerBottom, headerRow };
}

function nearestCol(x, cols) {
  let best = null;
  let bestDist = Infinity;
  for (const [name, cx] of Object.entries(cols)) {
    if (cx == null) continue;
    const d = Math.abs(x - cx);
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}

function isSymbolToken(t) {
  const up = t.text.toUpperCase();
  if (!SYMBOL_RE.test(up)) return false;
  if (DESKTOP_LABELS.has(normLabel(up))) return false;
  if (BLOCKED_SYMBOLS.has(up)) return false;
  if (/^(NSE|BSE|NFO|CDS|MCX)$/i.test(up)) return false;
  return true;
}

function correctOcrSymbol(symbol) {
  let s = String(symbol || '').toUpperCase();
  // Common Tesseract confusions on SGB / ticker glyphs
  s = s.replace(/VIIL\b/g, 'VIII');
  s = s.replace(/VIll\b/g, 'VIII');
  s = s.replace(/VlII\b/g, 'VIII');
  s = s.replace(/SGBJ28VIIL\b/g, 'SGBJ28VIII');
  s = s.replace(/SKYGOID\b/g, 'SKYGOLD');
  s = s.replace(/SKYGO1D\b/g, 'SKYGOLD');
  return s;
}

function emptyHolding() {
  return {
    symbol: fv(null),
    quantity: fv(null),
    avg_price: fv(null),
    invested: fv(null),
    cur_val: fv(null),
    pnl_amount: fv(null),
    pnl_percent: fv(null),
    ltp: fv(null),
    ltp_day_change_pct: fv(null),
    tags: [],
    row_status: 'complete',
    issues: [],
  };
}

function assignField(row, col, token) {
  const text = token.text;
  const conf = token.conf;
  const val = parseIndianNumber(text);

  if (col === 'qty') {
    if (/^[\d,]+$/.test(text) && !text.includes('.')) {
      row.quantity = fv(text, val, conf);
    }
    return;
  }
  if (col === 'avg_cost') {
    if (AMT_RE.test(text) || /^[\d,]+\.\d+$/.test(text)) {
      row.avg_price = fv(text, val, conf);
    }
    return;
  }
  if (col === 'ltp') {
    if (AMT_RE.test(text) || /^[\d,]+\.\d+$/.test(text) || /^[\d,]+\.?\d*$/.test(text)) {
      row.ltp = fv(text, val, conf);
    }
    return;
  }
  if (col === 'invested') {
    if (AMT_RE.test(text) || /^[\d,]+\.\d+$/.test(text)) {
      row.invested = fv(text, val, conf);
    }
    return;
  }
  if (col === 'cur_val') {
    if (AMT_RE.test(text) || /^[\d,]+\.\d+$/.test(text)) {
      row.cur_val = fv(text, val, conf);
    }
    return;
  }
  if (col === 'pnl') {
    if (AMT_RE.test(text) || /^[+-]?[\d,]+\.\d+$/.test(text)) {
      row.pnl_amount = fv(text, val, conf);
    }
    return;
  }
  if (col === 'net_chg') {
    if (PCT_RE.test(text) || text.includes('%')) {
      row.pnl_percent = fv(text, val, conf);
    }
    return;
  }
  if (col === 'day_chg') {
    if (PCT_RE.test(text) || text.includes('%') || /^[+-]?[\d,]+\.\d+%?$/.test(text)) {
      row.ltp_day_change_pct = fv(text, val, conf);
    }
    return;
  }
}

/**
 * Fallback when header columns are incomplete:
 * After symbol, consume numbers left→right as:
 * qty, avg, ltp, invested, cur_val, pnl, net%, day%
 */
function parseRowSequential(tokens) {
  const row = emptyHolding();
  const nums = [];
  for (const t of tokens) {
    if (/^event$/i.test(t.text)) {
      row.tags.push('EVENT');
      continue;
    }
    if (isSymbolToken(t) && !row.symbol.present) {
      const sym = correctOcrSymbol(t.text);
      row.symbol = fv(t.text, sym, t.conf);
      continue;
    }
    if (NUM_RE.test(t.text) || PCT_RE.test(t.text) || AMT_RE.test(t.text)) {
      nums.push(t);
    }
  }
  if (!row.symbol.present) return null;

  const order = [
    'quantity',
    'avg_price',
    'ltp',
    'invested',
    'cur_val',
    'pnl_amount',
    'pnl_percent',
    'ltp_day_change_pct',
  ];

  let i = 0;
  for (const t of nums) {
    if (i >= order.length) break;
    const field = order[i];
    const isPct = t.text.includes('%');
    if (field === 'quantity') {
      if (t.text.includes('.') || isPct) continue;
      row.quantity = fv(t.text, parseIndianNumber(t.text), t.conf);
      i++;
      continue;
    }
    if (field === 'pnl_percent' || field === 'ltp_day_change_pct') {
      if (!isPct && i < order.length - 1 && !AMT_RE.test(t.text)) {
        // sometimes day chg is 0.00 without seeing % due to OCR — still accept near end
        if (i < 6) continue;
      }
      row[field] = fv(t.text, parseIndianNumber(t.text), t.conf);
      i++;
      continue;
    }
    if (isPct) {
      // jumped to percent early — skip to percent fields
      while (i < order.length && order[i] !== 'pnl_percent' && order[i] !== 'ltp_day_change_pct') i++;
      if (i >= order.length) break;
      row[order[i]] = fv(t.text, parseIndianNumber(t.text), t.conf);
      i++;
      continue;
    }
    row[field] = fv(t.text, parseIndianNumber(t.text), t.conf);
    i++;
  }

  return finalizeRow(row);
}

function finalizeRow(row) {
  if (!row.symbol.present) return null;
  if (/^total$/i.test(row.symbol.value)) return null;

  // Derive missing invested / cur_val when possible
  if (!row.invested.present && row.quantity.present && row.avg_price.present) {
    const v = Math.round(row.quantity.value * row.avg_price.value * 100) / 100;
    row.invested = fv(String(v), v, 40);
    row.issues.push('invested_derived');
  }
  if (!row.cur_val.present && row.quantity.present && row.ltp.present) {
    const v = Math.round(row.quantity.value * row.ltp.value * 100) / 100;
    row.cur_val = fv(String(v), v, 40);
    row.issues.push('cur_val_derived');
  }
  if (!row.pnl_amount.present && row.cur_val.present && row.invested.present) {
    const v = Math.round((row.cur_val.value - row.invested.value) * 100) / 100;
    row.pnl_amount = fv(String(v), v, 40);
    row.issues.push('pnl_derived');
  }

  const missing = [];
  if (!row.quantity.present) missing.push('units');
  if (!row.avg_price.present) missing.push('avg_price');
  if (!row.ltp.present) missing.push('price');
  if (!row.invested.present) missing.push('invested');

  row.row_status = missing.length ? 'partial' : 'complete';
  for (const m of missing) row.issues.push(`missing:${m}`);
  return row;
}

/**
 * Desktop OCR often returns one row per line:
 * ANANTRAJ 150 478.81 575.55 71,821.50 86,332.50 14,511.00 +20.20% +0.33%
 * Also tolerate mangled OCR: +2020%, missing dots, EVENT tags, etc.
 */
export function parseKiteDesktopTextLines(ocrText) {
  const holdings = [];
  const seen = new Set();
  const lines = String(ocrText || '').split(/\r?\n/);

  for (const line of lines) {
    const cleaned = line.replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;
    if (/^instrument\b/i.test(cleaned)) continue;
    if (/^total\b/i.test(cleaned)) continue;
    if (/holdings\s*\(/i.test(cleaned)) continue;
    if (/total investment|current value|day'?s p&l|allequity|analytics|download/i.test(cleaned)) {
      continue;
    }

    const holding = parseDesktopDataLine(cleaned);
    if (!holding?.symbol?.present) continue;
    const symbol = holding.symbol.value;
    if (seen.has(symbol) || DESKTOP_LABELS.has(symbol.toLowerCase())) continue;
    seen.add(symbol);
    holdings.push(holding);
  }

  return holdings;
}

function parseDesktopDataLine(cleaned) {
  const parts = cleaned.split(/\s+/);
  if (parts.length < 4) return null;

  let idx = 0;
  let symbolRaw = parts[idx];
  if (!SYMBOL_RE.test(symbolRaw.toUpperCase())) return null;
  if (DESKTOP_LABELS.has(normLabel(symbolRaw))) return null;
  idx += 1;

  const tags = [];
  let pendingQty = 0;
  let availableQty = null;

  // EVENT badge and/or T1/T2 settlement badges (undelivered units).
  // OCR forms: "T1:100", "T1: 100", "T2:50"
  while (idx < parts.length) {
    if (/^event$/i.test(parts[idx])) {
      tags.push('EVENT');
      idx += 1;
      continue;
    }
    let settle = parts[idx].match(/^T([12]):\s*(\d+)$/i);
    if (!settle && /^T([12]):$/i.test(parts[idx]) && parts[idx + 1] && /^\d+$/.test(parts[idx + 1])) {
      settle = [null, parts[idx].match(/^T([12]):$/i)[1], parts[idx + 1]];
      idx += 1; // consume the number token below via idx++
    }
    if (settle) {
      const n = Number(settle[2]);
      pendingQty += n;
      tags.push(`T${settle[1]}:${n}`);
      idx += 1;
      continue;
    }
    break;
  }

  const nums = [];
  for (; idx < parts.length; idx++) {
    const p = parts[idx];
    if (!/[0-9]/.test(p)) continue;
    // Skip settlement tokens that leaked into numeric scan
    if (/^T[12]:/i.test(p)) continue;
    if (!/^[+-]?[\d,]+(?:\.\d+)?%?$/.test(p) && !/^[+-]?[\d,]+\.\d+%?$/.test(p)) {
      if (!/^[+-]?[\d,]+(?:\.\d*)?%?$/.test(p)) continue;
    }
    nums.push(p);
  }

  // Need qty, avg, ltp, invested, cur_val at minimum — rejects watchlist lines
  // like "SBIN 1027.80 +1.28%" and index headers.
  if (nums.length < 5) return null;

  const row = emptyHolding();
  const symbol = correctOcrSymbol(symbolRaw);
  if (BLOCKED_SYMBOLS.has(symbol)) return null;
  row.symbol = fv(symbolRaw, symbol, 90);
  row.tags = tags;

  let n = 0;
  const take = () => (n < nums.length ? nums[n++] : null);

  const qtyTok = take();
  if (!qtyTok || qtyTok.includes('%') || !/^\d{1,6}$/.test(qtyTok.replace(/,/g, ''))) {
    return null;
  }
  availableQty = parseIndianNumber(qtyTok);
  row.quantity = fv(qtyTok, availableQty, 90);

  // Zerodha shows Qty=0 with T1/T2 when units are bought but not yet delivered.
  // Use settlement qty as the economic quantity in that case.
  if ((availableQty === 0 || availableQty == null) && pendingQty > 0) {
    row.quantity = fv(`T:${pendingQty}`, pendingQty, 85);
    row.issues.push('qty_from_pending_delivery');
    if (!tags.includes('pending_delivery')) tags.push('pending_delivery');
    row.tags = tags;
  }

  const avgTok = take();
  row.avg_price = fv(avgTok, parseIndianNumber(avgTok), 90);

  const ltpTok = take();
  row.ltp = fv(ltpTok, parseIndianNumber(ltpTok), 90);

  const invTok = take();
  if (invTok) row.invested = fv(invTok, parseIndianNumber(invTok), 90);

  const curTok = take();
  if (curTok) row.cur_val = fv(curTok, parseIndianNumber(curTok), 90);

  const pnlTok = take();
  if (pnlTok && !String(pnlTok).includes('%')) {
    row.pnl_amount = fv(pnlTok, parseIndianNumber(pnlTok), 90);
  } else if (pnlTok) {
    row.pnl_percent = fv(pnlTok, parseIndianNumber(pnlTok), 90);
  }

  const netTok = take();
  if (netTok) {
    row.pnl_percent = row.pnl_percent.present
      ? row.pnl_percent
      : fv(netTok, parseIndianNumber(netTok), 90);
  }

  const dayTok = take();
  if (dayTok) row.ltp_day_change_pct = fv(dayTok, parseIndianNumber(dayTok), 90);

  // Sanity checks
  if (!row.quantity.present || !row.avg_price.present || !row.ltp.present) return null;
  if (!row.invested.present) return null;
  if (row.quantity.value <= 0 || row.quantity.value > 1_000_000) return null;
  if (row.avg_price.value <= 0) return null;

  // Invested should roughly equal Qty × Avg (OCR noise allowed)
  const expected = row.quantity.value * row.avg_price.value;
  if (expected > 0) {
    const ratio = row.invested.value / expected;
    if (ratio < 0.5 || ratio > 2.0) return null;
  }

  // Keep available vs pending on the raw field for UI
  row.available_qty = availableQty;
  row.pending_qty = pendingQty || null;

  return finalizeRow(row);
}

function tokensToRoughText(tokens) {
  if (!tokens?.length) return '';
  const rows = clusterRows(tokens, 12);
  return rows.map((r) => r.tokens.map((t) => t.text).join(' ')).join('\n');
}

function extractDesktopSummary(tokens) {
  const summary = {};
  const textTokens = tokens.filter((t) => t.top < 220 || /investment|current|day|total|p&l/i.test(t.text));

  for (let i = 0; i < tokens.length; i++) {
    const low = tokens[i].text.toLowerCase();
    const nearby = tokens.slice(i, Math.min(i + 6, tokens.length));

    if (low === 'investment' || (low === 'total' && tokens[i + 1]?.text.toLowerCase() === 'investment')) {
      const amt = nearby.find((t) => AMT_RE.test(t.text) && (parseIndianNumber(t.text) || 0) > 1000);
      if (amt && !summary.invested) {
        summary.invested = fv(amt.text, parseIndianNumber(amt.text), amt.conf);
      }
    }
    if (low === 'value' && tokens[i - 1]?.text.toLowerCase() === 'current') {
      const amt = nearby.find((t) => AMT_RE.test(t.text) && (parseIndianNumber(t.text) || 0) > 1000);
      if (amt && !summary.current) {
        summary.current = fv(amt.text, parseIndianNumber(amt.text), amt.conf);
      }
    }
  }

  // Also parse "Total" footer row: large invested + cur val + pnl
  const rows = clusterRows(tokens, 10);
  for (const row of rows) {
    const joined = row.tokens.map((t) => t.text).join(' ').toLowerCase();
    if (!joined.includes('total')) continue;
    const amts = row.tokens.filter((t) => AMT_RE.test(t.text));
    if (amts.length >= 2) {
      const sorted = [...amts].sort((a, b) => a.left - b.left);
      if (!summary.invested) {
        summary.invested = fv(sorted[0].text, parseIndianNumber(sorted[0].text), sorted[0].conf);
      }
      if (!summary.current && sorted[1]) {
        summary.current = fv(sorted[1].text, parseIndianNumber(sorted[1].text), sorted[1].conf);
      }
      if (!summary.pnl_amount && sorted[2]) {
        summary.pnl_amount = fv(sorted[2].text, parseIndianNumber(sorted[2].text), sorted[2].conf);
      }
    }
  }

  void textTokens;
  return summary;
}

export function parseKiteDesktopHoldings(tokens, canvas, ocrText = '') {
  const w = canvas.width;
  const h = canvas.height;

  // Prefer line-oriented text parse — desktop Kite OCRs as clean rows.
  // Prefer whichever of OCR text vs Y-clustered tokens yields more valid rows.
  // (Flattened OCR text without newlines can glue adjacent holdings together.)
  const fromOcrText = parseKiteDesktopTextLines(ocrText || '');
  const fromTokens = parseKiteDesktopTextLines(tokensToRoughText(tokens));
  let fromText = fromOcrText.length >= fromTokens.length ? fromOcrText : fromTokens;

  // Full-page screenshots include a left watchlist. Prefer holdings table tokens.
  let workingTokens = tokens;
  const textLower = String(ocrText || fullText(tokens)).toLowerCase();
  const hasSidebar =
    textLower.includes('watchlist') ||
    textLower.includes('search eg') ||
    textLower.includes('nifty 50');
  if (hasSidebar && tokens.length) {
    const tableTokens = tokens.filter((t) => t.left > w * 0.28);
    const tableText = tokensToRoughText(tableTokens);
    const fromTable = parseKiteDesktopTextLines(tableText);
    if (fromTable.length >= fromText.length) {
      fromText = fromTable;
      workingTokens = tableTokens;
    }
  }

  if (fromText.length >= 2) {
    const summary = extractDesktopSummary(workingTokens.length ? workingTokens : tokens);
    return {
      source_file: 'kite-desktop',
      screen_type: 'kite_desktop_table',
      image_size: [w, h],
      quality_issues: hasSidebar ? ['sidebar_cropped'] : [],
      portfolio_summary: summary,
      market_overview: {},
      days_pnl: summary.pnl_amount || { value: null, raw: null, present: false, confidence: 'missing' },
      holdings: fromText,
      fields_present: ['holdings_list'],
      fields_missing: [],
      layout: 'desktop',
      parse_mode: 'text_lines',
    };
  }

  tokens = workingTokens;
  const { cols, headerBottom } = findHeaderColumns(tokens);

  const colCount = Object.values(cols).filter((v) => v != null).length;
  const useColumns = colCount >= 5;

  const bodyTokens = tokens.filter((t) => t.top >= headerBottom && t.top < h * 0.92);
  const rows = clusterRows(bodyTokens, Math.max(8, Math.round(h * 0.012)));

  const holdings = [];
  const seen = new Set();

  for (const row of rows) {
    const joined = row.tokens.map((t) => t.text).join(' ').toLowerCase();
    if (joined.includes('total') && !row.tokens.some(isSymbolToken)) continue;
    if (/current value|invested|p&l/i.test(joined) && row.tokens.length < 4) continue;

    let holding = null;

    if (useColumns) {
      holding = emptyHolding();
      for (const t of row.tokens) {
        if (/^event$/i.test(t.text)) {
          holding.tags.push('EVENT');
          continue;
        }
    if (isSymbolToken(t) && !holding.symbol.present) {
      const sym = correctOcrSymbol(t.text);
      holding.symbol = fv(t.text, sym, t.conf);
      continue;
    }
        if (!(NUM_RE.test(t.text) || PCT_RE.test(t.text) || AMT_RE.test(t.text))) continue;
        const cx = t.left + t.width / 2;
        const col = nearestCol(cx, cols);
        if (!col || col === 'instrument') continue;
        assignField(holding, col, t);
      }
      holding = finalizeRow(holding);
    }

    if (!holding?.symbol?.present) {
      holding = parseRowSequential(row.tokens);
    }

    if (!holding?.symbol?.present) continue;
    const sym = holding.symbol.value;
    if (seen.has(sym)) continue;
    seen.add(sym);
    holdings.push(holding);
  }

  // Drop false positives from watchlist (sidebar) when full-page screenshots include it:
  // watchlist symbols usually lack a full 8-number row.
  const filtered = holdings.filter((h) => {
    const filled = [h.quantity, h.avg_price, h.ltp, h.invested].filter((f) => f?.present).length;
    return filled >= 2;
  });

  const summary = extractDesktopSummary(tokens);
  const present = new Set();
  const missing = new Set();
  if (filtered.length) present.add('holdings_list');
  else missing.add('holdings_list');
  for (const [k, v] of Object.entries(summary)) {
    if (v?.present) present.add(`summary.${k}`);
    else missing.add(`summary.${k}`);
  }

  return {
    source_file: 'kite-desktop',
    screen_type: 'kite_desktop_table',
    image_size: [w, h],
    quality_issues: useColumns ? [] : ['desktop_columns_partial_fallback_sequential'],
    portfolio_summary: summary,
    market_overview: {},
    days_pnl: summary.pnl_amount || { value: null, raw: null, present: false, confidence: 'missing' },
    holdings: filtered,
    fields_present: [...present].sort(),
    fields_missing: [...missing].sort(),
    layout: 'desktop',
  };
}
