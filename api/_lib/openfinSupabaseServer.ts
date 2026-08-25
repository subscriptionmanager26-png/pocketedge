/** OpenFin analytics Supabase — separate from the PocketEdge social project. */

export function openfinSupabaseConfig() {
  const url = process.env.OPENFIN_SUPABASE_URL ?? '';
  const anonKey = process.env.OPENFIN_SUPABASE_ANON_KEY ?? '';
  const serviceRoleKey = process.env.OPENFIN_SUPABASE_SERVICE_ROLE_KEY ?? '';
  return { url, anonKey, serviceRoleKey };
}
