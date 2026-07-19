/** Dev-only override for locked/blurred investment sections. */

const KEY = 'pe_social_blur_test_mode';
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

/** @returns {'auto' | 'locked' | 'unlocked'} */
export function getBlurTestMode() {
  try {
    const mode = localStorage.getItem(KEY);
    if (mode === 'locked' || mode === 'unlocked') return mode;
  } catch {
    /* ignore */
  }
  return 'auto';
}

export function setBlurTestMode(mode) {
  if (mode === 'auto') localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, mode);
  emit();
}

export function subscribeBlurTest(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Apply dev override on top of real lock state. */
export function resolveBlurLocked(actualLocked) {
  const mode = getBlurTestMode();
  if (mode === 'locked') return true;
  if (mode === 'unlocked') return false;
  return actualLocked;
}
