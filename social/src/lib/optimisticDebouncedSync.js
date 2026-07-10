export const SYNC_DEBOUNCE_MS = 500;

/** Debounces boolean engagement sync (like, copy, agree) to collapse rapid toggles. */
export function createBooleanSyncManager() {
  /** @type {Map<string, { desired: boolean, synced: boolean, timer: ReturnType<typeof setTimeout> | null, syncing: boolean, flushFn: (() => Promise<void>) | null }>} */
  const states = new Map();

  function getOrCreate(key) {
    if (!states.has(key)) {
      states.set(key, {
        desired: false,
        synced: false,
        timer: null,
        syncing: false,
        flushFn: null,
      });
    }
    return states.get(key);
  }

  function hasPending(key) {
    const state = states.get(key);
    return Boolean(state && (state.timer != null || state.desired !== state.synced));
  }

  function noteServerSynced(key, synced) {
    const state = getOrCreate(key);
    if (!hasPending(key)) {
      state.desired = synced;
      state.synced = synced;
    } else {
      state.synced = synced;
    }
  }

  function scheduleSync(key, desired, flushFn) {
    const state = getOrCreate(key);
    state.desired = desired;
    state.flushFn = flushFn;
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      state.timer = null;
      void runFlush(key);
    }, SYNC_DEBOUNCE_MS);
  }

  async function runFlush(key) {
    const state = states.get(key);
    if (!state || state.desired === state.synced || state.syncing || !state.flushFn) {
      return { ok: true };
    }

    state.syncing = true;
    try {
      await state.flushFn();
      state.synced = state.desired;
      return { ok: true };
    } catch (err) {
      return { error: err, revertTo: state.synced };
    } finally {
      state.syncing = false;
      if (state.desired !== state.synced && state.flushFn) {
        scheduleSync(key, state.desired, state.flushFn);
      }
    }
  }

  function clear(key) {
    const state = states.get(key);
    if (state?.timer) clearTimeout(state.timer);
    states.delete(key);
  }

  function clearAll() {
    states.forEach((state) => {
      if (state.timer) clearTimeout(state.timer);
    });
    states.clear();
  }

  return { hasPending, noteServerSynced, scheduleSync, runFlush, clear, clearAll };
}
