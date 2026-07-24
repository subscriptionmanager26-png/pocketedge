/**
 * Vercel Cron → GitHub Actions workflow_dispatch.
 *
 * Required env (Production):
 *   CRON_SECRET              — Vercel sends Authorization: Bearer <CRON_SECRET>
 *   GITHUB_DISPATCH_TOKEN    — fine-grained PAT with Actions: write
 */

export const config = {
  runtime: 'edge',
};

const JOB_TO_WORKFLOW: Record<string, string> = {
  equity: 'social-market-price-equity.yml',
  funds: 'social-market-price-funds.yml',
  commodities: 'social-market-price-commodities.yml',
  'asset-sync': 'social-market-asset-sync.yml',
  ibja: 'social-market-price-ibja.yml',
};

/** Jobs scheduled via vercel.json — reject others even if secret is known. */
const VERCEL_SCHEDULED_JOBS = new Set([
  'funds',
  'asset-sync',
]);

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function authorize(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const auth = request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${cronSecret}`) return false;
  // Vercel Cron always sends this; block casual secret replay from browsers.
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron !== '1') return false;
  return true;
}

export default async function handler(request: Request) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  if (!authorize(request)) {
    return json(401, { ok: false, error: 'Unauthorized' });
  }

  const url = new URL(request.url);
  const job = url.pathname.split('/').filter(Boolean).pop() ?? '';
  if (!VERCEL_SCHEDULED_JOBS.has(job)) {
    return json(400, {
      ok: false,
      error: `Job "${job}" is not enabled on Vercel cron`,
      allowed: [...VERCEL_SCHEDULED_JOBS],
    });
  }

  const workflowFile = JOB_TO_WORKFLOW[job];
  if (!workflowFile) {
    return json(400, { ok: false, error: `Unknown job "${job}"` });
  }

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return json(500, { ok: false, error: 'Missing GITHUB_DISPATCH_TOKEN' });
  }

  const owner = process.env.GITHUB_DISPATCH_OWNER ?? 'subscriptionmanager26-png';
  const repo = process.env.GITHUB_DISPATCH_REPO ?? 'pocketedge';
  const ref = process.env.GITHUB_DISPATCH_REF ?? 'main';

  const dispatchUrl =
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`;

  const res = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'pocketedge-vercel-cron',
    },
    body: JSON.stringify({ ref }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return json(502, {
      ok: false,
      error: `GitHub dispatch failed: ${res.status}`,
      detail: text.slice(0, 500),
      job,
      workflow: workflowFile,
    });
  }

  return json(200, {
    ok: true,
    job,
    workflow: workflowFile,
    ref,
    schedule: request.headers.get('x-vercel-cron-schedule'),
  });
}
