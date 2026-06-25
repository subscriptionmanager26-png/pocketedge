/**
 * Supabase admin REST client for batch jobs (service role or anon key).
 */

export function getSupabaseAdminConfig({ requireServiceRole = false } = {}) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const key = serviceKey || anonKey;
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or anon key) required');
  }
  if (requireServiceRole && !serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for basket NAV writes (anon key cannot bypass RLS)'
    );
  }
  return { url, key };
}

export function supabaseRest(table, { url, key }) {
  const base = `${url}/rest/v1/${table}`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  return {
    async rpc(fn, body = {}) {
      const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`RPC ${fn} failed (${response.status}): ${await response.text()}`);
      }
      return response.json();
    },

    async upsert(rows, onConflict) {
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

    async insert(rows) {
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

    async insertReturning(row) {
      const response = await fetch(base, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(row),
      });
      if (!response.ok) {
        throw new Error(`Insert ${table} failed (${response.status}): ${await response.text()}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data[0] : data;
    },

    async update(match, patch) {
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
  };
}
