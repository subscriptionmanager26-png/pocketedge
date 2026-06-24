#!/usr/bin/env node
/**
 * Watchdog: verify today's scheduled universe price fetch completed;
 * if not (and none running), dispatch the main workflow.
 *
 * Env:
 *   EXPECTED_SLOT     us_close | overnight
 *   SINCE_ISO         ISO timestamp — look for runs at or after this time
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GITHUB_TOKEN      (Actions token with actions:write)
 *   GITHUB_REPOSITORY owner/repo
 */

import { getSupabaseAdminConfig } from './lib/supabase-admin.mjs';

const EXPECTED_SLOT = process.env.EXPECTED_SLOT;
const SINCE_ISO = process.env.SINCE_ISO;
const MIN_PROCESSED = Number(process.env.MIN_PROCESSED ?? '50000');

if (!EXPECTED_SLOT || !SINCE_ISO) {
  console.error('EXPECTED_SLOT and SINCE_ISO are required');
  process.exit(1);
}

if (!['us_close', 'overnight'].includes(EXPECTED_SLOT)) {
  console.error('EXPECTED_SLOT must be us_close or overnight');
  process.exit(1);
}

async function listRecentRuns() {
  const { url, key } = getSupabaseAdminConfig();
  const params = new URLSearchParams({
    select: 'id,status,fetch_slot,runtime,processed_count,universe_size,created_at',
    fetch_slot: `eq.${EXPECTED_SLOT}`,
    runtime: 'eq.github_actions',
    created_at: `gte.${SINCE_ISO}`,
    order: 'created_at.desc',
    limit: '5',
  });

  const response = await fetch(`${url}/rest/v1/universe_price_fetch_runs?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase query failed (${response.status}): ${await response.text()}`);
  }

  return response.json();
}

async function dispatchMainWorkflow(slot) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY required to dispatch');
  }

  const [owner, repoName] = repo.split('/');
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/universe-price-fetch.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref: 'main', inputs: { slot } }),
    },
  );

  if (!response.ok) {
    throw new Error(`Workflow dispatch failed (${response.status}): ${await response.text()}`);
  }
}

async function main() {
  console.log(`Watchdog — slot=${EXPECTED_SLOT} since=${SINCE_ISO}`);

  const runs = await listRecentRuns();
  console.log(`Found ${runs.length} run(s) since window start`);

  const running = runs.find((r) => r.status === 'running');
  if (running) {
    console.log(`Run ${running.id} still in progress (${running.processed_count ?? 0} processed) — OK`);
    return;
  }

  const completed = runs.find(
    (r) =>
      r.status === 'completed' &&
      (r.processed_count ?? 0) >= MIN_PROCESSED,
  );
  if (completed) {
    console.log(
      `Completed run ${completed.id} — ${completed.processed_count}/${completed.universe_size} processed`,
    );
    return;
  }

  console.log('No completed full-universe run found — dispatching backup fetch');
  await dispatchMainWorkflow(EXPECTED_SLOT);
  console.log(`Dispatched universe-price-fetch.yml with slot=${EXPECTED_SLOT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
