/** Parse and read Upvaly-shaped metrics from the screener snapshot. */

const ANNUALIZED_KEYS = new Set(['1y', '2y', '3y', '5y', '7y', '10y', 'inception']);
const RETURN_DISPLAY_ORDER = [
  '1w',
  '1m',
  '3m',
  '6m',
  'ytd',
  '1y',
  '2y',
  '3y',
  '5y',
  '10y',
  'inception',
];

const ROLLING_TF_MAP = {
  '1M': '1m',
  '3M': '3m',
  '6M': '6m',
  '1Y': '1y',
  '3Y': '3y',
  '5Y': '5y',
  '10Y': '10y',
};

export function parseUpvalyMetric(value) {
  if (value == null) return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeTf(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!s) return null;
  if (s === 'ytd') return 'ytd';
  if (s === 'inception') return 'inception';
  const m = s.match(/^(\d+)([wmy])$/);
  if (m) return `${m[1]}${m[2]}`;
  return s;
}

function tfLabel(key) {
  if (key === 'ytd') return 'YTD';
  if (key === 'inception') return 'Since inception';
  const m = key.match(/^(\d+)([wmy])$/);
  if (!m) return key.toUpperCase();
  const unit = m[2] === 'w' ? 'W' : m[2] === 'm' ? 'M' : 'Y';
  return `${m[1]}${unit}`;
}

function parseReturnsByTimeframe(data) {
  const out = {};
  for (const row of data.ranks ?? []) {
    const key = normalizeTf(row.timeframe);
    if (!key || row.annualizedReturn == null || !Number.isFinite(row.annualizedReturn)) continue;
    out[key] = {
      timeframe: key,
      label: tfLabel(key),
      valuePct: row.annualizedReturn,
      kind: ANNUALIZED_KEYS.has(key) ? 'annualized' : 'absolute',
    };
  }
  for (const row of data.riskMetrics?.returns?.timeframes ?? []) {
    const key = normalizeTf(row.timeframe);
    const valuePct = parseUpvalyMetric(row.value);
    if (!key || valuePct == null) continue;
    out[key] = {
      timeframe: key,
      label: tfLabel(key),
      valuePct,
      kind: ANNUALIZED_KEYS.has(key) ? 'annualized' : 'absolute',
    };
  }
  return out;
}

function parseCagrByPeriod(cagr) {
  if (!cagr || typeof cagr !== 'object') return undefined;
  const out = {};
  for (const key of ['1y', '3y', '5y', '7y', '10y']) {
    const value = parseUpvalyMetric(cagr[key]);
    if (value != null) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

function parseRiskStdDev(data) {
  const out = {};
  for (const row of data.riskMetrics?.riskStandardDeviation?.timeframes ?? []) {
    const key = normalizeTf(row.timeframe);
    if (!key) continue;
    out[key] = {
      timeframe: key,
      value: parseUpvalyMetric(row.value),
      categoryAverage: parseUpvalyMetric(row.categoryAverage),
    };
  }
  return Object.keys(out).length ? out : undefined;
}

function parseRollingByPeriod(data) {
  const out = {};
  for (const row of data.rollingReturns ?? []) {
    const period = ROLLING_TF_MAP[String(row.timeframe ?? '').toUpperCase()];
    if (!period) continue;
    if (row.averageReturn == null || !Number.isFinite(row.averageReturn)) continue;
    out[period] = {
      average: row.averageReturn,
      median: row.medianReturn ?? row.averageReturn,
    };
  }
  return out;
}

function parseRiskMetric3y(timeframes) {
  const row = timeframes?.find((t) => normalizeTf(t.timeframe) === '3y');
  return parseUpvalyMetric(row?.value);
}

function parseCategoryRank3y(data) {
  const row = data.ranks?.find((r) => String(r.timeframe ?? '').toUpperCase() === '3Y');
  if (!row?.rankInCategory) return null;
  const n = Number(String(row.rankInCategory).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

export function parseSchemeFromSnapshot(amfiCode, raw) {
  if (!raw) return null;
  const riskStd = parseRiskStdDev(raw);
  return {
    schemeCode: String(raw.schemeCode ?? amfiCode),
    schemeName: String(raw.schemeName ?? ''),
    schemeCategory: raw.schemeCategory,
    schemeCategoryLabel: raw.schemeCategoryLabel,
    aumCr: parseUpvalyMetric(raw.aum),
    expenseRatio: parseUpvalyMetric(raw.expenseRatio),
    inceptionDate: raw.inceptionDate ? String(raw.inceptionDate) : undefined,
    cagrByPeriod: parseCagrByPeriod(raw.cagr),
    riskStdDevByTimeframe: riskStd,
    fundamentals: raw.fundamentals,
    holdings: raw.holdings,
    returnsByTimeframe: parseReturnsByTimeframe(raw),
    rollingByPeriod: parseRollingByPeriod(raw),
    volatility3y: riskStd?.['3y']?.value ?? null,
    sharpe3y: parseRiskMetric3y(raw.riskMetrics?.sharpRatio?.timeframes),
    sortino3y: parseRiskMetric3y(raw.riskMetrics?.sortinoRatio?.timeframes),
    categoryRank3y: parseCategoryRank3y(raw),
  };
}

export function buildMetricsIndex(snapshot) {
  const out = {};
  for (const [code, raw] of Object.entries(snapshot.funds ?? {})) {
    const parsed = parseSchemeFromSnapshot(code, raw);
    if (parsed) out[code] = parsed;
  }
  return out;
}

export function getFundReturn(scheme, timeframe) {
  if (!scheme) return null;
  const key = normalizeTf(timeframe);
  if (!key) return null;
  return scheme.returnsByTimeframe?.[key] ?? null;
}

export function listFundReturns(scheme) {
  if (!scheme) return [];
  const keys = new Set(Object.keys(scheme.returnsByTimeframe ?? {}));
  const ordered = [];
  for (const k of RETURN_DISPLAY_ORDER) {
    if (keys.has(k)) ordered.push(scheme.returnsByTimeframe[k]);
  }
  for (const [k, row] of Object.entries(scheme.returnsByTimeframe ?? {})) {
    if (!RETURN_DISPLAY_ORDER.includes(k)) ordered.push(row);
  }
  return ordered;
}
