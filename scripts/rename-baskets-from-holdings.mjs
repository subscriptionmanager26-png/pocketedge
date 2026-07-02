#!/usr/bin/env node
/**
 * Rename baskets from current holdings and set themed cover images.
 * Updates the active basket_versions row for each basket.
 *
 * Usage: node --env-file=.env scripts/rename-baskets-from-holdings.mjs
 *        node --env-file=.env scripts/rename-baskets-from-holdings.mjs --dry-run
 */

import { getSupabaseAdminConfig } from './lib/supabase-admin.mjs';

const DRY_RUN = process.argv.includes('--dry-run');

const IMG = (id) =>
  `https://images.unsplash.com/photo-${id}?w=960&h=600&fit=crop&q=80`;

/** @type {Record<string, { name: string, shortDescription: string, description: string, imageUrl: string, imageGradient: string }>} */
const BASKET_BRANDING = {
  'c0100001-0001-4001-8001-000000000001': {
    name: 'AI & Data Center Theme',
    shortDescription: 'NVDA, MSFT, TSM, and leaders in AI compute, cloud, and data center infrastructure.',
    description:
      'A diversified play on the AI buildout: semiconductor leaders, hyperscalers, and data center REITs powering global compute demand.',
    imageUrl: IMG('1558494949-ef010cbdcc31'),
    imageGradient: 'from-violet-600 to-cyan-500',
  },
  'c0100001-0001-4001-8001-000000000002': {
    name: 'US Tech Giants',
    shortDescription: 'Equal-weight exposure to AAPL, MSFT, GOOGL, AMZN, and NVDA.',
    description:
      'The five defining US mega-cap technology platforms — balanced across software, cloud, commerce, and AI silicon.',
    imageUrl: IMG('1518770660439-4636190af475'),
    imageGradient: 'from-emerald-600 to-teal-500',
  },
  'c0100001-0001-4001-8001-000000000003': {
    name: 'Global EV Revolution',
    shortDescription: 'TSLA, RIVN, NIO, LI, and LCID — pure-play global electric vehicle manufacturers.',
    description:
      'Equal-weight basket of leading EV OEMs across the US and China, capturing the shift to electrified transport.',
    imageUrl: IMG('1593941707882-a5bba14938c7'),
    imageGradient: 'from-lime-600 to-emerald-500',
  },
  'c0100001-0001-4001-8001-000000000004': {
    name: 'Dividend Quality Leaders',
    shortDescription: 'JNJ, PG, KO, PEP, VZ, and other stable, high-quality dividend payers.',
    description:
      'Defensive compounders with long payout histories — consumer staples, telecom, and healthcare anchors.',
    imageUrl: IMG('1611974789855-9c2a0a7236a3'),
    imageGradient: 'from-amber-600 to-orange-500',
  },
  '708f9fcb-3b44-4f41-abc3-83f1833851a5': {
    name: 'Big Tech & DeFi',
    shortDescription: 'Equal-weight Apple, Microsoft, and Aave — blue-chip software plus crypto exposure.',
    description:
      'Blends two of the largest US technology franchises with Aave, a leading decentralized finance protocol ETP.',
    imageUrl: IMG('1621761191319-c6fb62004040'),
    imageGradient: 'from-violet-600 to-fuchsia-500',
  },
  'db258ed1-86fc-46ea-93c6-4b5c42a05dc4': {
    name: 'Memory & DeFi',
    shortDescription: 'Micron Technology and Aave — semiconductor memory paired with decentralized finance.',
    description:
      'Half Micron, the memory leader riding AI datacenter demand, and half Aave for digital-asset protocol exposure.',
    imageUrl: IMG('1518770660439-4636190af475'),
    imageGradient: 'from-emerald-600 to-cyan-500',
  },
  '0a47722d-e02b-45fe-bc9e-5211c860d7cc': {
    name: 'AI Memory Stack',
    shortDescription: 'Micron-heavy memory exposure with DRAM ETF and Nebius AI compute.',
    description:
      '70% Micron, 20% Roundhill Memory ETF (DRAM), and 10% Nebius — a concentrated bet on AI-driven memory and compute.',
    imageUrl: IMG('1558494949-ef010cbdcc31'),
    imageGradient: 'from-blue-600 to-indigo-500',
  },
  '51c7d800-c7bc-4fce-a91d-aada1234b678': {
    name: 'Global Chip Leaders',
    shortDescription: 'TSMC, Roundhill Memory ETF, and Intel — foundry, memory, and legacy x86 silicon.',
    description:
      'Equal-weight trio spanning the semiconductor value chain: TSMC foundry leadership, memory via DRAM, and Intel.',
    imageUrl: IMG('1518770660439-4636190af475'),
    imageGradient: 'from-slate-600 to-blue-500',
  },
};

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

async function main() {
  const config = getSupabaseAdminConfig({ requireServiceRole: !DRY_RUN });
  const { url, key } = config;

  const baskets = await fetchJson(
    `${url}/rest/v1/baskets?is_deleted=eq.false&select=id,current_version`,
    key
  );

  console.log(`Rename baskets from holdings — ${baskets.length} baskets${DRY_RUN ? ' [dry-run]' : ''}`);

  for (const basket of baskets) {
    const branding = BASKET_BRANDING[basket.id];
    if (!branding) {
      console.warn(`  ! No branding map for ${basket.id}`);
      continue;
    }

    console.log(`\n• ${branding.name} (${basket.id.slice(0, 8)}…) v${basket.current_version}`);

    if (DRY_RUN) continue;

    const response = await fetch(
      `${url}/rest/v1/basket_versions?basket_id=eq.${basket.id}&version_number=eq.${basket.current_version}`,
      {
        method: 'PATCH',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          name: branding.name,
          short_description: branding.shortDescription,
          description: branding.description,
          image_url: branding.imageUrl,
          image_gradient: branding.imageGradient,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Patch failed (${response.status}): ${await response.text()}`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
