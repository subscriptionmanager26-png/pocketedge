const base = () => (process.env.PERSONAL_AGENTS_URL || '').replace(/\/$/, '');
const key = () => process.env.PERSONAL_AGENTS_API_KEY || '';

export function personalAgentsConfigured() {
  return Boolean(base() && key());
}

function headers() {
  return {
    Authorization: `Bearer ${key()}`,
    'Content-Type': 'application/json',
  };
}

export async function syncAgentUser(
  externalId: string,
  input: { name?: string; email?: string },
  active: boolean,
) {
  const url = `${base()}/api/v1/users/${encodeURIComponent(externalId)}`;
  if (!active) {
    const res = await fetch(url, { method: 'DELETE', headers: headers() });
    return { ok: res.status === 204 || res.ok, status: res.status };
  }
  const res = await fetch(url, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ name: input.name, email: input.email }),
  });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => undefined) };
}

export async function paFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers as Record<string, string> | undefined) },
  });
  return res;
}
