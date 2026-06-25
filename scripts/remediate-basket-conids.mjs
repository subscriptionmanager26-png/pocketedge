#!/usr/bin/env node
/**
 * Audit all basket versions for missing/non-USD conids and remediate using IBKR universe.
 * Prefers USD listings (then US country, then is_prime).
 *
 * Usage:
 *   node --env-file=.env scripts/remediate-basket-conids.mjs
 *   node --env-file=.env scripts/remediate-basket-conids.mjs --dry-run
 */

import { getSupabaseAdminConfig } from './lib/supabase-admin.mjs';

const DRY_RUN = process.argv.includes('--dry-run');

function constituentConid(row) {
  const raw = row?.conid ?? row?.conId;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function instrumentToConstituent(inst, existing) {
  return {
    symbol: inst.symbol,
    name: inst.name,
    exchange: inst.exchange_id,
    conid: inst.conid,
    currency: inst.currency,
    country: inst.country,
    isin: inst.isin,
    localSymbol: inst.local_symbol || inst.symbol,
    instrumentType: inst.instrument_type || existing?.instrumentType || 'STK',
    isCustom: Boolean(existing?.isCustom),
    weight: Number(existing?.weight) || 0,
    segment: existing?.segment || (existing?.isCustom ? 'Custom' : 'Largecap'),
  };
}

function rankUsdPreference(a, b) {
  const score = (row) => {
    let s = 0;
    if (row.currency === 'USD') s += 100;
    if (row.country === 'US') s += 50;
    if (row.is_prime) s += 25;
    if (['NASDAQ', 'NYSE', 'ARCA', 'MEMX', 'BATS', 'AMEX'].includes(row.exchange_id)) s += 10;
    return s;
  };
  return score(b) - score(a);
}

async function fetchJson(url, key, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`${url} failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

async function loadBaskets(config) {
  const { url, key } = config;
  return fetchJson(
    `${url}/rest/v1/baskets?is_deleted=eq.false&select=id,current_version,basket_versions(id,version_number,name,constituents)`,
    key
  );
}

async function loadNavStates(config) {
  const { url, key } = config;
  return fetchJson(`${url}/rest/v1/basket_nav_state?select=basket_id,return_constituents`, key);
}

async function lookupUsdInstrument({ symbol, isin }, config) {
  const { url, key } = config;
  const term = (symbol || '').trim().toUpperCase();
  if (!term) return null;

  let rows = [];
  if (isin) {
    rows = await fetchJson(
      `${url}/rest/v1/ibkr_instruments?isin=eq.${encodeURIComponent(isin)}&select=conid,symbol,local_symbol,name,currency,exchange_id,country,isin,instrument_type,is_prime`,
      key
    );
  }
  if (!rows.length) {
    rows = await fetchJson(
      `${url}/rest/v1/ibkr_instruments?symbol=eq.${encodeURIComponent(term)}&select=conid,symbol,local_symbol,name,currency,exchange_id,country,isin,instrument_type,is_prime`,
      key
    );
  }

  if (!rows.length) return null;
  rows.sort(rankUsdPreference);
  return rows[0];
}

async function remediateConstituents(constituents, config) {
  const changes = [];
  const next = [];

  for (const row of constituents || []) {
    const existingConid = constituentConid(row);
    const inst = await lookupUsdInstrument(
      { symbol: row.symbol, isin: row.isin },
      config
    );

    if (!inst) {
      next.push(row);
      if (!existingConid) {
        changes.push({
          symbol: row.symbol,
          action: 'unresolved',
          reason: 'no IBKR instrument found',
        });
      }
      continue;
    }

    const needsFix =
      !existingConid ||
      existingConid !== inst.conid ||
      row.currency !== inst.currency ||
      row.exchange !== inst.exchange_id;

    if (needsFix) {
      changes.push({
        symbol: row.symbol,
        action: existingConid ? 'replaced' : 'added',
        from: existingConid,
        to: inst.conid,
        currency: inst.currency,
        exchange: inst.exchange_id,
      });
      next.push(instrumentToConstituent(inst, row));
    } else {
      next.push(row);
    }
  }

  return { constituents: next, changes };
}

async function patchVersion(config, basketId, versionNumber, constituents) {
  const { url, key } = config;
  const response = await fetch(
    `${url}/rest/v1/basket_versions?basket_id=eq.${basketId}&version_number=eq.${versionNumber}`,
    {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ constituents }),
    }
  );
  if (!response.ok) {
    throw new Error(`Patch basket_versions failed (${response.status}): ${await response.text()}`);
  }
}

async function patchNavReturnConstituents(config, basketId, returnConstituents) {
  const { url, key } = config;
  const response = await fetch(`${url}/rest/v1/basket_nav_state?basket_id=eq.${basketId}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ return_constituents: returnConstituents }),
  });
  if (!response.ok) {
    throw new Error(`Patch basket_nav_state failed (${response.status}): ${await response.text()}`);
  }
}

async function main() {
  const config = getSupabaseAdminConfig({ requireServiceRole: !DRY_RUN });
  const baskets = await loadBaskets(config);
  const navStates = await loadNavStates(config);
  const navByBasket = new Map(navStates.map((s) => [s.basket_id, s]));

  let versionFixes = 0;
  let navFixes = 0;

  console.log(`Remediate basket conids — ${baskets.length} baskets${DRY_RUN ? ' [dry-run]' : ''}`);

  for (const basket of baskets) {
    const versions = [...(basket.basket_versions || [])].sort(
      (a, b) => a.version_number - b.version_number
    );

    for (const version of versions) {
      const { constituents, changes } = await remediateConstituents(version.constituents, config);
      if (!changes.length) continue;

      versionFixes += 1;
      console.log(
        `\n${version.name} (${basket.id.slice(0, 8)}…) v${version.version_number}:`
      );
      for (const c of changes) {
        if (c.action === 'unresolved') {
          console.warn(`  ! ${c.symbol}: ${c.reason}`);
        } else {
          console.log(
            `  • ${c.symbol}: ${c.action} conid ${c.from ?? '—'} → ${c.to} (${c.currency} @ ${c.exchange})`
          );
        }
      }

      if (!DRY_RUN) {
        await patchVersion(config, basket.id, version.version_number, constituents);
      }
    }

    const current = versions.find((v) => v.version_number === basket.current_version);
    const navState = navByBasket.get(basket.id);
    if (current && navState?.return_constituents?.length) {
      const { constituents, changes } = await remediateConstituents(
        navState.return_constituents,
        config
      );
      if (changes.length) {
        navFixes += 1;
        console.log(`  ↳ NAV return_constituents synced (${changes.length} fixes)`);
        if (!DRY_RUN) {
          await patchNavReturnConstituents(config, basket.id, constituents);
        }
      }
    }
  }

  console.log(`\nDone — ${versionFixes} version(s) updated, ${navFixes} NAV state(s) synced.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
