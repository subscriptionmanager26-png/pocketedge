import { fetchUserPortfolios } from './socialPortfolioApi';
import { isSupabaseConfigured } from './supabase';
import { skipAuthForDev } from './sessionStore';
import {
  clearAuthorPositionIndex,
  hasAuthorPositionIndex,
  rememberHoldingKeys,
  setAuthorPositionIndex,
} from './authorPositionsCache';

/** @type {Map<string, Promise<void>>} */
const inflight = new Map();

function useLive() {
  return isSupabaseConfigured() && !skipAuthForDev();
}

function normalizeKey(value) {
  return String(value ?? '').trim();
}

function buildAuthorIndex(portfolios) {
  const byKey = new Map();
  let totalHeldValue = 0;

  for (const portfolio of portfolios ?? []) {
    for (const holding of portfolio?.holdings ?? []) {
      const ticker = normalizeKey(holding?.ticker ?? holding?.symbol);
      const name = normalizeKey(holding?.assetName ?? holding?.name);
      const qty = Number(holding?.qty) || 0;
      if (!ticker && !name) continue;
      if (qty <= 0) continue;

      const value = Number(holding?.value);
      const heldValue = Number.isFinite(value) && value > 0 ? value : 0;
      totalHeldValue += heldValue;

      const pnlPct = Number(holding?.pnlPct);
      const entry = {
        status: 'holds',
        qty,
        avg: Number(holding?.avg) || 0,
        value: heldValue || null,
        pnlPct: Number.isFinite(pnlPct) ? pnlPct : null,
      };

      rememberHoldingKeys(byKey, [ticker, name], entry);
    }

    for (const ticker of portfolio?.tickers ?? []) {
      const key = normalizeKey(ticker);
      if (!key || byKey.has(key) || byKey.has(key.toUpperCase())) continue;
      rememberHoldingKeys(byKey, [key], {
        status: 'holds',
        qty: null,
        avg: null,
        value: null,
        pnlPct: null,
      });
    }
  }

  return { byKey, totalHeldValue };
}

export async function hydrateAuthorPositions(userIds = []) {
  if (!useLive()) return;

  const unique = [...new Set((userIds ?? []).filter(Boolean).map(String))];
  const missing = unique.filter((id) => !hasAuthorPositionIndex(id) && !inflight.has(id));

  await Promise.all(
    missing.map((userId) => {
      const task = fetchUserPortfolios(userId)
        .then((portfolios) => {
          setAuthorPositionIndex(userId, buildAuthorIndex(portfolios));
        })
        .catch(() => {
          setAuthorPositionIndex(userId, { byKey: new Map(), totalHeldValue: 0 });
        })
        .finally(() => {
          inflight.delete(userId);
        });
      inflight.set(userId, task);
      return task;
    })
  );

  await Promise.all(unique.map((id) => inflight.get(id)).filter(Boolean));
}

/** Drop cached positions after the current user edits their own book. */
export function invalidateAuthorPositions(userId) {
  if (!userId) return;
  const id = String(userId);
  clearAuthorPositionIndex(id);
  inflight.delete(id);
}
