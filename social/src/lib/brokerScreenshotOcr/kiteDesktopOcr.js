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
 * Desktop OCR returns equity tickers OR multi-word mutual fund names.
 * Fund names often wrap across lines, e.g.:
 *   Bandhan Small Cap
 *   Fund 199.858 50.03 55.557 ...
 *   ICICI Prudential
 *   219.335 45.59 ...
 *   Commodities Fund
 */
export function parseKiteDesktopTextLines(ocrText) {
  const holdings = [];
  const seen = new Set();
  const rawLines = String(ocrText || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  let pendingName = '';

  const skipLine = (cleaned) =>
    /^instrument\b/i.test(cleaned) ||
    /^total\b/i.test(cleaned) ||
    /holdings\s*\(/i.test(cleaned) ||
    /total investment|current value|day'?s p&l|allequity|analytics|download/i.test(cleaned) ||
    /^(un|u)$/i.test(cleaned);

  for (const cleaned of rawLines) {
    if (skipLine(cleaned)) continue;

    const parts = cleaned.split(/\s+/);
    const numIdx = findNumericRunStart(parts);

    if (numIdx < 0) {
      // Name-only fragment — buffer, or append as suffix to last holding
      if (/^[A-Za-z]/.test(cleaned) && !/^\d/.test(cleaned)) {
        const suffix = normalizeTrailingFundSuffix(cleaned);
        if (holdings.length && !pendingName && looksLikeNameSuffix(suffix || cleaned)) {
          appendNameSuffix(holdings, seen, suffix || cleaned);
        } else {
          pendingName = pendingName ? `${pendingName} ${cleaned}` : cleaned;
        }
      }
      continue;
    }

    const nameFromLine = parts.slice(0, numIdx).join(' ').trim();
    let name = `${pendingName} ${nameFromLine}`.replace(/\s+/g, ' ').trim();
    pendingName = '';

    // Strip trailing EVENT / T1 tags from the name side
    const tags = [];
    let pendingQty = 0;
    const nameParts = name ? name.split(/\s+/) : [];
    while (nameParts.length) {
      const last = nameParts[nameParts.length - 1];
      if (/^event$/i.test(last)) {
        tags.push('EVENT');
        nameParts.pop();
        continue;
      }
      const settle = last.match(/^T([12]):\s*(\d+)$/i);
      if (settle) {
        pendingQty += Number(settle[2]);
        tags.push(`T${settle[1]}:${settle[2]}`);
        nameParts.pop();
        continue;
      }
      break;
    }
    name = nameParts.join(' ').trim();

    const numTokens = parts.slice(numIdx);
    // Also allow T1/EVENT between name and numbers
    while (numTokens.length) {
      if (/^event$/i.test(numTokens[0])) {
        tags.push('EVENT');
        numTokens.shift();
        continue;
      }
      const settle = numTokens[0].match(/^T([12]):\s*(\d+)$/i);
      if (settle) {
        pendingQty += Number(settle[2]);
        tags.push(`T${settle[1]}:${settle[2]}`);
        numTokens.shift();
        continue;
      }
      break;
    }

    // Numbers-only rows are valid when a wrapped fund name is already pending
    // (e.g. "ICICI Prudential" then "219.335 45.59 …" then "Commodities Fund").
    if (!name) {
      continue;
    }

    const holding = parseNameAndNumbers(name, numTokens, tags, pendingQty);
    if (!holding?.symbol?.present) {
      // Numbers without a usable name — keep name buffer if any
      if (name) pendingName = name;
      continue;
    }

    const key = holdingKey(holding);
    if (seen.has(key)) continue;
    if (DESKTOP_LABELS.has(holding.symbol.value.toLowerCase())) continue;
    if (BLOCKED_SYMBOLS.has(holding.symbol.value.toUpperCase().replace(/\s+/g, ''))) continue;
    seen.add(key);
    holdings.push(holding);
  }

  return holdings;
}

function holdingKey(h) {
  // Dedup on qty+invested so temporary incomplete MF names don't block later rows
  const qty = h.quantity?.value;
  const inv = h.invested?.value;
  if (qty != null && inv != null) return `q:${qty}|i:${inv}`;
  return `s:${String(h.symbol.value || '').toUpperCase()}`;
}

function appendNameSuffix(holdings, seen, cleaned) {
  const last = holdings[holdings.length - 1];
  const oldKey = holdingKey(last);
  const next = `${last.symbol.value} ${cleaned}`.replace(/\s+/g, ' ').trim();
  last.symbol = fv(next, next, last.symbol.confidence === 'high' ? 85 : 70);
  if (/fund/i.test(cleaned)) last.asset_type_hint = 'MF';
  seen.delete(oldKey);
  seen.add(holdingKey(last));
}

/** OCR sometimes reads a lone "Fund" as FoomA / Fundd / etc. */
function normalizeTrailingFundSuffix(text) {
  const t = String(text || '').trim();
  if (/^f[o0]{1,2}[mn]\w{0,2}$/i.test(t) && t.length <= 6) return 'Fund';
  return t;
}

function isNumToken(p) {
  if (!p || !/[0-9]/.test(p)) return false;
  if (/^T[12]:/i.test(p)) return false;
  return /^[+-]?[\d,]+(?:\.\d+)?%?$/.test(p);
}

function findNumericRunStart(parts) {
  for (let i = 0; i < parts.length; i++) {
    let count = 0;
    for (let j = i; j < parts.length; j++) {
      if (isNumToken(parts[j])) count++;
      else break;
    }
    if (count >= 5) return i;
  }
  return -1;
}

/**
 * Trailing wrap fragments that complete the previous row's instrument name.
 * Must NOT match brand-led name starts like "Bandhan Small Cap".
 */
function looksLikeNameSuffix(text) {
  const t = String(text || '').trim();
  if (
    /^(bandhan|edelweiss|hdfc|icici|kotak|nippon|sbi|axis|mirae|uti|dsp|tata|quant|motilal|franklin|invesco|ppfas|aditya|hsbc|baroda|canara|groww|parag|pgim|trust|navi)/i.test(
      t,
    )
  ) {
    return false;
  }
  // Single-token equity tickers (not the word "Fund")
  if (SYMBOL_RE.test(t.toUpperCase()) && !/\s/.test(t) && !/^fund$/i.test(t)) return false;
  return /^(fund(\s+of\s+fund)?|of fund|index fund|(commodities|gilt|infrastructure|technology|arbitrage)\s+fund|(mid|small)\s+cap\s+fund|services\s+ex-?bank\s+index(\s+fund)?|technology\s+equity(\s+fund\s+of\s+fund)?)$/i.test(
    t,
  );
}

function isWeakInstrumentName(name) {
  if (!name || name.length < 2) return true;
  if (/^(fund|equity|of|the|and|index|cap|small|mid|gilt|services|technology|financial)$/i.test(name)) {
    return true;
  }
  return false;
}

function parseNameAndNumbers(name, numTokens, tags = [], pendingQty = 0) {
  if (numTokens.length < 5) return null;

  const cleanedName = String(name || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (isWeakInstrumentName(cleanedName)) return null;

  // Single-token ticker must look like an equity symbol; multi-word names are MF/schemes
  const isTicker = SYMBOL_RE.test(cleanedName.toUpperCase()) && !/\s/.test(cleanedName);
  if (!isTicker && cleanedName.length < 6) return null;

  const row = emptyHolding();
  const symbol = isTicker ? correctOcrSymbol(cleanedName) : cleanedName;
  if (BLOCKED_SYMBOLS.has(symbol.toUpperCase())) return null;

  row.symbol = fv(cleanedName, symbol, 90);
  row.tags = [...tags];
  if (!isTicker || /fund/i.test(cleanedName)) {
    row.asset_type_hint = 'MF';
  }

  let n = 0;
  const take = () => (n < numTokens.length ? numTokens[n++] : null);

  const qtyTok = take();
  // Equity qty is usually an integer; MF qty can be decimal (199.858)
  if (!qtyTok || qtyTok.includes('%') || !/^\d{1,8}(?:\.\d{1,4})?$/.test(qtyTok.replace(/,/g, ''))) {
    return null;
  }
  let availableQty = parseIndianNumber(qtyTok);
  row.quantity = fv(qtyTok, availableQty, 90);

  if ((availableQty === 0 || availableQty == null) && pendingQty > 0) {
    row.quantity = fv(`T:${pendingQty}`, pendingQty, 85);
    row.issues.push('qty_from_pending_delivery');
    if (!row.tags.includes('pending_delivery')) row.tags.push('pending_delivery');
    availableQty = 0;
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

  if (!row.quantity.present || !row.avg_price.present || !row.ltp.present) return null;
  if (!row.invested.present) return null;
  if (row.quantity.value <= 0 || row.quantity.value > 10_000_000) return null;
  if (row.avg_price.value <= 0) return null;

  if (row.pnl_amount.present && row.pnl_percent.present) {
    if (row.pnl_amount.value < 0 && row.pnl_percent.value > 0) {
      row.pnl_percent = fv(row.pnl_percent.raw, -Math.abs(row.pnl_percent.value), 70);
      row.issues.push('net_chg_sign_inferred_from_pnl');
    } else if (row.pnl_amount.value > 0 && row.pnl_percent.value < 0) {
      row.pnl_percent = fv(row.pnl_percent.raw, Math.abs(row.pnl_percent.value), 70);
      row.issues.push('net_chg_sign_inferred_from_pnl');
    }
  }

  const expected = row.quantity.value * row.avg_price.value;
  if (expected > 0) {
    const ratio = row.invested.value / expected;
    if (ratio < 0.5 || ratio > 2.0) return null;
  }

  row.available_qty = availableQty;
  row.pending_qty = pendingQty || null;
  return finalizeRow(row);
}

/** @deprecated equity-only path kept for token fallbacks */
function parseDesktopDataLine(cleaned) {
  const parts = cleaned.split(/\s+/);
  const numIdx = findNumericRunStart(parts);
  if (numIdx < 0) return null;
  const name = parts.slice(0, numIdx).join(' ');
  return parseNameAndNumbers(name, parts.slice(numIdx), [], 0);
}

function tokensToRoughText(tokens) {
  if (!tokens?.length) return '';
  const rows = clusterRows(tokens, 12);
  return rows.map((r) => r.tokens.map((t) => t.text).join(' ')).join('\n');
}

function extractDesktopSummary(tokens, ocrText = '') {
  const summary = {};
  const text = String(ocrText || '');

  // Prefer Total footer line from OCR text — most reliable on desktop:
  // Total 15,35,671.36 19,37,360.88 4,01,689.52 26.16% 6,927.38 (0.36%)
  for (const line of text.split(/\r?\n/)) {
    const cleaned = line.replace(/\s+/g, ' ').trim();
    const m = cleaned.match(
      /^Total\s+([+-]?[\d,]+\.\d+)\s+([+-]?[\d,]+\.\d+)\s+([+-]?[\d,]+\.\d+)\s+([+-]?[\d,]+\.?\d*%?)\s+([+-]?[\d,]+\.\d+)\s*\(?([+-]?[\d,]+\.?\d*%?)\)?/i,
    );
    if (m) {
      summary.invested = fv(m[1], parseIndianNumber(m[1]), 90);
      summary.current = fv(m[2], parseIndianNumber(m[2]), 90);
      summary.pnl_amount = fv(m[3], parseIndianNumber(m[3]), 90);
      summary.pnl_percent = fv(m[4], parseIndianNumber(m[4]), 90);
      summary.day_pnl = fv(m[5], parseIndianNumber(m[5]), 90);
      if (m[6]) summary.day_pnl_pct = fv(m[6], parseIndianNumber(m[6]), 90);
      break;
    }
  }

  // Header "Day's P&L" amount if footer didn't have it
  if (!summary.day_pnl) {
    const dayMatch = text.match(/Day'?s?\s*P&L[\s\S]{0,40}?([+-]?[\d,]+\.\d+)/i);
    if (dayMatch) {
      const v = parseIndianNumber(dayMatch[1]);
      // Day's P&L is usually much smaller than total invested
      if (v != null && Math.abs(v) < 5_000_000) {
        summary.day_pnl = fv(dayMatch[1], v, 70);
      }
    }
  }

  if (summary.invested && summary.current) return summary;

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

  // Also parse "Total" footer row from token clusters
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
      // Day's P&L is typically the next amount after total P&L on the Total row
      if (!summary.day_pnl && sorted[3]) {
        const v = parseIndianNumber(sorted[3].text);
        if (v != null && Math.abs(v) < Math.abs(summary.pnl_amount?.value || Infinity)) {
          summary.day_pnl = fv(sorted[3].text, v, sorted[3].conf);
        }
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
    const summary = extractDesktopSummary(
      workingTokens.length ? workingTokens : tokens,
      ocrText || tokensToRoughText(workingTokens.length ? workingTokens : tokens),
    );
    return {
      source_file: 'kite-desktop',
      screen_type: 'kite_desktop_table',
      image_size: [w, h],
      quality_issues: hasSidebar ? ['sidebar_cropped'] : [],
      portfolio_summary: summary,
      market_overview: {},
      days_pnl: summary.day_pnl || { value: null, raw: null, present: false, confidence: 'missing' },
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

  const summary = extractDesktopSummary(tokens, ocrText || tokensToRoughText(tokens));
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
    days_pnl: summary.day_pnl || { value: null, raw: null, present: false, confidence: 'missing' },
    holdings: filtered,
    fields_present: [...present].sort(),
    fields_missing: [...missing].sort(),
    layout: 'desktop',
  };
}
