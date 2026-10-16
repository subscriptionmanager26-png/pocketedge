export const config = {
  runtime: 'edge',
};

import { userHasAgentAccess } from '../_lib/agentAccess.js';
import { pocketedgeUserFromRequest } from '../_lib/agentAuth.js';
import { personalAgentsConfigured, syncAgentUser } from '../_lib/personalAgents.js';

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });
  }
  if (!personalAgentsConfigured()) {
    return new Response(JSON.stringify({ error: 'agent_backend_unconfigured' }), { status: 503 });
  }
  const user = await pocketedgeUserFromRequest(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const allowed = await userHasAgentAccess(user.id, user.metadata);
  const result = await syncAgentUser(
    user.id,
    { name: user.name, email: user.email },
    allowed,
  );
  if (!result.ok && result.status !== 404) {
    return new Response(JSON.stringify({ error: 'sync_failed', status: result.status }), { status: 502 });
  }
  return new Response(
    JSON.stringify({
      userId: user.id,
      agent: allowed ? 'active' : 'disabled',
      synced: result.ok,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } },
  );
}
