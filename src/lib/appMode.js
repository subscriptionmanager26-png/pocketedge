import { isSupabaseConfigured } from './supabase';
import { skipAuthForDev } from './sessionStore';

/** True when running with demo/mock content (?skipAuth=1 or no Supabase). */
export function isDevMockMode() {
  return skipAuthForDev() || !isSupabaseConfigured();
}

/** True when signed-in production should use Supabase-backed data only. */
export function isProductionApp() {
  return !isDevMockMode();
}
