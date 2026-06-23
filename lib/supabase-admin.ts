export type SupabaseConfig = { url: string; key: string };

export function getSupabaseAdminConfig(): SupabaseConfig {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }
  return { url, key };
}

export function supabaseRest(table: string, config: SupabaseConfig) {
  const base = `${config.url}/rest/v1/${table}`;
  const headers = {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
    'Content-Type': 'application/json',
  };

  return {
    async rpc<T = unknown>(fn: string, body: Record<string, unknown> = {}): Promise<T> {
      const response = await fetch(`${config.url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`RPC ${fn} failed (${response.status}): ${await response.text()}`);
      }
      return response.json() as Promise<T>;
    },

    async upsert(rows: Record<string, unknown>[], onConflict: string) {
      if (!rows.length) return;
      const response = await fetch(`${base}?on_conflict=${onConflict}`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
      if (!response.ok) {
        throw new Error(`Upsert ${table} failed (${response.status}): ${await response.text()}`);
      }
    },

    async insert(rows: Record<string, unknown>[]) {
      if (!rows.length) return;
      const response = await fetch(base, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(rows),
      });
      if (!response.ok) {
        throw new Error(`Insert ${table} failed (${response.status}): ${await response.text()}`);
      }
    },

    async insertReturning<T = Record<string, unknown>>(row: Record<string, unknown>): Promise<T> {
      const response = await fetch(base, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(row),
      });
      if (!response.ok) {
        throw new Error(`Insert ${table} failed (${response.status}): ${await response.text()}`);
      }
      const data = await response.json();
      return (Array.isArray(data) ? data[0] : data) as T;
    },

    async update(match: Record<string, string>, patch: Record<string, unknown>) {
      const params = new URLSearchParams(match);
      const response = await fetch(`${base}?${params}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        throw new Error(`Update ${table} failed (${response.status}): ${await response.text()}`);
      }
    },

    async selectOne<T = Record<string, unknown>>(
      match: Record<string, string>,
      columns = '*'
    ): Promise<T | null> {
      const params = new URLSearchParams({ ...match, select: columns, limit: '1' });
      const response = await fetch(`${base}?${params}`, { headers });
      if (!response.ok) {
        throw new Error(`Select ${table} failed (${response.status}): ${await response.text()}`);
      }
      const data = await response.json();
      return (Array.isArray(data) ? data[0] : data) ?? null;
    },
  };
}
