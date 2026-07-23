/**
 * Load the monthly Upvaly MF screener snapshot.
 * Caches in IndexedDB; checks remote meta at most once per day.
 */

import { buildMetricsIndex } from './metrics';

const SNAPSHOT_URL = '/data/screener/screener-snapshot.json';
const META_URL = '/data/screener/screener-snapshot-meta.json';

const DB_NAME = 'pocketedge-mf-screener';
const DB_VERSION = 1;
const STORE = 'snapshots';
const CACHE_KEY = 'latest';
const VERSION_LOCAL_KEY = 'pe_mf_screener_snapshot_version_v1';
const META_CHECK_KEY = 'pe_mf_screener_meta_checked_at_v1';
const META_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

function versionKey(meta) {
  return `${meta.generatedAt}|${meta.fetched}|${meta.fundCount}`;
}

function metaFromSnapshot(snapshot) {
  return {
    generatedAt: snapshot.generatedAt,
    fetchedAt: snapshot.fetchedAt,
    source: snapshot.source,
    fundCount: snapshot.fundCount,
    fetched: snapshot.fetched,
    failedCount: snapshot.failed?.length ?? 0,
  };
}

function readLocalVersion() {
  try {
    return localStorage.getItem(VERSION_LOCAL_KEY);
  } catch {
    return null;
  }
}

function writeLocalVersion(meta) {
  try {
    localStorage.setItem(VERSION_LOCAL_KEY, versionKey(meta));
  } catch {
    /* ignore */
  }
}

function readLastMetaCheckMs() {
  try {
    const raw = localStorage.getItem(META_CHECK_KEY);
    if (!raw) return null;
    const t = Number(raw);
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

function writeLastMetaCheckMs(ms) {
  try {
    localStorage.setItem(META_CHECK_KEY, String(ms));
  } catch {
    /* ignore */
  }
}

function shouldCheckRemoteMeta(now = Date.now()) {
  const lastCheck = readLastMetaCheckMs();
  if (lastCheck == null) return false;
  return now - lastCheck >= META_CHECK_INTERVAL_MS;
}

function ensureMetaCheckSeededFromCache(snapshot) {
  if (readLastMetaCheckMs() != null) return;
  writeLastMetaCheckMs(Date.now());
  const meta = metaFromSnapshot(snapshot);
  if (!readLocalVersion()) writeLocalVersion(meta);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function readCachedSnapshot() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(CACHE_KEY);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
      req.onsuccess = () => resolve(req.result ?? null);
    });
  } catch {
    return null;
  }
}

async function writeCachedSnapshot(snapshot) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
      tx.objectStore(STORE).put(snapshot, CACHE_KEY);
    });
    writeLocalVersion(metaFromSnapshot(snapshot));
  } catch {
    /* cache is best-effort */
  }
}

async function fetchRemoteMeta() {
  const res = await fetch(META_URL, { cache: 'no-cache' });
  if (res.ok) return res.json();

  const res2 = await fetch(SNAPSHOT_URL, {
    headers: { Range: 'bytes=0-4095' },
    cache: 'no-cache',
  });
  if (!res2.ok) throw new Error(`Failed to load screener snapshot meta (${res2.status})`);
  const prefix = await res2.text();
  const generatedAt = prefix.match(/"generatedAt"\s*:\s*"([^"]+)"/)?.[1];
  const fetchedAt = prefix.match(/"fetchedAt"\s*:\s*"([^"]+)"/)?.[1];
  const fundCount = Number(prefix.match(/"fundCount"\s*:\s*(\d+)/)?.[1]);
  const fetched = Number(prefix.match(/"fetched"\s*:\s*(\d+)/)?.[1]);
  const source = prefix.match(/"source"\s*:\s*"([^"]+)"/)?.[1];
  if (!generatedAt || !Number.isFinite(fundCount) || !Number.isFinite(fetched)) {
    throw new Error('Failed to parse screener snapshot version');
  }
  return {
    generatedAt,
    fetchedAt,
    fundCount,
    fetched,
    source: source ?? '',
  };
}

async function fetchRemoteSnapshot() {
  const res = await fetch(SNAPSHOT_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load screener snapshot (${res.status})`);
  return res.json();
}

async function refreshScreenerSnapshotIfRemoteChanged(cached) {
  if (!shouldCheckRemoteMeta()) return;

  writeLastMetaCheckMs(Date.now());

  try {
    const remoteMeta = await fetchRemoteMeta();
    const remoteVersion = versionKey(remoteMeta);
    const localVersion = readLocalVersion();
    if (localVersion === remoteVersion) return;
    if (
      cached.generatedAt === remoteMeta.generatedAt &&
      cached.fetched === remoteMeta.fetched &&
      cached.fundCount === remoteMeta.fundCount
    ) {
      writeLocalVersion(remoteMeta);
      return;
    }
    const remote = await fetchRemoteSnapshot();
    await writeCachedSnapshot(remote);
  } catch {
    /* background check is best-effort */
  }
}

export async function loadScreenerSnapshot() {
  const cached = await readCachedSnapshot();
  if (cached && Object.keys(cached.funds ?? {}).length > 0) {
    ensureMetaCheckSeededFromCache(cached);
    if (shouldCheckRemoteMeta()) {
      void refreshScreenerSnapshotIfRemoteChanged(cached);
    }
    return cached;
  }

  const remoteMeta = await fetchRemoteMeta();
  writeLastMetaCheckMs(Date.now());
  const remoteVersion = versionKey(remoteMeta);
  const localVersion = readLocalVersion();

  if (cached && localVersion === remoteVersion) return cached;

  if (
    cached &&
    cached.generatedAt === remoteMeta.generatedAt &&
    cached.fetched === remoteMeta.fetched &&
    cached.fundCount === remoteMeta.fundCount
  ) {
    writeLocalVersion(remoteMeta);
    return cached;
  }

  const remote = await fetchRemoteSnapshot();
  await writeCachedSnapshot(remote);
  return remote;
}

export function formatSnapshotDate(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export { buildMetricsIndex };
