export const config = {
  runtime: 'edge',
};

import { userHasAgentAccess } from '../_lib/agentAccess.js';
import { pocketedgeUserFromRequest } from '../_lib/agentAuth.js';
import { paFetch, personalAgentsConfigured } from '../_lib/personalAgents.js';

async function requireAgentUser(request: Request) {
  const user = await pocketedgeUserFromRequest(request);
  if (!user) {
    return { response: new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }) };
  }
  if (!(await userHasAgentAccess(user.id, user.metadata))) {
    return { response: new Response(JSON.stringify({ error: 'agent_not_enabled' }), { status: 403 }) };
  }
  return { user };
}

export default async function handler(request: Request) {
  if (!personalAgentsConfigured()) {
    return new Response(JSON.stringify({ error: 'agent_backend_unconfigured' }), { status: 503 });
  }

  const auth = await requireAgentUser(request);
  if ('response' in auth) return auth.response;

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const threadId = url.searchParams.get('threadId') || 'main';
    const limit = url.searchParams.get('limit') || '20';
    const res = await paFetch(
      `/api/v1/users/${encodeURIComponent(auth.user.id)}/messages?threadId=${encodeURIComponent(threadId)}&limit=${encodeURIComponent(limit)}`,
    );
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });
  }

  if (request.method === 'POST') {
    const payload = await request.json().catch(() => ({}));
    const res = await paFetch(`/api/v1/users/${encodeURIComponent(auth.user.id)}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });
  }

  return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });
}
