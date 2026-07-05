const DESIGN_HOSTS = new Set(['design.pocketedge.in', 'design.pocketedge.app']);

export function isDesignHost() {
  return DESIGN_HOSTS.has(window.location.hostname);
}

export function isDesignRoute() {
  if (isDesignHost()) return true;
  const design = new URLSearchParams(window.location.search).get('design');
  return design === '1' || design === 'social';
}

/** Main PocketEdge product design library (green / Manrope). */
export function isMainDesignRoute() {
  if (isDesignHost()) return false;
  return new URLSearchParams(window.location.search).get('design') === '1';
}

/** Social design guide (orange / Substack-inspired). Default on design.pocketedge.in. */
export function isSocialDesignRoute() {
  if (isDesignHost()) return true;
  return new URLSearchParams(window.location.search).get('design') === 'social';
}
