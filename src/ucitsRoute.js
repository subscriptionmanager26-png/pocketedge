export function isUcitsScreenerRoute() {
  return new URLSearchParams(window.location.search).get('ucits') === '1';
}

export function getUcitsScreenerUrl() {
  const url = new URL(window.location.origin);
  url.searchParams.set('ucits', '1');
  return `${url.pathname}?${url.searchParams.toString()}`;
}
