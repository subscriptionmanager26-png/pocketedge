const LEGACY_STORAGE_KEY = 'pe-legacy-theme';
const THEME_CLASS = 'theme-redesign';
const LEGACY_CLASS = 'theme-legacy';

/** Dark institutional theme — default in production; off only in dev with ?legacy=1 */
export function isLegacyThemeActive() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  return document.documentElement.classList.contains(LEGACY_CLASS);
}

export function isRedesignThemeActive() {
  if (typeof window === 'undefined') return true;
  if (isLegacyThemeActive()) return false;
  return document.documentElement.classList.contains(THEME_CLASS);
}

export function initAppTheme() {
  if (typeof window === 'undefined') return true;

  const params = new URLSearchParams(window.location.search);

  if (import.meta.env.DEV) {
    if (params.get('legacy') === '1') {
      localStorage.setItem(LEGACY_STORAGE_KEY, '1');
    } else if (params.get('legacy') === '0') {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  }

  const legacy =
    import.meta.env.DEV &&
    (params.get('legacy') === '1' || localStorage.getItem(LEGACY_STORAGE_KEY) === '1');

  document.documentElement.classList.toggle(LEGACY_CLASS, legacy);
  document.documentElement.classList.toggle(THEME_CLASS, !legacy);

  window.dispatchEvent(new CustomEvent('pe-theme-change', { detail: { dark: !legacy } }));
  return !legacy;
}

/** @deprecated use initAppTheme */
export function initRedesignTheme() {
  return initAppTheme();
}

export function setRedesignTheme(active) {
  if (!import.meta.env.DEV) return;
  if (active) {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } else {
    localStorage.setItem(LEGACY_STORAGE_KEY, '1');
  }
  initAppTheme();
}

export function withRedesignParam(url = window.location.href) {
  const next = new URL(url, window.location.origin);
  next.searchParams.delete('legacy');
  next.searchParams.delete('redesign');
  return next.pathname + next.search;
}
