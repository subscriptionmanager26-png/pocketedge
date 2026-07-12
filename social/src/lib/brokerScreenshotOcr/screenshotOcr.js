/**
 * Portfolio screenshot OCR (browser).
 * Supports Zerodha Kite + Groww (Stocks / Mutual Funds).
 * Uses Tesseract.js + fixed-layout template parsing.
 */

import {
  detectGrowwKind,
  parseGrowwHoldings,
  growwToPlaygroundHoldings,
  applyMinChannel,
} from './growwOcr.js';
import { createWorker } from 'tesseract.js';

const LABELS = new Set([
  'qty',
  'avg',
  'invested',
  'ltp',
  'pnl',
  'equity',
  'family',
  'analytics',
  'holdings',
  'positions',
  'portfolio',
  'overview',
  'funds',
  'watchlist',
  'orders',
  'bids',
  'event',
  "day's",
  'p&l',
  'current',
  'nifty',
  'bank',
  'charts',
  'indicate',
  'weeks',
  'trend',
  'search',
]);

const SYMBOL_RE = /^[A-Z][A-Z0-9&-]{1,14}$/;
const AMT_RE = /^[+-]?[\d,]+\.\d{2}$/;
const PCT_RE = /^[+-]?\(?\d[\d,]*\.?\d*%?\)?$/;

let tesseractWorker = null;

function parseIndianNumber(text) {
  if (!text) return null;
  const cleaned = String(text)
    .trim()
    .replace(/,/g, '')
    .replace(/₹/g, '')
    .replace(/[^\d.\-+]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function fv(raw, value = null, conf = 0, obscured = false) {
  if (obscured) {
    return { value, raw, present: Boolean(raw), confidence: 'obscured' };
  }
  if (raw == null) {
    return { value: null, raw: null, present: false, confidence: 'missing' };
  }
  const confidence = conf >= 75 ? 'high' : conf >= 50 ? 'medium' : 'low';
  return { value, raw, present: true, confidence };
}

function isLabel(text) {
  return LABELS.has(String(text).toLowerCase().replace(/\.$/, ''));
}

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm';

async function ensureWorker(onProgress) {
  if (tesseractWorker) return tesseractWorker;
  // Pin worker/core to CDN (same as mcp-playground) so Vite bundles don't break WASM paths.
  tesseractWorker = await createWorker('eng', 1, {
    workerPath: `${TESSERACT_CDN}/tesseract.js@5.1.1/dist/worker.min.js`,
    corePath: `${TESSERACT_CDN}/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js`,
    logger: (m) => {
      if (onProgress && m.status === 'recognizing text') {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    },
  });
  return tesseractWorker;
}

async function ocrTokens(imageSource, onProgress) {
  const worker = await ensureWorker(onProgress);
  const { data } = await worker.recognize(imageSource);
  const tokens = [];
  for (const word of data.words || []) {
    const text = (word.text || '').trim();
    const conf = Math.round(word.confidence || 0);
    if (!text || conf < 25) continue;
    const b = word.bbox;
    tokens.push({
      text,
      left: b.x0,
      top: b.y0,
      width: b.x1 - b.x0,
      height: b.y1 - b.y0,
      conf,
    });
  }
  return tokens;
}

function fullText(tokens) {
  return tokens.map((t) => t.text).join(' ').toLowerCase();
}

function detectVolumeOverlay(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = canvas;
  const x0 = Math.floor(w * 0.88);
  const x1 = Math.floor(w * 0.98);
  const stripW = Math.max(1, x1 - x0);
  const img = ctx.getImageData(x0, 0, stripW, h);
  const colHits = new Array(stripW).fill(0);
  const rowHits = new Array(h).fill(0);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < stripW; x++) {
      const i = (y * stripW + x) * 4;
      const r = img.data[i];
      const g = img.data[i + 1];
      const b = img.data[i + 2];
      // skin/beige slider tones
      if (r > 140 && g > 100 && b > 80 && r > g && g >= b && r - b > 30) {
        colHits[x]++;
        rowHits[y]++;
      }
    }
  }

  const colMax = Math.max(...colHits) / h;
  let bestRun = 0;
  let run = 0;
  for (const hits of rowHits) {
    run = hits > stripW * 0.08 ? run + 1 : 0;
    bestRun = Math.max(bestRun, run);
  }
  return colMax > 0.35 && bestRun / h > 0.35;
}

function detectFadedOverlay(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = canvas;
  const y0 = Math.floor(h * 0.45);
  const regionH = h - y0;
  const img = ctx.getImageData(0, y0, w, regionH);
  let sum = 0;
  let sumSq = 0;
  const n = regionH * w;
  for (let i = 0; i < img.data.length; i += 4) {
    const gray = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
    sum += gray;
    sumSq += gray * gray;
  }
  const mean = sum / n;
  const std = Math.sqrt(sumSq / n - mean * mean);
  return std < 38 && mean > 210;
}

function loadImageToCanvas(fileOrUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const src = document.createElement('canvas');
      src.width = img.naturalWidth || img.width;
      src.height = img.naturalHeight || img.height;
      const sctx = src.getContext('2d');
      sctx.drawImage(img, 0, 0);

      // Upscale + contrast for WhatsApp-compressed screenshots
      const scale = src.width < 1000 ? 2 : 1;
      const canvas = document.createElement('canvas');
      canvas.width = src.width * scale;
      canvas.height = src.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          let v = (d[i + c] - 128) * 1.4 + 128;
          d[i + c] = Math.max(0, Math.min(255, v));
        }
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Could not load image'));
    if (fileOrUrl instanceof Blob) {
      img.src = URL.createObjectURL(fileOrUrl);
    } else {
      img.src = fileOrUrl;
    }
  });
}

function classifyScreen(tokens, canvas) {
  const text = fullText(tokens);
  const issues = [];
  const h = canvas.height;

  if (text.includes('overview') && (text.includes('nifty') || text.includes('funds'))) {
    if (detectFadedOverlay(canvas)) {
      issues.push('portfolio_section_faded_behind_overlay');
    }
    return { screenType: 'overview_with_portfolio_preview', issues };
  }

  if (detectVolumeOverlay(canvas)) {
    issues.push('volume_slider_obscuring_right_column');
  }

  const topText = tokens
    .filter((t) => t.top < h * 0.2)
    .map((t) => t.text)
    .join(' ')
    .toLowerCase();

  const hasSummary = topText.includes('invested') && topText.includes('current');
  const hasPortfolioTitle = topText.includes('portfolio');
  const headerAmounts = tokens.filter(
    (t) => t.top < h * 0.18 && AMT_RE.test(t.text) && (parseIndianNumber(t.text) || 0) > 1_000_000,
  );
  const hasSummaryNums = headerAmounts.length >= 2;

  if (hasPortfolioTitle && (hasSummary || hasSummaryNums)) {
    return { screenType: 'holdings_full', issues };
  }
  if ((hasSummary || hasSummaryNums) && !hasPortfolioTitle) {
    issues.push('portfolio_title_cut_off');
    return { screenType: 'holdings_summary_partial', issues };
  }
  if (text.includes('holdings') || text.includes('qty')) {
    issues.push('summary_card_not_visible');
    return { screenType: 'holdings_scrolled', issues };
  }
  issues.push('unrecognized_layout');
  return { screenType: 'unknown', issues };
}

function findRowAnchors(tokens) {
  const anchors = [];
  for (const t of tokens) {
    if (/^qty\.?$/i.test(t.text)) anchors.push(t.top);
  }
  anchors.sort((a, b) => a - b);
  const merged = [];
  for (const a of anchors) {
    if (!merged.length || a - merged[merged.length - 1] > 40) merged.push(a);
  }
  return merged;
}

function groupTokensIntoRows(tokens, imgW) {
  const rowH = Math.round(imgW * 0.287);
  const anchors = findRowAnchors(tokens);
  if (anchors.length >= 2) {
    return anchors.map((top, i) => {
      const bottom = i + 1 < anchors.length ? anchors[i + 1] - 5 : top + rowH;
      return tokens.filter((t) => t.top >= top - 10 && t.top < bottom);
    }).filter((r) => r.length);
  }
  if (!tokens.length) return [];
  const minTop = Math.min(...tokens.map((t) => t.top));
  const maxTop = Math.max(...tokens.map((t) => t.top));
  const rows = [];
  for (let y = minTop; y <= maxTop; y += rowH) {
    const row = tokens.filter((t) => t.top >= y && t.top < y + rowH);
    if (row.length) rows.push(row);
  }
  return rows;
}

function parseQtyAvg(tokens) {
  let qtyRaw = null;
  let avgRaw = null;
  let qtyConf = 0;
  let avgConf = 0;
  for (let i = 0; i < tokens.length; i++) {
    const low = tokens[i].text.toLowerCase();
    if (low.startsWith('qty')) {
      for (let j = i + 1; j < Math.min(i + 6, tokens.length); j++) {
        const tx = tokens[j].text;
        // Qty is an integer; stop if we hit Avg
        if (/^avg\.?$/i.test(tx)) break;
        if (/^[\d,]+$/.test(tx) && !tx.includes('.')) {
          qtyRaw = tx;
          qtyConf = tokens[j].conf;
          break;
        }
      }
    }
    if (low.startsWith('avg')) {
      for (let j = i + 1; j < Math.min(i + 4, tokens.length); j++) {
        if (/^[\d,]+\.\d+$/.test(tokens[j].text)) {
          avgRaw = tokens[j].text;
          avgConf = tokens[j].conf;
          break;
        }
      }
    }
  }
  let qtyVal = null;
  if (qtyRaw) {
    const n = Number(qtyRaw.replace(/,/g, ''));
    qtyVal = Number.isFinite(n) ? n : parseIndianNumber(qtyRaw);
  }
  return [fv(qtyRaw, qtyVal, qtyConf), fv(avgRaw, parseIndianNumber(avgRaw), avgConf)];
}

function parseRow(tokens, obscuredRight) {
  const row = {
    symbol: fv(null),
    quantity: fv(null),
    avg_price: fv(null),
    invested: fv(null),
    pnl_amount: fv(null),
    pnl_percent: fv(null),
    ltp: fv(null),
    ltp_day_change_pct: fv(null),
    tags: [],
    row_status: 'complete',
    issues: [],
  };

  const symbolCandidates = [];
  for (const t of tokens) {
    const tx = t.text.toUpperCase();
    if (SYMBOL_RE.test(tx) && !isLabel(tx)) {
      let score = 1;
      if (t.height >= 28) score += 1;
      symbolCandidates.push({ score, t });
    }
  }
  if (symbolCandidates.length) {
    symbolCandidates.sort((a, b) => b.score - a.score || b.t.height - a.t.height);
    const best = symbolCandidates[0].t;
    row.symbol = fv(best.text, best.text.toUpperCase(), best.conf);
  } else {
    row.issues.push('symbol_not_found');
  }

  [row.quantity, row.avg_price] = parseQtyAvg(tokens);

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].text.toLowerCase().startsWith('invested')) {
      for (let j = i + 1; j < Math.min(i + 3, tokens.length); j++) {
        if (AMT_RE.test(tokens[j].text) || /^[\d,]+\.\d+$/.test(tokens[j].text)) {
          row.invested = fv(tokens[j].text, parseIndianNumber(tokens[j].text), tokens[j].conf);
          break;
        }
      }
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].text.toLowerCase().startsWith('ltp')) {
      const nums = [];
      for (let j = i + 1; j < Math.min(i + 5, tokens.length); j++) {
        if (/^[\d,]+\.?\d*$/.test(tokens[j].text) || PCT_RE.test(tokens[j].text)) {
          nums.push(tokens[j]);
        }
      }
      if (nums[0]) {
        row.ltp = fv(nums[0].text, parseIndianNumber(nums[0].text), nums[0].conf, obscuredRight);
      }
      if (nums[1]) {
        const pct = nums[1].text.replace(/[()]/g, '');
        row.ltp_day_change_pct = fv(pct, parseIndianNumber(pct), nums[1].conf, obscuredRight);
      }
    }
  }

  const ltpTop = tokens.find((t) => t.text.toLowerCase().startsWith('ltp'))?.top ?? 99999;
  const totalPcts = tokens.filter(
    (t) => t.text.includes('%') && PCT_RE.test(t.text) && t.top < ltpTop - 20,
  );
  if (totalPcts.length) {
    const t = totalPcts.reduce((a, b) => (a.top < b.top ? a : b));
    row.pnl_percent = fv(t.text, parseIndianNumber(t.text), t.conf, obscuredRight);
  }

  // P&L amount: signed amount on the right (not invested)
  const midX = Math.max(...tokens.map((t) => t.left + t.width)) * 0.45;
  const amts = tokens.filter(
    (t) =>
      AMT_RE.test(t.text) &&
      (t.text.startsWith('+') || t.text.startsWith('-')) &&
      t.left > midX,
  );
  for (const t of amts) {
    if (row.invested.raw && t.text.replace(/,/g, '') === row.invested.raw.replace(/,/g, '')) continue;
    if (!row.pnl_amount.raw) {
      row.pnl_amount = fv(t.text, parseIndianNumber(t.text), t.conf, obscuredRight);
    }
  }

  if (tokens.some((t) => t.text === 'EVENT')) row.tags.push('EVENT');

  if (!row.symbol.present || !row.quantity.present || !row.invested.present || !row.ltp.present) {
    row.row_status = !row.symbol.present ? 'partial_top' : !row.ltp.present ? 'partial_bottom' : 'partial';
  }
  if (obscuredRight && (!row.pnl_percent.present || !row.ltp.present)) {
    row.row_status = 'obscured';
    row.issues.push('right_column_obscured');
  }

  if (!row.symbol.present && !row.quantity.present) return null;
  return row;
}

function extractSummary(tokens, imgH) {
  const summary = {};
  const topTokens = tokens.filter((t) => t.top < imgH * 0.28);

  for (let i = 0; i < topTokens.length; i++) {
    const low = topTokens[i].text.toLowerCase();
    if (low === 'invested') {
      for (let j = i + 1; j < Math.min(i + 4, topTokens.length); j++) {
        if (AMT_RE.test(topTokens[j].text)) {
          summary.invested = fv(topTokens[j].text, parseIndianNumber(topTokens[j].text), topTokens[j].conf);
          break;
        }
      }
    }
    if (low === 'current') {
      for (let j = i + 1; j < Math.min(i + 4, topTokens.length); j++) {
        if (AMT_RE.test(topTokens[j].text)) {
          summary.current = fv(topTokens[j].text, parseIndianNumber(topTokens[j].text), topTokens[j].conf);
          break;
        }
      }
    }
  }

  for (const t of topTokens) {
    if (
      (t.text.startsWith('+') || t.text.startsWith('-')) &&
      t.text.includes(',') &&
      t.text.includes('.') &&
      !t.text.includes('%') &&
      !summary.pnl_amount
    ) {
      summary.pnl_amount = fv(t.text, parseIndianNumber(t.text), t.conf);
    }
    if (t.text.includes('%') && t.top < imgH * 0.22 && !summary.pnl_percent) {
      summary.pnl_percent = fv(t.text, parseIndianNumber(t.text), t.conf);
    }
  }

  if (!summary.invested || !summary.current) {
    const amounts = topTokens
      .filter((t) => AMT_RE.test(t.text) && (parseIndianNumber(t.text) || 0) > 1_000_000)
      .sort((a, b) => a.left - b.left);
    if (amounts.length >= 2) {
      if (!summary.invested) {
        summary.invested = fv(amounts[0].text, parseIndianNumber(amounts[0].text), amounts[0].conf);
      }
      if (!summary.current) {
        summary.current = fv(amounts[1].text, parseIndianNumber(amounts[1].text), amounts[1].conf);
      }
    }
  }

  return summary;
}

function extractDaysPnl(tokens, imgH) {
  for (let i = 0; i < tokens.length; i++) {
    const low = tokens[i].text.toLowerCase();
    if (low.includes('day') && low.includes('p')) {
      for (let j = i; j < Math.min(i + 8, tokens.length); j++) {
        if ((tokens[j].text.startsWith('+') || tokens[j].text.startsWith('-')) && tokens[j].text.includes(',')) {
          return fv(tokens[j].text, parseIndianNumber(tokens[j].text), tokens[j].conf);
        }
      }
    }
  }
  const bottom = tokens.filter((t) => t.top > imgH * 0.75);
  for (const t of bottom) {
    if (t.text.startsWith('+') && t.text.includes(',')) {
      return fv(t.text, parseIndianNumber(t.text), t.conf);
    }
  }
  return fv(null);
}

/**
 * Convert OCR holdings into the kite-compatible shape used by the playground table.
 * Incomplete rows keep nulls for missing fields — no invented market values.
 */
export function toPlaygroundHoldings(parseResult) {
  if (parseResult.screen_type === 'groww-stocks' || parseResult.screen_type === 'groww-mf') {
    return growwToPlaygroundHoldings(parseResult);
  }

  const holdings = [];
  for (const h of parseResult.holdings || []) {
    if (!h.symbol?.present) continue;

    const missingFields = [];
    if (!h.quantity?.present) missingFields.push('units');
    if (!h.avg_price?.present) missingFields.push('avg_price');
    if (!h.invested?.present) missingFields.push('invested');
    if (!h.ltp?.present) missingFields.push('price');
    if (!h.pnl_amount?.present) missingFields.push('pnl');

    const units = h.quantity?.present ? h.quantity.value : null;
    const avg = h.avg_price?.present ? h.avg_price.value : null;
    const ltp = h.ltp?.present ? h.ltp.value : null;
    const invested = h.invested?.present ? h.invested.value : null;
    // Market value = Qty × LTP only when both are present. Never fall back to Avg × Qty.
    const value = units != null && ltp != null ? units * ltp : null;
    const pnl = h.pnl_amount?.present ? h.pnl_amount.value : null;
    const pnlPct = h.pnl_percent?.present
      ? h.pnl_percent.value
      : invested != null && pnl != null && invested > 0
        ? (pnl / invested) * 100
        : null;
    const complete = missingFields.length === 0;

    holdings.push({
      source: 'kite',
      code: '',
      name: h.symbol.value,
      assetType: 'CNC',
      subClass: 'NSE',
      invested,
      value,
      weightPct: null,
      pnl,
      pnlPct,
      units,
      price: ltp,
      broker: 'Zerodha (screenshot)',
      dayChange: null,
      dayChangePct: h.ltp_day_change_pct?.present ? h.ltp_day_change_pct.value : null,
      complete,
      missingFields,
      raw: {
        tradingsymbol: h.symbol.value,
        quantity: units,
        average_price: avg,
        last_price: ltp,
        pnl,
        invested,
        row_status: complete ? 'complete' : h.row_status || 'partial',
        tags: h.tags,
        issues: [...(h.issues || []), ...missingFields.map((f) => `missing:${f}`)],
        missing_fields: missingFields,
        complete,
        ocr: h,
      },
    });
  }

  const completeHoldings = holdings.filter((h) => h.complete && h.value != null);
  const sumInvested = completeHoldings.reduce((s, h) => s + (h.invested || 0), 0);
  const sumValue = completeHoldings.reduce((s, h) => s + (h.value || 0), 0);
  const sumPnl = completeHoldings.reduce((s, h) => s + (h.pnl || 0), 0);

  for (const h of holdings) {
    h.weightPct = h.value != null && sumValue > 0 ? (h.value / sumValue) * 100 : null;
  }

  const screenSummary = parseResult.portfolio_summary || {};
  const useScreenInvested = screenSummary.invested?.present && screenSummary.invested.confidence !== 'low';
  const useScreenCurrent = screenSummary.current?.present && screenSummary.current.confidence !== 'low';
  const useScreenPnl = screenSummary.pnl_amount?.present && screenSummary.pnl_amount.confidence !== 'low';

  const incompleteCount = holdings.filter((h) => !h.complete).length;

  return {
    source: 'kite',
    parser: `screenshot-ocr (${parseResult.screen_type})`,
    holdings,
    summary: {
      count: holdings.length,
      completeCount: completeHoldings.length,
      incompleteCount,
      // Prefer on-screen portfolio totals when OCR found them; else sum complete rows only
      totalInvested: useScreenInvested ? screenSummary.invested.value : sumInvested || null,
      totalValue: useScreenCurrent ? screenSummary.current.value : sumValue || null,
      totalPnl: useScreenPnl ? screenSummary.pnl_amount.value : sumPnl || null,
      totalsSource: useScreenCurrent || useScreenInvested ? 'screen_summary' : 'complete_rows_sum',
      totalDayChange: parseResult.days_pnl?.value ?? null,
      assetTypes: ['Equity'],
    },
    meta: {
      screen_type: parseResult.screen_type,
      quality_issues: parseResult.quality_issues,
      fields_present: parseResult.fields_present,
      fields_missing: parseResult.fields_missing,
      image_size: parseResult.image_size,
      incomplete_holdings: holdings
        .filter((h) => !h.complete)
        .map((h) => ({ name: h.name, missing: h.missingFields })),
    },
  };
}

function findListRegion(tokens, h) {
  if (tokens.some((t) => /^overview$/i.test(t.text)) && tokens.some((t) => /nifty/i.test(t.text))) {
    return { listTop: h * 0.55, listBottom: h * 0.88 };
  }
  const toolbar = tokens.find((t) => /^(equity|analytics|family)$/i.test(t.text));
  let listTop = toolbar ? toolbar.top + (toolbar.height || 0) : h * 0.16;
  const qtyAnchors = tokens.filter((t) => /^qty\.?$/i.test(t.text) && t.top >= listTop - 40 && t.top < h * 0.88);
  if (qtyAnchors.length) {
    listTop = Math.min(...qtyAnchors.map((t) => t.top)) - 8;
  }
  return { listTop: Math.max(0, listTop), listBottom: h * 0.88 };
}

export async function parseScreenshot(file, { onProgress } = {}) {
  const canvas = await loadImageToCanvas(file);
  const tokens = await ocrTokens(canvas, onProgress);

  let growwKind = detectGrowwKind(tokens);
  if (growwKind) {
    // Groww uses green/red amounts — re-OCR on min-channel so colored ₹ text is readable
    const growwCanvas = applyMinChannel(canvas);
    const growwTokens = await ocrTokens(growwCanvas, onProgress);
    growwKind = detectGrowwKind(growwTokens) || growwKind;
    const worker = await ensureWorker(onProgress);
    return parseGrowwHoldings(growwTokens, growwCanvas, growwKind, worker);
  }

  const { screenType, issues } = classifyScreen(tokens, canvas);
  const obscured = issues.includes('volume_slider_obscuring_right_column');
  const h = canvas.height;
  const w = canvas.width;

  const result = {
    source_file: file.name || 'screenshot',
    screen_type: screenType,
    image_size: [w, h],
    quality_issues: [...issues],
    portfolio_summary: {},
    market_overview: {},
    days_pnl: fv(null),
    holdings: [],
    fields_present: [],
    fields_missing: [],
  };

  if (screenType === 'overview_with_portfolio_preview') {
    if (detectFadedOverlay(canvas)) {
      result.quality_issues.push('summary_low_confidence_due_to_fade');
    }
    result.portfolio_summary = extractSummary(
      tokens.filter((t) => t.top > h * 0.4),
      h,
    );
  } else if (screenType === 'holdings_full' || screenType === 'holdings_summary_partial') {
    result.portfolio_summary = extractSummary(tokens, h);
  }

  result.days_pnl = extractDaysPnl(tokens, h);

  const { listTop, listBottom } = findListRegion(tokens, h);
  const listTokens = tokens.filter((t) => t.top >= listTop && t.top <= listBottom);
  const rows = groupTokensIntoRows(listTokens, w);
  const seen = new Set();
  for (const rowTokens of rows) {
    const holding = parseRow(rowTokens, obscured);
    if (!holding) continue;
    const sym = holding.symbol.value;
    if (sym && seen.has(sym)) continue;
    if (sym) seen.add(sym);
    result.holdings.push(holding);
  }

  // If first row looks truncated (symbol missing but qty present), keep it flagged;
  // also try to recover a symbol-only fragment above the first complete row.
  if (result.holdings.length && !result.holdings[0].quantity?.present) {
    result.quality_issues.push('first_row_may_be_truncated');
  }

  const present = new Set();
  const missing = new Set();
  const check = (name, field) => {
    if (field?.present) present.add(name);
    else missing.add(name);
  };
  for (const [k, v] of Object.entries(result.portfolio_summary)) check(`summary.${k}`, v);
  check('days_pnl', result.days_pnl);
  if (result.holdings.length) present.add('holdings_list');
  else missing.add('holdings_list');
  result.fields_present = [...present].sort();
  result.fields_missing = [...missing].sort();

  return result;
}

export async function terminateOcrWorker() {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
  }
}
