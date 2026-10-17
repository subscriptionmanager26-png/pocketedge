export const config = {
  runtime: 'edge',
};

import { userHasAgentAccess } from '../../../_lib/agentAccess.js';
import { accessTokenFromRequest, pocketedgeUserFromRequest } from '../../../_lib/agentAuth.js';
import { supabaseServerConfig } from '../../../_lib/supabaseServer.js';
import { paFetch, personalAgentsConfigured } from '../../../_lib/personalAgents.js';

export default async function handler(
  request: Request,
  context: { params?: { id?: string } },
) {
  if (request.method !== 'GET') {
    return new Response('method_not_allowed', { status: 405 });
  }
  if (!personalAgentsConfigured()) {
    return new Response('agent_backend_unconfigured', { status: 503 });
  }
  const user = await pocketedgeUserFromRequest(request);
  if (!user) return new Response('unauthorized', { status: 401 });
  const cfg = supabaseServerConfig();
  const token = cfg.ref ? accessTokenFromRequest(request, cfg.ref) : null;
  if (!(await userHasAgentAccess(user.id, user.metadata, token ?? undefined))) {
    return new Response('agent_not_enabled', { status: 403 });
  }

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const eventsIdx = parts.lastIndexOf('events');
  const id =
    context?.params?.id ||
    (eventsIdx > 0 ? parts[eventsIdx - 1] : '') ||
    '';
  const after = url.searchParams.get('after');
  const path = `/api/v1/users/${encodeURIComponent(user.id)}/messages/${encodeURIComponent(id)}/events${
    after ? `?after=${encodeURIComponent(after)}` : ''
  }`;
  const upstream = await paFetch(path, {
    headers: {
      Accept: 'text/event-stream',
      'Last-Event-ID': request.headers.get('last-event-id') || '',
    },
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
