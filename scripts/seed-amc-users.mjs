/**
 * Seed Mutual Fund AMC social users + per-scheme watchlist portfolios
 * from mf-holdings-scraper holdings_with_isin_by_scheme/*.json
 *
 * Usage:
 *   node scripts/seed-amc-users.mjs [--dry-run] [--amc=hdfc]
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + VITE_SUPABASE_URL (or SUPABASE_URL)
 * in env / .env.vercel.production
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HOLDINGS_DIR = '/Users/kushagraagarwal/mf-holdings-scraper/holdings_with_isin_by_scheme';
const WATCHLIST_BASE = 10_000;

const USERNAME_MAP = {
  'ICICI Prudential Mutual Fund': 'icici',
  'Kotak Mahindra Mutual Fund': 'kotak',
  'Aditya Birla Sun Life Mutual Fund': 'absl',
  'SBI Mutual Fund': 'sbi',
  'HDFC Mutual Fund': 'hdfc',
  'Tata Mutual Fund': 'tata',
  'quant Mutual Fund': 'quant',
  'Motilal Oswal Mutual Fund': 'motilal',
  'Nippon India Mutual Fund': 'nippon',
  'Baroda BNP Paribas Mutual Fund': 'baroda',
  'UTI Mutual Fund': 'uti',
  'Invesco Mutual Fund': 'invesco',
  'Axis Mutual Fund': 'axis',
  'LIC Mutual Fund': 'lic',
  'Sundaram Mutual Fund': 'sundaram',
  'Bandhan Mutual Fund': 'bandhan',
  'Franklin Templeton Mutual Fund': 'franklin',
  'DSP Mutual Fund': 'dsp',
  'HSBC Mutual Fund': 'hsbc',
  'Canara Robeco Mutual Fund': 'canara',
  'Edelweiss Mutual Fund': 'edelweiss',
  'ITI Mutual Fund': 'iti',
  'Union Mutual Fund': 'union',
  'WhiteOak Capital Mutual Fund': 'whiteoak',
  'Mirae Asset Mutual Fund': 'mirae',
  'Mahindra Manulife Mutual Fund': 'mahindra',
  'Bank of India Mutual Fund': 'boi',
  'Bajaj Finserv Mutual Fund': 'bajaj',
  'JM Financial Mutual Fund': 'jmfinancial',
  'PGIM India Mutual Fund': 'pgim',
  'Samco Mutual Fund': 'samco',
  'Taurus Mutual Fund': 'taurus',
  'Groww Mutual Fund': 'groww',
  'Quantum Mutual Fund': 'quantum',
  'Helios Mutual Fund': 'helios',
  '360 ONE Mutual Fund': '360one',
  'Navi Mutual Fund': 'navi',
  'The Wealth Company Mutual Fund': 'wealthco',
  'Trust Mutual Fund': 'trust',
  'PPFAS Mutual Fund': 'ppfas',
  'Shriram Mutual Fund': 'shriram',
  'Jio BlackRock Mutual Fund': 'jioblackrock',
  'NJ Mutual Fund': 'njmf',
  'Abakkus Mutual Fund': 'abakkus',
  'Old Bridge Mutual Fund': 'oldbridge',
  'Capitalmind Mutual Fund': 'capitalmind',
  'Unifi Mutual Fund': 'unifi',
};

const EQUITY_TAGS = new Set(['equity', 'overseas_equity']);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(path.join(ROOT, '.env.vercel.production'));
loadEnvFile(path.join(ROOT, '.env'));

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const amcFilter = [...args].find((a) => a.startsWith('--amc='))?.slice(6)?.toLowerCase();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL / VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function resolveAmc(scheme) {
  let amc = String(scheme.amc || '').trim();
  if (amc) return amc;
  const name = String(scheme.scheme_name || '');
  if (/mahindra/i.test(name)) return 'Mahindra Manulife Mutual Fund';
  if (/groww/i.test(name)) return 'Groww Mutual Fund';
  return '';
}

function freeTextTicker(name) {
  const raw = String(name || 'UNKNOWN')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return raw || 'UNKNOWN';
}

function holdingsToWatchlist(holdings) {
  const rows = [];
  const tickers = [];
  for (const h of holdings || []) {
    if (!EQUITY_TAGS.has(h.asset_tag)) continue;
    const weightPct = Number(String(h.weightage ?? '').replace(/,/g, ''));
    if (!Number.isFinite(weightPct) || weightPct <= 0) continue;
    const symbol = String(h.symbol || '').trim().toUpperCase();
    const isin = h.isin ? String(h.isin).trim().toUpperCase() : null;
    const ticker = symbol || (isin || freeTextTicker(h.name));
    const assetName = String(h.name || ticker).trim();
    rows.push({
      ticker,
      assetName,
      isin,
      assetType: 'stock',
      weightPct: Math.round(weightPct * 100) / 100,
      qty: 0,
      avg: 0,
      price: 0,
      value: 0,
      pnl: 0,
      pnlPct: 0,
    });
    tickers.push(ticker);
  }
  return { holdings: rows, tickers };
}

function loadSchemesByAmc() {
  const byAmc = new Map();
  for (const file of fs.readdirSync(HOLDINGS_DIR).filter((f) => f.endsWith('.json'))) {
    const scheme = JSON.parse(fs.readFileSync(path.join(HOLDINGS_DIR, file), 'utf8'));
    const amc = resolveAmc(scheme);
    if (!amc || !USERNAME_MAP[amc]) continue;
    const username = USERNAME_MAP[amc];
    if (amcFilter && username !== amcFilter) continue;
    if (!byAmc.has(amc)) byAmc.set(amc, { username, displayName: amc, schemes: [] });
    byAmc.get(amc).schemes.push(scheme);
  }
  return byAmc;
}

async function ensureAmcUser(username, displayName) {
  const { data: existing, error: findErr } = await supabase
    .from('social_profiles')
    .select('user_id, username, display_name')
    .ilike('username', username)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing?.user_id) {
    if (existing.display_name !== displayName) {
      await supabase
        .from('social_profiles')
        .update({
          display_name: displayName,
          bio: 'Mutual fund AMC · scheme holdings published as watchlists',
        })
        .eq('user_id', existing.user_id);
    }
    return existing.user_id;
  }

  // Create auth user with no email via SQL (Admin API requires email).
  const { data: created, error: createErr } = await supabase.rpc('seed_amc_auth_user', {
    p_username: username,
    p_display_name: displayName,
  });

  if (!createErr && created) return created;

  // Fallback: raw SQL via PostgREST isn't available; use auth admin with placeholder
  // email that cannot receive mail, then clear email in SQL if RPC missing.
  if (createErr?.code === 'PGRST202' || /seed_amc_auth_user/i.test(createErr?.message || '')) {
    throw new Error(
      'Missing seed_amc_auth_user RPC. Apply the seed helper migration first (script will print SQL).',
    );
  }
  throw createErr || new Error('Failed to create AMC user');
}

async function upsertSchemeWatchlist(ownerId, scheme) {
  const schemeCode = String(scheme.scheme_code || '');
  const name = String(scheme.scheme_name || `Scheme ${schemeCode}`).trim();
  const { holdings, tickers } = holdingsToWatchlist(scheme.holdings);

  // Idempotent: one watchlist per owner + scheme code marker in objective.
  const objective = `AMFI ${schemeCode}${scheme.isin_scheme ? ` · ${scheme.isin_scheme}` : ''}`;
  const thesis = [
    scheme.category || null,
    scheme.aum ? `AUM ₹${scheme.aum} Cr` : null,
    'Holdings seeded from AMC scheme book (no avg buy price → watchlist).',
  ]
    .filter(Boolean)
    .join(' · ');

  const { data: existingRows, error: findErr } = await supabase
    .from('social_portfolios')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('kind', 'watchlist')
    .eq('objective', objective)
    .limit(1);
  if (findErr) throw findErr;

  const payload = {
    owner_id: ownerId,
    kind: 'watchlist',
    name,
    objective,
    thesis,
    is_draft: false,
    is_archived: false,
    watchlist_base_investment: WATCHLIST_BASE,
    tickers,
    holdings,
    updated_at: new Date().toISOString(),
  };

  if (existingRows?.[0]?.id) {
    const { error } = await supabase
      .from('social_portfolios')
      .update(payload)
      .eq('id', existingRows[0].id);
    if (error) throw error;
    return { id: existingRows[0].id, action: 'updated', holdings: holdings.length };
  }

  const { data, error } = await supabase
    .from('social_portfolios')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id, action: 'inserted', holdings: holdings.length };
}

async function main() {
  const byAmc = loadSchemesByAmc();
  console.log(`AMCs to seed: ${byAmc.size}${dryRun ? ' (dry-run)' : ''}`);

  let users = 0;
  let portfolios = 0;
  let holdingsTotal = 0;

  for (const [amc, bundle] of [...byAmc.entries()].sort((a, b) =>
    a[1].username.localeCompare(b[1].username),
  )) {
    console.log(`\n→ ${bundle.username} (${amc}) · ${bundle.schemes.length} schemes`);
    if (dryRun) {
      for (const s of bundle.schemes) {
        const { holdings } = holdingsToWatchlist(s.holdings);
        holdingsTotal += holdings.length;
        portfolios += 1;
      }
      users += 1;
      continue;
    }

    const ownerId = await ensureAmcUser(bundle.username, bundle.displayName);
    users += 1;
    console.log(`  user_id=${ownerId}`);

    for (const scheme of bundle.schemes) {
      const result = await upsertSchemeWatchlist(ownerId, scheme);
      portfolios += 1;
      holdingsTotal += result.holdings;
      if (result.holdings === 0) {
        console.log(`  · ${scheme.scheme_code} empty equity (${result.action})`);
      }
    }
  }

  console.log(`\nDone. users=${users} portfolios=${portfolios} equity_holdings=${holdingsTotal}`);
}

main().catch((err) => {
  console.error(err);
  if (/Missing seed_amc_auth_user/i.test(err.message || '')) {
    console.error(`
Apply this SQL once via Supabase, then re-run:

create or replace function public.seed_amc_auth_user(p_username text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
begin
  if p_username !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'invalid username: %', p_username;
  end if;

  select user_id into v_id from public.social_profiles where lower(username) = lower(p_username);
  if v_id is not null then
    update public.social_profiles
      set display_name = p_display_name,
          bio = coalesce(nullif(bio, ''), 'Mutual fund AMC · scheme holdings published as watchlists')
      where user_id = v_id;
    return v_id;
  end if;

  v_id := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    null,
    null,
    now(),
    jsonb_build_object('provider', 'amc_seed', 'providers', jsonb_build_array('amc_seed')),
    jsonb_build_object('full_name', p_display_name, 'amc_seed', true, 'username', p_username),
    now(), now(),
    '', '', '', '',
    false, false
  );

  update public.social_profiles
    set username = p_username,
        display_name = p_display_name,
        bio = 'Mutual fund AMC · scheme holdings published as watchlists'
    where user_id = v_id;

  return v_id;
end;
$$;

revoke all on function public.seed_amc_auth_user(text, text) from public;
grant execute on function public.seed_amc_auth_user(text, text) to service_role;
`);
  }
  process.exit(1);
});
