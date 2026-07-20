const TAB_MARKS = new Set(['markets', 'portfolio', 'profile']);

function safeMark(name) {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return;
  try {
    performance.mark(name);
  } catch {
    /* ignore quota / unsupported */
  }
}

function safeMeasure(name, startMark, endMark) {
  if (typeof performance === 'undefined' || typeof performance.measure !== 'function') return null;
  try {
    performance.measure(name, startMark, endMark);
    return performance.getEntriesByName(name).pop()?.duration ?? null;
  } catch {
    return null;
  }
}

let posthogCapture = null;

export function registerPerfPostHog(captureFn) {
  posthogCapture = typeof captureFn === 'function' ? captureFn : null;
}

function emitTiming(event, properties = {}) {
  if (!posthogCapture) return;
  try {
    posthogCapture('page_load_timing', { event, ...properties });
  } catch {
    /* ignore analytics failures */
  }
}

export function markAuthReady() {
  safeMark('pe_auth_ready');
  emitTiming('auth_ready', { ms: performance.now() });
}

export function markBootstrapDone(source = 'network') {
  safeMark('pe_bootstrap_done');
  const ms = safeMeasure('pe_bootstrap_duration', 'pe_auth_ready', 'pe_bootstrap_done');
  emitTiming('bootstrap_done', { source, ms: ms ?? performance.now() });
}

export function markTabPaint(tab) {
  if (!TAB_MARKS.has(tab)) return;
  const mark = `pe_tab_paint_${tab}`;
  safeMark(mark);
  emitTiming('tab_paint', { tab, ms: performance.now() });
}

export function markTabDataReady(tab, source = 'network') {
  if (!TAB_MARKS.has(tab)) return;
  const endMark = `pe_data_ready_${tab}`;
  safeMark(endMark);
  const startMark = `pe_tab_paint_${tab}`;
  const ms = safeMeasure(`pe_tab_data_${tab}`, startMark, endMark);
  emitTiming('tab_data_ready', { tab, source, ms: ms ?? performance.now() });
}
