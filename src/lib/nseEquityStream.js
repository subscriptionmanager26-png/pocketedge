const NSE_STREAM_BASE = 'wss://streamer.nseindia.com/';
const STREAM_FREQ = 'high';
const FLUSH_MS = 250;

/** NSE live-equity-market stream segments (from market watch config). */
export const EQUITY_STREAM_SEGMENT = 'EQUITY-SME-MARKET';
export const ETF_STREAM_SEGMENT = 'EXCHANGE-TRADED-FUNDS';

function normalizeSymbol(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9&-]/g, '');
}

export function equityItemSymbol(item) {
  return item?.symbol ?? item?.ticker ?? item?.id ?? null;
}

export function equityMatchesStreamItem(item, streamData) {
  const itemSymbol = equityItemSymbol(item);
  if (!itemSymbol || !streamData?.symbol) return false;
  return normalizeSymbol(itemSymbol) === normalizeSymbol(streamData.symbol);
}

export function mergeStreamIntoEquity(item, streamData) {
  if (!equityMatchesStreamItem(item, streamData)) return item;
  return {
    ...item,
    price: streamData.ltp != null ? Number(streamData.ltp) : item.price,
    ltp: streamData.ltp != null ? Number(streamData.ltp) : item.ltp,
    changePct: streamData.pchange != null ? Number(streamData.pchange) : item.changePct,
    change: streamData.change != null ? Number(streamData.change) : item.change,
  };
}

export function mergePollRowIntoEquity(item, polled) {
  const itemSymbol = equityItemSymbol(item);
  if (!itemSymbol || !polled?.symbol) return item;
  if (normalizeSymbol(itemSymbol) !== normalizeSymbol(polled.symbol)) return item;
  return {
    ...item,
    price: polled.price ?? item.price,
    ltp: polled.price ?? item.ltp,
    changePct: polled.changePct ?? item.changePct,
    previousClose: polled.previousClose ?? item.previousClose,
    segment: polled.segment ?? item.segment,
  };
}

function streamUrlForSegment(segment) {
  return `${NSE_STREAM_BASE}streams/indices/${STREAM_FREQ}/${encodeURIComponent(segment)}`;
}

class EquitySegmentSocket {
  constructor(segment) {
    this.segment = segment;
    this.refCount = 0;
    this.listeners = new Set();
    this.ws = null;
    this.queue = [];
    this.flushTimer = null;
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

  scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (!this.queue.length) return;
      const batch = this.queue;
      this.queue = [];
      for (const data of batch) {
        for (const listener of this.listeners) {
          listener(data, this.segment);
        }
      }
    }, FLUSH_MS);
  }

  connect() {
    if (this.ws) return;
    const ws = new WebSocket(streamUrlForSegment(this.segment));
    this.ws = ws;

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
      if (!data.symbol) return;
      this.queue.push(data);
      this.scheduleFlush();
    };

    ws.onclose = () => {
      this.ws = null;
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }
    };
  }

  disconnect() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.queue = [];
    if (!this.ws) return;
    this.ws.close();
    this.ws = null;
  }
}

const segmentSockets = new Map();

function getSegmentSocket(segment) {
  if (!segmentSockets.has(segment)) {
    segmentSockets.set(segment, new EquitySegmentSocket(segment));
  }
  return segmentSockets.get(segment);
}

export function subscribeNseEquityStream(segment, onUpdate) {
  return getSegmentSocket(segment).addListener(onUpdate);
}

export function segmentForEquityTab(tab) {
  if (tab === 'etf') return ETF_STREAM_SEGMENT;
  if (tab === 'stocks') return EQUITY_STREAM_SEGMENT;
  return null;
}
