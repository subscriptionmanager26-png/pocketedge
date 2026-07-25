import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

/**
 * Ingest mn_news_ai_summaries rows as social posts from @pocketedge_news.
 *
 * Called by pg_net from the india-market-news project on INSERT.
 * Auth: x-webhook-token == social_market_job_config.auth_token
 *   for job_name ingest-news-summary
 */

const JOB_NAME = 'ingest-news-summary';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: 'Missing Supabase envs' });
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const requestToken = req.headers.get('x-webhook-token') ?? '';
  const { data: tokenRow, error: tokenErr } = await client
    .from('social_market_job_config')
    .select('auth_token')
    .eq('job_name', JOB_NAME)
    .maybeSingle();

  if (tokenErr) {
    return json(500, { error: tokenErr.message });
  }
  if (!tokenRow?.auth_token || requestToken !== tokenRow.auth_token) {
    return json(401, { error: 'Unauthorized' });
  }

  const body = await req.json().catch(() => ({}));
  const record = (body?.record ?? body) as Record<string, unknown>;
  if (!record?.id) {
    return json(400, { error: 'Missing record.id' });
  }

  const { data, error } = await client.rpc('ingest_news_ai_summary_as_post', {
    p_summary: record,
  });

  if (error) {
    return json(500, {
      ok: false,
      error: error.message,
      summary_id: record.id,
    });
  }

  return json(200, {
    ok: true,
    summary_id: record.id,
    post: data,
  });
});
