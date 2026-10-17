export const config = {
  runtime: 'edge',
};

import { agentAccessDefinitelyDisabled, userHasAgentAccess } from '../_lib/agentAccess.js';
import { accessTokenFromRequest, pocketedgeUserFromRequest } from '../_lib/agentAuth.js';
import { supabaseServerConfig } from '../_lib/supabaseServer.js';
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

  const cfg = supabaseServerConfig();
  const token = cfg.ref ? accessTokenFromRequest(request, cfg.ref) : null;
  const allowed = await userHasAgentAccess(user.id, user.metadata, token ?? undefined);
  let result = { ok: true, status: 200 };
  if (allowed) {
    result = await syncAgentUser(user.id, { name: user.name, email: user.email }, true);
  } else if (await agentAccessDefinitelyDisabled(user.id)) {
    result = await syncAgentUser(user.id, { name: user.name, email: user.email }, false);
  }
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
