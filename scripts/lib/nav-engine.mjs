/**
 * Fetch-boundary basket NAV engine.
 *
 * Mid-day creation: NAV=100, 100% cash (0% return) until first fetch.
 * At first fetch: NAV unchanged, constituents activated for next period.
 *
 * Missing prices: skip NAV update entirely; caller marks basket as error.
 */

export function constituentConid(row) {
  const conid = row?.conid ?? row?.conId;
  return conid != null ? Number(conid) : null;
}

export function normalizeWeights(constituents) {
  const list = (constituents || []).filter((c) => constituentConid(c));
  if (!list.length) return [];

  const total = list.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
  if (total > 0) {
    return list.map((c) => ({
      ...c,
      conid: constituentConid(c),
      weight: Number(c.weight) / total,
    }));
  }

  const equal = 1 / list.length;
  return list.map((c) => ({ ...c, conid: constituentConid(c), weight: equal }));
}

/**
 * Conids required for this fetch boundary.
 * - Cash activation: all current constituents need current prices.
 * - Normal period: all return_constituents need prior + current prices.
 */
export function requiredConidsForFetch(navState, currentConstituents) {
  const isActivated = Boolean(navState.is_activated);
  if (!isActivated) {
    return normalizeWeights(currentConstituents).map((c) => c.conid);
  }
  return normalizeWeights(navState.return_constituents || []).map((c) => c.conid);
}

/**
 * Returns missing conids that block NAV calculation.
 */
export function findMissingPricesForFetch(
  navState,
  currentConstituents,
  priorPrices,
  currentPrices
) {
  const isActivated = Boolean(navState.is_activated);
  const required = requiredConidsForFetch(navState, currentConstituents);
  const missing = [];

  for (const conid of required) {
    if (isActivated) {
      const prev = priorPrices.get(conid);
      const curr = currentPrices.get(conid);
      if (prev == null || prev <= 0 || curr == null || curr <= 0) {
        missing.push(conid);
      }
    } else {
      const curr = currentPrices.get(conid);
      if (curr == null || curr <= 0) {
        missing.push(conid);
      }
    }
  }

  return missing;
}

/**
 * Weighted return factor for the period (1.0 = flat).
 * Caller must verify prices complete before calling.
 */
export function computePeriodReturnFactor(returnConstituents, priorPrices, currentPrices) {
  const weights = normalizeWeights(returnConstituents);
  if (!weights.length) return 1;

  let factor = 0;

  for (const row of weights) {
    const prev = priorPrices.get(row.conid);
    const curr = currentPrices.get(row.conid);
    if (prev == null || curr == null || prev <= 0 || curr <= 0) {
      throw new Error(`Missing price for conid ${row.conid} in return calculation`);
    }
    factor += row.weight * (curr / prev);
  }

  return factor;
}

/**
 * Apply one fetch boundary for a basket.
 * @param {{ skipMissingCheck?: boolean }} options — tests only
 */
export function applyFetchBoundary({
  navState,
  currentConstituents,
  priorPrices,
  currentPrices,
  skipMissingCheck = false,
}) {
  const priorNav = Number(navState.nav) || 100;
  const returnConstituents = navState.return_constituents || [];
  const isActivated = Boolean(navState.is_activated);

  if (!skipMissingCheck) {
    const missing = findMissingPricesForFetch(
      navState,
      currentConstituents,
      priorPrices,
      currentPrices
    );
    if (missing.length) {
      return {
        ok: false,
        missing_conids: missing,
        prior_nav: priorNav,
        nav: priorNav,
        period_return: 0,
        prior_constituents: isActivated ? returnConstituents : [],
        current_constituents: currentConstituents || [],
        return_constituents: returnConstituents,
        is_activated: isActivated,
        was_cash_period: false,
      };
    }
  }

  let periodReturnFactor;
  let wasCashPeriod = false;
  let priorConstituentsSnapshot;

  if (!isActivated) {
    periodReturnFactor = 1;
    wasCashPeriod = true;
    priorConstituentsSnapshot = [];
  } else {
    priorConstituentsSnapshot = returnConstituents;
    periodReturnFactor = computePeriodReturnFactor(
      returnConstituents,
      priorPrices,
      currentPrices
    );
  }

  const newNav = priorNav * periodReturnFactor;
  const periodReturn = periodReturnFactor - 1;

  return {
    ok: true,
    prior_nav: priorNav,
    nav: newNav,
    period_return: periodReturn,
    prior_constituents: priorConstituentsSnapshot,
    current_constituents: currentConstituents || [],
    return_constituents: currentConstituents || [],
    is_activated: true,
    was_cash_period: wasCashPeriod,
  };
}

/**
 * Drifted weights from price moves since last fetch.
 */
export function computeDriftedWeights(returnConstituents, priorPrices, currentPrices) {
  const weights = normalizeWeights(returnConstituents);
  if (!weights.length) return [];

  const rows = weights.map((row) => {
    const prev = priorPrices.get(row.conid);
    const curr = currentPrices.get(row.conid);
    const driftValue =
      prev != null && curr != null && prev > 0 && curr > 0
        ? row.weight * (curr / prev)
        : row.weight;
    return { ...row, driftValue, targetWeight: row.weight * 100 };
  });

  const total = rows.reduce((sum, r) => sum + r.driftValue, 0);
  return rows.map((r) => ({
    conid: r.conid,
    symbol: r.symbol,
    name: r.name,
    targetWeight: r.targetWeight,
    currentWeight: total > 0 ? (r.driftValue / total) * 100 : r.targetWeight,
  }));
}

export function detectFetchSlot(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);

  if (hour >= 12 && hour < 24) return 'us_close';
  return 'overnight';
}

export function pricesMapFromRows(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (row.conid != null && row.price != null) {
      map.set(Number(row.conid), Number(row.price));
    }
  }
  return map;
}
