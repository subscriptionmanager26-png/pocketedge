/** In-memory scroll positions keyed by app route. */

const positions = new Map();

export function saveScrollPosition(routeKey, scrollTop) {
  if (!routeKey) return;
  const next = Math.max(0, Number(scrollTop) || 0);
  positions.set(routeKey, next);
}

/**
 * Persist scroll on leave. Ignore 0 when we already have a position — opening a
 * shorter page (e.g. post detail) can clamp scrollY to 0 before we snapshot.
 */
export function rememberScrollPositionOnLeave(routeKey, scrollTop) {
  if (!routeKey) return;
  const next = Math.max(0, Number(scrollTop) || 0);
  if (next > 0) {
    positions.set(routeKey, next);
    return;
  }
  // Keep the last live scroll value if the read already collapsed to 0.
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
