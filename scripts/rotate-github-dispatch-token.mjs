#!/usr/bin/env node
/**
 * Rotate GITHUB_DISPATCH_TOKEN into Supabase Edge secrets (and optionally Vercel).
 *
 * Create the token on the subscriptionmanager26-png GitHub account:
 *   Classic PAT (preferred): https://github.com/settings/tokens/new
 *     - Note: pocketedge-dispatch
 *     - Expiration: No expiration (if your org allows it)
 *     - Scopes: repo, workflow
 *   Fine-grained (max 1 year): https://github.com/settings/personal-access-tokens/new
 *     - Repository: pocketedge only
 *     - Permissions: Actions Read and write, Metadata Read
 *
 * Usage:
 *   GITHUB_DISPATCH_TOKEN=github_pat_... npm run rotate:github-dispatch
 *
 * Requires SUPABASE_ACCESS_TOKEN_POCKETEDGE_MAIN in .env (Management API).
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PROJECT_REF = 'zweqxjeuwwfrlpbuuayg';
const OWNER = process.env.GITHUB_DISPATCH_OWNER ?? 'subscriptionmanager26-png';
const REPO = process.env.GITHUB_DISPATCH_REPO ?? 'pocketedge';
const TEST_WORKFLOW = 'refresh-amc-etf-inav.yml';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    let val = trimmed.slice(eq + 1);
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(resolve(process.cwd(), '.env'));
loadEnvFile(resolve(process.cwd(), '.env.local'));

const token = process.env.GITHUB_DISPATCH_TOKEN?.trim();
if (!token) {
  console.error('Missing GITHUB_DISPATCH_TOKEN. Create a PAT and re-run:');
  console.error('  GITHUB_DISPATCH_TOKEN=github_pat_... npm run rotate:github-dispatch');
  process.exit(1);
}

async function verifyToken() {
  const me = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!me.ok) {
    console.error('Token invalid for /user:', me.status, (await me.text()).slice(0, 200));
    process.exit(2);
  }
  const user = await me.json();
  console.log(`GitHub user: ${user.login}`);

  const dispatch = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${TEST_WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    },
  );
  if (dispatch.status !== 204) {
    console.error('Token cannot dispatch workflows:', dispatch.status, (await dispatch.text()).slice(0, 300));
    process.exit(3);
  }
  console.log(`Dispatch OK: ${TEST_WORKFLOW}`);
}

function setSupabaseSecret() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN_POCKETEDGE_MAIN?.trim();
  if (!accessToken) {
    console.error('Missing SUPABASE_ACCESS_TOKEN_POCKETEDGE_MAIN in .env');
    process.exit(4);
  }
  execSync(
    `supabase secrets set GITHUB_DISPATCH_TOKEN=${JSON.stringify(token)} --project-ref ${PROJECT_REF}`,
    {
      stdio: 'inherit',
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
    },
  );
  console.log(`Supabase secret GITHUB_DISPATCH_TOKEN updated (${PROJECT_REF})`);
}

function setVercelSecretIfRequested() {
  if (process.env.SKIP_VERCEL === '1') return;
  try {
    execSync('vercel --version', { stdio: 'pipe' });
  } catch {
    console.log('Vercel CLI not found — skip Vercel env (set SKIP_VERCEL=1 to silence)');
    return;
  }
  try {
    execSync(
      `printf %s ${JSON.stringify(token)} | vercel env add GITHUB_DISPATCH_TOKEN production --force`,
      { stdio: 'inherit' },
    );
    console.log('Vercel production GITHUB_DISPATCH_TOKEN updated');
  } catch (err) {
    console.warn('Vercel env update failed (run manually if needed):', err.message ?? err);
  }
}

async function testSupabaseDispatch() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    console.log('Skip Supabase dispatch smoke test (no service role in env)');
    return;
  }
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: row, error } = await client
    .from('social_market_job_config')
    .select('auth_token')
    .eq('job_name', 'dispatch-github-workflow')
    .maybeSingle();
  if (error || !row?.auth_token) {
    console.warn('Could not read x-dispatch-token from DB:', error?.message);
    return;
  }
  // Edge secrets can take ~1 min to propagate; wait briefly.
  await new Promise((r) => setTimeout(r, 5000));
  const res = await fetch(`${supabaseUrl}/functions/v1/dispatch-github-workflow`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-dispatch-token': row.auth_token,
    },
    body: JSON.stringify({ job: 'amc-inav' }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.warn(`Supabase dispatch smoke test: ${res.status} ${body.slice(0, 300)}`);
    console.warn('If 502 Bad credentials, wait 60s for edge secret propagation and re-run test.');
    return;
  }
  console.log('Supabase dispatch smoke test OK:', body.slice(0, 120));
}

await verifyToken();
setSupabaseSecret();
setVercelSecretIfRequested();
await testSupabaseDispatch();
console.log('\nDone. Prefer GitHub App auth long-term — see docs/ops/github-dispatch-auth.md');
