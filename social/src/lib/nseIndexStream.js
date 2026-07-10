const NSE_STREAM_BASE = 'wss://streamer.nseindia.com/';
const STREAM_FREQ = 'high';

/** NSE live indices page group → WebSocket segment (from liveMarketIndices.js + probing). */
export const INDEX_GROUP_STREAM_SEGMENT = {
  'INDICES ELIGIBLE IN DERIVATIVES': 'drdMkt',
  'BROAD MARKET INDICES': 'brdMkt',
  'FIXED INCOME INDICES': 'fixMkt',
  'SECTORAL INDICES': 'secMkt',
  'STRATEGY INDICES': 'strMkt',
  'THEMATIC INDICES': 'thmMkt',
};

export const INDEX_STREAM_SEGMENTS = [...new Set(Object.values(INDEX_GROUP_STREAM_SEGMENT))];

function normalizeIndexLabel(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function indexMatchesStreamItem(item, streamData) {
  if (!item || !streamData) return false;
  const itemKeys = new Set(
    [item.id, item.symbol, item.name].filter(Boolean).map(normalizeIndexLabel),
  );
  const streamKeys = [streamData.indexName, streamData.brdCstIndexName]
    .filter(Boolean)
    .map(normalizeIndexLabel);
  return streamKeys.some((key) => itemKeys.has(key));
}

export function mergeStreamIntoIndex(item, streamData) {
  if (!indexMatchesStreamItem(item, streamData)) return item;
  return {
    ...item,
    value: streamData.currentPrice ?? item.value,
    changePct: streamData.perChange ?? item.changePct,
    change: streamData.change ?? item.change,
    previousClose: streamData.previousClose ?? item.previousClose,
    open: streamData.open || item.open,
    high: streamData.high || item.high,
    low: streamData.low || item.low,
    streamTime: streamData.recievedTime ?? streamData.dessiminationTime ?? null,
  };
}

export function mergePollRowIntoIndex(item, polled) {
  if (!item || !polled) return item;
  if (normalizeIndexLabel(item.id) !== normalizeIndexLabel(polled.id)) return item;
  return {
    ...item,
    ...polled,
    id: item.id,
    symbol: item.symbol ?? polled.symbol,
    name: item.name ?? polled.name,
    group: item.group ?? polled.group,
  };
}

function streamUrlForSegment(segment) {
  return `${NSE_STREAM_BASE}streams/indices/${STREAM_FREQ}/${segment}`;
}

class SegmentSocket {
  constructor(segment) {
    this.segment = segment;
    this.refCount = 0;
    this.listeners = new Set();
    this.ws = null;
    this.open = false;
  }

  addListener(listener) {
    this.listeners.add(listener);
    this.refCount += 1;
    if (this.refCount === 1) this.connect();
    return () => this.removeListener(listener);
  }

  removeListener(listener) {
    if (!this.listeners.has(listener)) return;
    this.listeners.delete(listener);
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount === 0) this.disconnect();
  }

  connect() {
    if (this.ws) return;
    const ws = new WebSocket(streamUrlForSegment(this.segment));
    this.ws = ws;

    ws.onopen = () => {
      this.open = true;
    };

    ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data.mktStatus?.toUpperCase() === 'CLOSE') {
        this.disconnect();
        return;
      }
      for (const listener of this.listeners) {
        listener(data, this.segment);
      }
    };

    ws.onerror = () => {
      this.open = false;
    };

    ws.onclose = () => {
      this.open = false;
      this.ws = null;
    };
  }

  disconnect() {
    if (!this.ws) return;
    this.ws.close();
    this.ws = null;
    this.open = false;
  }
}

const segmentSockets = new Map();

function getSegmentSocket(segment) {
  if (!segmentSockets.has(segment)) {
    segmentSockets.set(segment, new SegmentSocket(segment));
  }
  return segmentSockets.get(segment);
}

/**
 * Subscribe to one or more NSE index stream segments.
 * @param {string[]} segments
 * @param {(data: object, segment: string) => void} onUpdate
 * @returns {() => void} unsubscribe
 */
export function subscribeNseIndexStreams(segments, onUpdate) {
  const uniqueSegments = [...new Set(segments.filter(Boolean))];
  const unsubs = uniqueSegments.map((segment) =>
    getSegmentSocket(segment).addListener(onUpdate),
  );
  return () => {
    for (const unsub of unsubs) unsub();
  };
}

export function segmentForIndexGroup(group) {
  return INDEX_GROUP_STREAM_SEGMENT[group] ?? null;
}
