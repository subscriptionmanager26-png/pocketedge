const APP_TABS = ['dashboard', 'search', 'leaderboard', 'create', 'account', 'basket'];

export function isDesignRoute() {
  return new URLSearchParams(window.location.search).get('design') === '1';
}

/** Dev-only: force app shell without signing in */
export function isLocalAppRoute() {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(window.location.search).get('app') === '1';
}

export function isAppShellRoute() {
  const params = new URLSearchParams(window.location.search);
  if (APP_TABS.includes(params.get('tab'))) return true;
  return isLocalAppRoute();
}

export function getAppTab() {
  const tab = new URLSearchParams(window.location.search).get('tab');
  if (APP_TABS.includes(tab)) return tab;
  return 'dashboard';
}

export function getBasketIdFromUrl() {
  return new URLSearchParams(window.location.search).get('basket');
}

export function getBasketDetailTabFromUrl() {
  return new URLSearchParams(window.location.search).get('basketTab');
}

export function getEditBasketIdFromUrl() {
  return new URLSearchParams(window.location.search).get('edit');
}

export function getIsCreatingNewFromUrl() {
  return new URLSearchParams(window.location.search).get('new') === '1';
}

export function getCreateRouteFromUrl() {
  return {
    editId: getEditBasketIdFromUrl(),
    isNew: getIsCreatingNewFromUrl(),
  };
}

export function scrollAppToTop() {
  window.scrollTo(0, 0);
}

export function navigateApp({
  tab = 'dashboard',
  basketId = null,
  basketTab = null,
  editBasketId = null,
  createNew = null,
} = {}) {
  const url = new URL(window.location.href);
  url.searchParams.delete('waitlist');
  url.searchParams.delete('leaderboard');
  url.searchParams.set('tab', tab);
  if (basketId) url.searchParams.set('basket', basketId);
  else url.searchParams.delete('basket');
  if (basketTab) url.searchParams.set('basketTab', basketTab);
  else url.searchParams.delete('basketTab');
  if (editBasketId) {
    url.searchParams.set('edit', editBasketId);
    url.searchParams.delete('new');
  } else {
    url.searchParams.delete('edit');
  }
  if (createNew) {
    url.searchParams.set('new', '1');
    url.searchParams.delete('edit');
  } else if (createNew === false) {
    url.searchParams.delete('new');
  }
  if (!import.meta.env.DEV || url.searchParams.get('app') !== '1') {
    url.searchParams.delete('app');
  }
  const query = url.searchParams.toString();
  window.history.pushState({}, '', query ? `${url.pathname}?${query}` : url.pathname);
  window.dispatchEvent(new PopStateEvent('popstate'));
  scrollAppToTop();
}
