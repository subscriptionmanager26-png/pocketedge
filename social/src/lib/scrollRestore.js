/** In-memory scroll positions keyed by app route. */

const positions = new Map();

export function saveScrollPosition(routeKey, scrollTop) {
  if (!routeKey) return;
  positions.set(routeKey, scrollTop);
}

export function getScrollPosition(routeKey) {
  return positions.get(routeKey) ?? 0;
}

export function readScrollTop(container) {
  const containerScroll = container?.scrollTop ?? 0;
  const windowScroll = typeof window !== 'undefined' ? window.scrollY : 0;
  return Math.max(containerScroll, windowScroll);
}

export function writeScrollTop(container, scrollTop) {
  if (container) container.scrollTop = scrollTop;
  if (typeof window !== 'undefined') window.scrollTo(0, scrollTop);
}
