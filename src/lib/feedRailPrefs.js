/** Local preferences for Market Today custom indices / sectors. */

const INDICES_KEY = 'pe_feed_rail_indices';
const SECTORS_KEY = 'pe_feed_rail_sectors';

const MAX_INDICES = 2;
const MAX_SECTORS = 2;

function readIds(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((id) => String(id ?? '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function writeIds(key, ids, max) {
  const cleaned = [...new Set((ids ?? []).map((id) => String(id ?? '').trim()).filter(Boolean))].slice(
    0,
    max
  );
  localStorage.setItem(key, JSON.stringify(cleaned));
  return cleaned;
}

export function getRailIndexIds() {
  return readIds(INDICES_KEY).slice(0, MAX_INDICES);
}

export function setRailIndexIds(ids) {
  return writeIds(INDICES_KEY, ids, MAX_INDICES);
}

export function getRailSectorIds() {
  return readIds(SECTORS_KEY).slice(0, MAX_SECTORS);
}

export function setRailSectorIds(ids) {
  return writeIds(SECTORS_KEY, ids, MAX_SECTORS);
}

export const RAIL_MAX_INDICES = MAX_INDICES;
export const RAIL_MAX_SECTORS = MAX_SECTORS;
