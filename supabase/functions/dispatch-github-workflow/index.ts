import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

/**
 * Dispatch a GitHub Actions workflow_dispatch from Supabase Cron.
 * Used for sub-daily jobs that Vercel Hobby cannot schedule.
 *
 * Auth: x-dispatch-token == social_market_job_config.auth_token for job_name
 * Secrets: GITHUB_DISPATCH_TOKEN (Supabase edge secret only — never store PAT in DB)
 */

const JOB_TO_WORKFLOW: Record<string, string> = {
  equity: 'social-market-price-equity.yml',
  funds: 'social-market-price-funds.yml',
  commodities: 'social-market-price-commodities.yml',
  'asset-sync': 'social-market-asset-sync.yml',
  'amc-inav': 'refresh-amc-etf-inav.yml',
};

const LOCK_NAME = 'dispatch-github-workflow';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase envs' }), { status: 500 });
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const githubToken = Deno.env.get('GITHUB_DISPATCH_TOKEN') ?? '';
  if (!githubToken) {
    return new Response(JSON.stringify({ error: 'Missing GITHUB_DISPATCH_TOKEN secret' }), {
      status: 500,
    });
  }

  const requestToken = req.headers.get('x-dispatch-token') ?? '';
  const { data: tokenRow, error: tokenErr } = await client
    .from('social_market_job_config')
    .select('auth_token')
    .eq('job_name', LOCK_NAME)
    .maybeSingle();
  if (tokenErr) {
    return new Response(JSON.stringify({ error: tokenErr.message }), { status: 500 });
  }
  if (!tokenRow?.auth_token || requestToken !== tokenRow.auth_token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const job = String(body?.job ?? '').trim();
  const workflowFile = JOB_TO_WORKFLOW[job];
  if (!workflowFile) {
    return new Response(
      JSON.stringify({ error: `Unknown job "${job}"`, allowed: Object.keys(JOB_TO_WORKFLOW) }),
      { status: 400 },
    );
  }

  const owner = Deno.env.get('GITHUB_DISPATCH_OWNER') ?? 'subscriptionmanager26-png';
  const repo = Deno.env.get('GITHUB_DISPATCH_REPO') ?? 'pocketedge';
  const ref = Deno.env.get('GITHUB_DISPATCH_REF') ?? 'main';

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'pocketedge-supabase-cron',
      },
      body: JSON.stringify({ ref }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return new Response(
      JSON.stringify({
        ok: false,
        error: `GitHub dispatch failed: ${res.status}`,
        detail: text.slice(0, 500),
        job,
        workflow: workflowFile,
      }),
      { status: 502 },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, job, workflow: workflowFile, ref }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
