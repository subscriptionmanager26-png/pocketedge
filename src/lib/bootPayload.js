import { applyBootPayloadToTabCache } from './tabCache';

export function getBootPromise() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.__PE_BOOT_PROMISE__) return window.__PE_BOOT_PROMISE__;
  if (window.__PE_BOOT__) return Promise.resolve(window.__PE_BOOT__);
  return Promise.resolve(null);
}

export async function consumeBootPayload() {
  const boot = await getBootPromise();
  if (!boot?.authenticated) return null;
  applyBootPayloadToTabCache(boot);
  return boot;
}
