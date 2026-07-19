/**
 * Groww screenshot OCR — separate pipeline from Zerodha Kite.
 *
 * Layout (Stocks + MF):
 *   Left: name (+ "N shares" for stocks, or External/SIP/Regular for MF)
 *   Right: current value above (invested) in parentheses
 */

function parseIndianNumber(text) {
  if (text == null) return null;
  const cleaned = String(text)
    .replace(/,/g, '')
    .replace(/[₹%~()\s]/g, '')
    .replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function fv(raw, value = null, conf = 0) {
  if (raw == null && (value == null || Number.isNaN(value))) {
    return { value: null, raw: null, present: false, confidence: 'missing' };
  }
  if (raw == null) {
    return { value, raw: null, present: true, confidence: 'derived' };
  }
  const confidence = conf >= 75 ? 'high' : conf >= 50 ? 'medium' : 'low';
  return { value, raw, present: true, confidence };
}

function fullText(tokens) {
  return tokens.map((t) => t.text).join(' ').toLowerCase();
}

export function detectGrowwKind(tokens) {
  const text = fullText(tokens);
  if (text.includes('qty.') && (text.includes('ltp') || text.includes('avg.'))) return null;

  const mf =
    text.includes('mutual funds') ||
    text.includes('dashboard') ||
    text.includes('external') ||
    (text.includes('sips') && text.includes('watchlist'));
  const stocks =
    (text.includes('stocks') && text.includes('holdings')) ||
    /\bshares?\b/.test(text) ||
    (text.includes('sensex') && text.includes('holdings'));

  if (mf && (text.includes('external') || text.includes('sip') || text.includes('dashboard'))) {
    return 'groww-mf';
  }
  if (stocks) return 'groww-stocks';
  if (mf) return 'groww-mf';
  return null;
}

/** Darken colored (green/red) UI text for OCR. */
export function applyMinChannel(sourceCanvas) {
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.min(d[i], d[i + 1], d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function isTag(text) {
  return /^(External|SIP|Regular)$/i.test(text);
}

function looksLikeMoney(text) {
  const s = String(text).replace(/\s/g, '');
  if (!/\d/.test(s)) return false;
  if (/[%₹%~(]/.test(s)) return true;
  if (/\)$/.test(s) && /\d/.test(s)) return true;
  if (/,/.test(s) && /^[\d,]+(\.\d+)?$/.test(s)) return true;
  if (/^\d{4,}$/.test(s)) return true;
  return false;
}

function isParenMoney(text) {
  return text.includes('(') || /\)$/.test(text);
}

/** Only strip a leading OCR junk digit when current/invested ratio is absurd. */
function stripTowardPeer(val, peer) {
  if (val == null || !Number.isFinite(val)) return null;
  if (peer == null || !(peer > 0)) return val;
  if (val / peer >= 0.5 && val / peer <= 1.75) return val;

  let cand = String(Math.round(val));
  let best = null;
  let bestScore = Infinity;
  while (cand.length > 3 && /[1-9]/.test(cand[0])) {
    cand = cand.slice(1);
    const o = Number(cand);
    if (!(o > 0)) continue;
    const r = o / peer;
    if (r < 0.45 || r > 1.9) continue;
    const score = Math.abs(Math.log(r));
    if (score < bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best != null ? best : val;
}

function fixMoneyPair(currentVal, investedVal) {
  let cur = currentVal;
  let inv = investedVal;
  for (let i = 0; i < 3; i++) {
    const nextCur = stripTowardPeer(cur, inv);
    const nextInv = stripTowardPeer(inv, nextCur);
    if (nextCur === cur && nextInv === inv) break;
    cur = nextCur;
    inv = nextInv;
  }
  return { currentVal: cur, investedVal: inv };
}

function pickCurrent(candidates, investedVal) {
  if (!candidates.length) return null;
  const scored = candidates.map((c) => {
    let score = 0;
    if (String(c.text).includes(',')) score += 6;
    if (c.val >= 500) score += 4;
    if (c.val >= 5000) score += 2;
    if (c.val < 80) score -= 8;
    if (investedVal && investedVal > 0) {
      const r = c.val / investedVal;
      if (r > 0.4 && r < 1.8) score += 5;
      if (r > 0.7 && r < 1.4) score += 3;
    }
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score || b.c.val - a.c.val);
  return scored[0].c;
}

function lineKey(top) {
  return Math.floor(top / 18);
}

const NAME_NOISE = new Set([
  'sort',
  'current',
  'invested',
  'explore',
  'dashboard',
  'holdings',
  'positions',
  'orders',
  'watchlist',
  'sips',
  'more',
  'stocks',
  'for',
  'you',
  'nifty',
  'sensex',
  'mutual',
  'funds',
  'loans',
  'f&o',
  'add',
  'buy',
  'price',
  'date',
  'from',
  'demat',
  'transfer',
  'stock',
]);

function collectName(tokens, w, y0, y1) {
  const left = tokens.filter(
    (t) =>
      t.left < w * 0.58 &&
      t.top >= y0 - 2 &&
      t.top <= y1 + 2 &&
      !looksLikeMoney(t.text) &&
      !isTag(t.text),
  );
  left.sort((a, b) => lineKey(a.top) - lineKey(b.top) || a.left - b.left);
  const parts = [];
  for (const t of left) {
    const low = t.text.toLowerCase().replace(/[^a-z0-9+&]/g, '');
    if (NAME_NOISE.has(low)) continue;
    if (/^\d+$/.test(t.text)) continue;
    if (/shares?/i.test(t.text)) continue;
    if (/^[—\-_=©]+$/.test(t.text)) continue;
    parts.push(t.text);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function collectQty(tokens, w, shareToken, y0, y1) {
  const glued = shareToken?.text?.match(/^([\d,]+)\s*shares?$/i);
  if (glued) return fv(shareToken.text, parseIndianNumber(glued[1]), shareToken.conf);

  if (shareToken) {
    const near = tokens.filter(
      (t) =>
        t.left < shareToken.left &&
        Math.abs(t.top - shareToken.top) < 22 &&
        /^[\d,]+$/.test(t.text),
    );
    if (near.length) {
      const t = near[near.length - 1];
      return fv(t.text, parseIndianNumber(t.text), t.conf);
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.left >= w * 0.55 || t.top < y0 || t.top > y1) continue;
    if (!/^[\d,]+$/.test(t.text)) continue;
    const next = tokens[i + 1];
    if (next && /^shares?$/i.test(next.text)) {
      return fv(t.text, parseIndianNumber(t.text), t.conf);
    }
  }
  return fv(null);
}

function collectTags(tokens, w, y0, y1) {
  return tokens
    .filter((t) => isTag(t.text) && t.left < w * 0.55 && t.top >= y0 && t.top <= y1)
    .map((t) => t.text);
}

function findListTop(tokens, w, h, kind) {
  // Column header on the right: "Current (Invested)"
  for (const t of tokens) {
    if (t.left <= w * 0.45) continue;
    if (/invested/i.test(t.text) || /^current$/i.test(t.text)) {
      return t.top + 28;
    }
  }
  if (kind === 'groww-mf') {
    const firstTag = tokens
      .filter((t) => isTag(t.text) && t.left < w * 0.5)
      .sort((a, b) => a.top - b.top)[0];
    // Fund names are 1–2 lines above the External/SIP tag — need ample headroom
    if (firstTag) return Math.max(h * 0.06, firstTag.top - 220);
    return h * 0.18;
  }
  const holdingsTab = tokens.find((t) => /^holdings$/i.test(t.text));
  return holdingsTab ? holdingsTab.top + 40 : h * 0.32;
}

function extractGrowwSummary(tokens, h) {
  const summary = {};
  const top = tokens.filter((t) => t.top < h * 0.42);
  for (let i = 0; i < top.length; i++) {
    if (!top[i].text.toLowerCase().startsWith('invested')) continue;
    for (let j = i + 1; j < Math.min(i + 6, top.length); j++) {
      if (looksLikeMoney(top[j].text)) {
        summary.invested = fv(top[j].text, parseIndianNumber(top[j].text), top[j].conf);
        break;
      }
    }
  }
  const big = top
    .filter((t) => looksLikeMoney(t.text) && !isParenMoney(t.text))
    .map((t) => ({ t, val: parseIndianNumber(t.text) }))
    .filter((x) => x.val && x.val > 50000 && x.t.top < h * 0.35)
    .sort((a, b) => b.val - a.val);
  if (big[0]) summary.current = fv(big[0].t.text, big[0].val, big[0].t.conf);
  return summary;
}

function dedupeMoney(arr) {
  const out = [];
  for (const x of [...arr].sort((a, b) => a.top - b.top)) {
    if (
      out.length &&
      Math.abs(out[out.length - 1].val - x.val) / Math.max(x.val, 1) < 0.02 &&
      Math.abs(out[out.length - 1].top - x.top) < 24
    ) {
      continue;
    }
    out.push(x);
  }
  return out;
}

async function recognizeMoneyCrop(worker, canvas, y0, y1, x0) {
  const h = Math.max(1, Math.floor(y1 - y0));
  const w = canvas.width - x0;
  if (h < 8 || w < 8) return [];

  const scale = 3;
  const crop = document.createElement('canvas');
  crop.width = w * scale;
  crop.height = h * scale;
  const ctx = crop.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(canvas, x0, y0, w, h, 0, 0, crop.width, crop.height);

  const img = ctx.getImageData(0, 0, crop.width, crop.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] < 165 ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);

  const { data } = await worker.recognize(crop, {
    tessedit_char_whitelist: '0123456789,().%~',
  });
  const out = [];
  for (const word of data.words || []) {
    const text = (word.text || '').trim();
    if (!text || !/\d/.test(text)) continue;
    const conf = Math.round(word.confidence || 0);
    if (conf < 15) continue;
    const val = parseIndianNumber(text);
    if (val == null || val < 50) continue;
    out.push({ text, top: y0 + word.bbox.y0 / scale, conf, val });
  }
  return out;
}

function pageMoneyInBand(tokens, w, y0, y1) {
  return tokens
    .filter((t) => t.left >= w * 0.48 && t.top >= y0 - 4 && t.top <= y1 + 4 && looksLikeMoney(t.text))
    .map((t) => ({
      text: t.text,
      top: t.top,
      conf: t.conf,
      val: parseIndianNumber(t.text),
    }))
    .filter((m) => m.val != null && m.val >= 50);
}

function resolveMoney(entries) {
  const currents = [];
  const investeds = [];
  for (const m of dedupeMoney(entries)) {
    if (isParenMoney(m.text)) investeds.push(m);
    else currents.push(m);
  }

  if (!investeds.length && currents.length >= 2 && currents[1].top - currents[0].top < 70) {
    investeds.push(currents[1]);
  }

  // Score all current×invested pairs; prefer plausible ratios and comma-formatted OCR
  let best = null;
  for (const c of currents) {
    const invPool = investeds.length ? investeds : [null];
    for (const i of invPool) {
      let curVal = c.val;
      let invVal = i?.val ?? null;
      ({ currentVal: curVal, investedVal: invVal } = fixMoneyPair(curVal, invVal));

      // Identical amounts are usually ₹→2 OCR on both — try stripping current
      if (curVal != null && invVal != null && Math.abs(curVal - invVal) / Math.max(curVal, 1) < 0.02) {
        const s = String(Math.round(curVal));
        if (s.length >= 5 && '27'.includes(s[0])) {
          curVal = Number(s.slice(1));
        }
      }

      let score = 0;
      if (String(c.text).includes(',')) score += 6;
      if (i && String(i.text).includes(',')) score += 5;
      if (i && i.text.includes('(')) score += 3;
      if (curVal >= 500) score += 2;
      if (invVal != null && invVal > 0 && curVal != null) {
        const r = curVal / invVal;
        if (r >= 0.45 && r <= 1.9) score += 8;
        if (r >= 0.7 && r <= 1.4) score += 4;
        if (Math.abs(curVal - invVal) / Math.max(curVal, 1) < 0.02) score -= 6;
      } else if (curVal != null) {
        score += 1;
      } else {
        continue;
      }
      if (!best || score > best.score) {
        best = { score, curVal, invVal, curPicked: c, inv: i };
      }
    }
  }

  // Fallback: largest plausible current alone
  if (!best) {
    const curPicked = pickCurrent(currents, null);
    return {
      curVal: curPicked?.val ?? null,
      invVal: null,
      curPicked,
      inv: null,
    };
  }
  return best;
}

function cleanName(name) {
  return name
    .replace(/[«»©~]+/g, ' ')
    .replace(/\b[A-Z]{1,2}\)$/g, '')
    .replace(/\b(ZS|AA|AN)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isJunkName(name) {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (key.length < 8) return true;
  if (/totalreturns|1dreturns|xirr|dashboard|explore|holdings\d/.test(key)) return true;
  const words = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length < 2) return true;
  const joined = words.join(' ');
  if (/^(direct )?growth$/.test(joined)) return true;
  if (/^fund( direct)?( growth)?$/.test(joined)) return true;
  return false;
}

/**
 * Build row bands from share (stocks) or External/SIP (MF) anchors.
 * Uses the nearest current-value above the anchor so the fund/stock name is included.
 */
function buildAnchorBands(tokens, w, h, listTop, kind) {
  const anchors =
    kind === 'groww-stocks'
      ? tokens
          .filter((t) => t.left < w * 0.55 && t.top >= listTop - 10 && /shares?/i.test(t.text))
          .sort((a, b) => a.top - b.top)
      : tokens
          .filter((t) => isTag(t.text) && t.left < w * 0.5 && t.top >= listTop - 20)
          .sort((a, b) => a.top - b.top);

  const uniq = [];
  for (const a of anchors) {
    const gap = kind === 'groww-stocks' ? 36 : 28;
    if (uniq.length && Math.abs(a.top - uniq[uniq.length - 1].top) < gap) continue;
    uniq.push(a);
  }

  const rightMoney = tokens.filter(
    (t) =>
      t.left >= w * 0.48 &&
      t.top >= listTop - 50 &&
      looksLikeMoney(t.text) &&
      !isParenMoney(t.text),
  );

  const bands = [];
  let prevBottom = listTop;

  for (const a of uniq) {
    const moneyAbove = rightMoney
      .filter((t) => t.top < a.top && a.top - t.top < 200)
      .sort((x, y) => y.top - x.top)[0];

    const y1 = a.top + (a.height || 20) + (kind === 'groww-stocks' ? 45 : 12);
    // Name sits above the current amount
    let y0 = moneyAbove ? moneyAbove.top - 90 : a.top - 175;
    // Don't invade the previous row, but allow the first row to extend above a conservative listTop
    if (bands.length && y0 < prevBottom) y0 = prevBottom;
    if (y0 < listTop - 40) y0 = Math.max(0, listTop - 40);
    if (y0 < 0) y0 = 0;

    bands.push({
      y0,
      y1,
      anchor: a,
      kind: kind === 'groww-stocks' ? 'share' : 'tag',
    });
    prevBottom = Math.min(y1, a.top + 20);
  }

  // Trailing content after last MF tag (SIP sometimes missed by OCR)
  if (kind === 'groww-mf' && bands.length) {
    const trailTop = bands[bands.length - 1].y1 + 4;
    const trailBot = h * 0.96;
    const trailName = collectName(tokens, w, trailTop, trailBot);
    if (trailName.length > 10 && !isJunkName(trailName) && pageMoneyInBand(tokens, w, trailTop, trailBot).length) {
      bands.push({ y0: trailTop, y1: Math.min(trailBot, trailTop + 160), anchor: null, kind: 'trailing' });
    }
  }

  return bands;
}

/** Fill gaps where share/tag OCR missed a visible money pair. */
function buildGapMoneyBands(tokens, w, h, listTop, existing) {
  const right = tokens
    .filter((t) => t.left >= w * 0.48 && t.top >= listTop && t.top <= h * 0.96 && looksLikeMoney(t.text))
    .sort((a, b) => a.top - b.top);

  const used = new Set();
  const bands = [];

  for (let i = 0; i < right.length; i++) {
    if (used.has(i) || isParenMoney(right[i].text)) continue;
    const aval = parseIndianNumber(right[i].text);
    if (aval == null || aval < 100) continue;

    let inv = null;
    for (let j = i + 1; j < right.length; j++) {
      if (used.has(j)) continue;
      const dy = right[j].top - right[i].top;
      if (dy < 8 || dy > 95) continue;
      if (isParenMoney(right[j].text) || dy < 70) {
        inv = right[j];
        used.add(j);
        break;
      }
    }
    used.add(i);

    const a = right[i];
    const y0 = Math.max(listTop, a.top - 90);
    const y1 = Math.min(h * 0.98, (inv ? inv.top + (inv.height || 18) : a.top + 50) + 35);
    const mid = (y0 + y1) / 2;

    if (existing.some((r) => mid >= r.y0 - 8 && mid <= r.y1 + 8)) continue;
    if (existing.some((r) => Math.min(r.y1, y1) - Math.max(r.y0, y0) > 50)) continue;

    bands.push({ y0, y1, anchor: null, kind: 'money' });
  }
  return bands;
}

export async function parseGrowwHoldings(tokens, canvas, kind, worker) {
  const w = canvas.width;
  const h = canvas.height;
  const listTop = findListTop(tokens, w, h, kind);

  let bands = buildAnchorBands(tokens, w, h, listTop, kind);
  const gaps = buildGapMoneyBands(tokens, w, h, listTop, bands);
  bands = [...bands, ...gaps].sort((a, b) => a.y0 - b.y0);

  const holdings = [];
  const seen = new Set();

  for (const band of bands) {
    const { y0, y1 } = band;
    const nameEnd = band.kind === 'share' && band.anchor ? band.anchor.top + 4 : y1;
    const name = cleanName(collectName(tokens, w, y0, nameEnd));
    if (!name || isJunkName(name)) continue;

    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) continue;

    let moneyEntries = pageMoneyInBand(tokens, w, y0, y1);
    if (worker) {
      try {
        const cropMoney = await recognizeMoneyCrop(worker, canvas, y0, y1, Math.floor(w * 0.5));
        moneyEntries = [...moneyEntries, ...cropMoney];
      } catch {
        /* page OCR only */
      }
    }

    const { curVal, invVal, curPicked, inv } = resolveMoney(moneyEntries);
    if (curVal == null && invVal == null) continue;

    seen.add(key);
    const quantity =
      kind === 'groww-stocks' ? collectQty(tokens, w, band.anchor, y0, y1 + 10) : fv(null);
    const tags = collectTags(tokens, w, y0, y1);

    const missing = [];
    if (kind === 'groww-stocks' && !quantity.present) missing.push('units');
    if (curVal == null) missing.push('value');
    if (invVal == null) missing.push('invested');

    const pnl = curVal != null && invVal != null ? curVal - invVal : null;
    const pnlPct = pnl != null && invVal ? (pnl / invVal) * 100 : null;

    holdings.push({
      kind,
      name: fv(name, name, 80),
      quantity,
      current:
        curVal != null
          ? fv(curPicked?.text || String(curVal), curVal, curPicked?.conf || 60)
          : fv(null),
      invested: invVal != null ? fv(inv?.text || String(invVal), invVal, inv?.conf || 60) : fv(null),
      pnl_amount: pnl != null ? fv(null, pnl, 0) : fv(null),
      pnl_percent: pnlPct != null ? fv(null, pnlPct, 0) : fv(null),
      tags,
      row_status: missing.length ? 'partial' : 'complete',
      issues: missing.map((f) => `missing:${f}`),
      missing_fields: missing,
    });
  }

  return {
    source_file: 'groww',
    screen_type: kind,
    image_size: [w, h],
    quality_issues: holdings.length < 2 ? ['few_rows_detected'] : [],
    portfolio_summary: extractGrowwSummary(tokens, h),
    days_pnl: fv(null),
    holdings,
    fields_present: holdings.length ? ['holdings_list'] : [],
    fields_missing: holdings.length ? [] : ['holdings_list'],
  };
}

export function growwToPlaygroundHoldings(parseResult) {
  const kind = parseResult.screen_type;
  const holdings = [];

  for (const h of parseResult.holdings || []) {
    const name = h.name?.value;
    if (!name) continue;

    const missingFields = [...(h.missing_fields || [])];
    const units = h.quantity?.present ? h.quantity.value : null;
    const invested = h.invested?.present ? h.invested.value : null;
    const value = h.current?.present ? h.current.value : null;
    const pnl = h.pnl_amount?.present ? h.pnl_amount.value : null;
    const pnlPct = h.pnl_percent?.present ? h.pnl_percent.value : null;

    let avg = null;
    let ltp = null;
    if (kind === 'groww-stocks' && units && invested != null) avg = invested / units;
    if (kind === 'groww-stocks' && units && value != null) ltp = value / units;
    if (kind === 'groww-stocks' && !units && !missingFields.includes('units')) {
      missingFields.push('units');
    }

    const complete =
      value != null && invested != null && (kind === 'groww-mf' || units != null);

    const reviewMissing = missingFields.filter((f) => {
      if (kind === 'groww-mf' && ['units', 'avg_price', 'price'].includes(f)) return false;
      return true;
    });

    holdings.push({
      source: kind === 'groww-mf' ? 'groww-mf' : 'groww-stocks',
      code: '',
      name,
      assetType: kind === 'groww-mf' ? 'MF' : 'Equity',
      subClass: (h.tags || []).join(', ') || (kind === 'groww-mf' ? 'Mutual Fund' : 'Stock'),
      invested,
      value,
      weightPct: null,
      pnl,
      pnlPct,
      units,
      price: ltp,
      broker: 'Groww (screenshot)',
      dayChange: null,
      dayChangePct: null,
      complete,
      missingFields: reviewMissing,
      raw: {
        tradingsymbol: name,
        quantity: units,
        average_price: avg,
        last_price: ltp,
        pnl,
        invested,
        row_status: complete ? 'complete' : 'partial',
        tags: h.tags,
        issues: h.issues,
        missing_fields: reviewMissing,
        complete,
        ocr: h,
      },
    });
  }

  const completeHoldings = holdings.filter((x) => x.complete && x.value != null);
  const sumInvested = completeHoldings.reduce((s, x) => s + (x.invested || 0), 0);
  const sumValue = completeHoldings.reduce((s, x) => s + (x.value || 0), 0);
  const sumPnl = completeHoldings.reduce((s, x) => s + (x.pnl || 0), 0);
  for (const row of holdings) {
    row.weightPct = row.value != null && sumValue > 0 ? (row.value / sumValue) * 100 : null;
  }

  const screen = parseResult.portfolio_summary || {};
  return {
    source: kind === 'groww-mf' ? 'groww-mf' : 'groww-stocks',
    parser: `screenshot-ocr (${kind})`,
    holdings,
    summary: {
      count: holdings.length,
      completeCount: completeHoldings.length,
      incompleteCount: holdings.filter((x) => !x.complete).length,
      totalInvested: screen.invested?.value ?? (sumInvested || null),
      totalValue: screen.current?.value ?? (sumValue || null),
      totalPnl: sumPnl || null,
      totalsSource:
        screen.current?.present || screen.invested?.present ? 'screen_summary' : 'complete_rows_sum',
      totalDayChange: null,
      assetTypes: kind === 'groww-mf' ? ['MF'] : ['Equity'],
    },
    meta: {
      screen_type: kind,
      quality_issues: parseResult.quality_issues,
      fields_present: parseResult.fields_present,
      fields_missing: parseResult.fields_missing,
      image_size: parseResult.image_size,
      incomplete_holdings: holdings
        .filter((x) => !x.complete)
        .map((x) => ({ name: x.name, missing: x.missingFields })),
    },
  };
}
