export function authorizeProbeRequest(
  probeSecret: string | undefined,
  headerSecret: string | null | undefined
) {
  if (!probeSecret) return { ok: true as const, warning: 'IBKR_PROBE_SECRET not set' };
  if (headerSecret !== probeSecret) {
    return { ok: false as const, error: 'unauthorized' };
  }
  return { ok: true as const };
}
