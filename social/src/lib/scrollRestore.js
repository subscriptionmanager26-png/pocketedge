/** In-memory scroll positions keyed by app route. */

const positions = new Map();

export function saveScrollPosition(routeKey, scrollTop) {
  if (!routeKey) return;
  const next = Math.max(0, Number(scrollTop) || 0);
  positions.set(routeKey, next);
}

/** Keep the highest known position — content swaps can clamp a late read to 0. */
export function rememberScrollPosition(routeKey, scrollTop) {
  if (!routeKey) return;
  const next = Math.max(0, Number(scrollTop) || 0);
  const prev = positions.get(routeKey) ?? 0;
  if (next >= prev) positions.set(routeKey, next);
}

export function getScrollPosition(routeKey) {
  return positions.get(routeKey) ?? 0;
}

export function readScrollTop(container) {
  const containerScroll = container?.scrollTop ?? 0;
  const windowScroll = typeof window !== 'undefined' ? window.scrollY : 0;
  const docScroll =
    typeof document !== 'undefined'
      ? document.documentElement?.scrollTop || document.body?.scrollTop || 0
      : 0;
  return Math.max(containerScroll, windowScroll, docScroll);
}

export function writeScrollTop(container, scrollTop) {
  const y = Math.max(0, Number(scrollTop) || 0);
  if (container) container.scrollTop = y;
  if (typeof document !== 'undefined') {
    document.documentElement.scrollTop = y;
    document.body.scrollTop = y;
  }
  if (typeof window !== 'undefined') window.scrollTo(0, y);
}

export function disableBrowserScrollRestoration() {
  if (typeof window === 'undefined') return;
  try {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  } catch {
    // ignore
  }
}
