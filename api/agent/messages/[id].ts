export const config = {
  runtime: 'edge',
};

import { userHasAgentAccess } from '../../_lib/agentAccess.js';
import { pocketedgeUserFromRequest } from '../../_lib/agentAuth.js';
import { paFetch, personalAgentsConfigured } from '../../_lib/personalAgents.js';

export default async function handler(
  request: Request,
  context: { params?: { id?: string } },
) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });
  }
  if (!personalAgentsConfigured()) {
    return new Response(JSON.stringify({ error: 'agent_backend_unconfigured' }), { status: 503 });
  }
  const user = await pocketedgeUserFromRequest(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  if (!(await userHasAgentAccess(user.id, user.metadata))) {
    return new Response(JSON.stringify({ error: 'agent_not_enabled' }), { status: 403 });
  }

  const url = new URL(request.url);
  const id =
    context?.params?.id || url.pathname.split('/').filter(Boolean).pop() || '';
  const res = await paFetch(
    `/api/v1/users/${encodeURIComponent(user.id)}/messages/${encodeURIComponent(id)}`,
  );
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
}
