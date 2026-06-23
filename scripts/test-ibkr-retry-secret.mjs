#!/usr/bin/env node
/** Test Supabase ibkr-preflight-retry (steps 3-4) with OTC/Asia sample misses. */

const supabaseUrl =
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  'https://zweqxjeuwwfrlpbuuayg.supabase.co';
const probeSecret = process.env.IBKR_PROBE_SECRET;

const instruments = [
  { conid: 30207299, symbol: 'AACS', exchange_id: 'OTCLNKECN' },
  { conid: 257312497, symbol: '000673', exchange_id: 'SEHKSZSE' },
  { conid: 873812252, symbol: '0039P0', exchange_id: 'KRX' },
  { conid: 596991412, symbol: '015', exchange_id: 'SWB' },
];

const headers = {
  'Content-Type': 'application/json',
  ...(probeSecret ? { 'x-probe-secret': probeSecret } : {}),
};

console.log(`secret_configured=${Boolean(probeSecret)} secret_len=${probeSecret?.length ?? 0}`);

const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/ibkr-preflight-retry`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ instruments, batch_size: 10 }),
});

const body = await response.json().catch(() => ({}));
console.log(`status=${response.status}`);
if (!response.ok) {
  console.log('error=', body.error ?? body);
  process.exit(1);
}

const byStep = { 3: 0, 4: 0, missing: 0 };
for (const row of body.results ?? []) {
  if (row.success_step === 3) byStep[3] += 1;
  else if (row.success_step === 4) byStep[4] += 1;
  else byStep.missing += 1;
}
console.log(`steps_3_4=${JSON.stringify(byStep)} priced=${(body.results ?? []).filter((r) => r.success_step).length}/${instruments.length}`);
console.log(`runtime=${body.runtime} region=${body.region}`);
