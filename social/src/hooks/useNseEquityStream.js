import { useEffect, useMemo, useRef, useState } from 'react';
import {
  findPolledEquity,
  mergePollRowsIntoEquityItems,
  subscribeNseStocksPoll,
} from '../lib/nseStocksPoll';
import {
  EQUITY_STREAM_SEGMENT,
  ETF_STREAM_SEGMENT,
  equityItemSymbol,
  mergePollRowIntoEquity,
  mergeStreamIntoEquity,
  segmentForEquityTab,
  subscribeNseEquityStream,
} from '../lib/nseEquityStream';

function useItemsRef(items) {
  const ref = useRef(items);
  ref.current = items;
  return ref;
}

function applyStreamPatch(items, data, prevPatches) {
  let changed = false;
  const next = { ...prevPatches };
  for (const item of items) {
    const merged = mergeStreamIntoEquity(item, data);
    if (merged !== item) {
      next[item.id ?? item.symbol] = merged;
      changed = true;
    }
  }
  return changed ? next : prevPatches;
}

function applyPollPatch(items, rows, prevPatches) {
  const mergedItems = mergePollRowsIntoEquityItems(items, rows);
  let changed = false;
  const next = { ...prevPatches };
  for (let i = 0; i < items.length; i += 1) {
    const merged = mergedItems[i];
    if (merged !== items[i]) {
      next[items[i].id ?? items[i].symbol] = merged;
      changed = true;
    }
  }
  return changed ? next : prevPatches;
}

export function useNseEquityLiveItems(items, tab, enabled) {
  const itemsRef = useItemsRef(items);
  const [patches, setPatches] = useState({});
  const segment = segmentForEquityTab(tab);
  const itemKey = useMemo(
    () => items.map((item) => item.id ?? item.symbol).join(','),
    [items]
  );

  useEffect(() => {
    setPatches({});
  }, [itemKey, segment]);

  useEffect(() => {
    if (!enabled || !segment) {
      setPatches({});
      return undefined;
    }

    const unsubStream = subscribeNseEquityStream(segment, (data) => {
      setPatches((prev) => applyStreamPatch(itemsRef.current, data, prev));
    });

    const unsubPoll = subscribeNseStocksPoll((rows) => {
      setPatches((prev) => applyPollPatch(itemsRef.current, rows, prev));
    });

    return () => {
      unsubStream();
      unsubPoll();
    };
  }, [enabled, segment]);

  return useMemo(
    () => items.map((item) => patches[item.id ?? item.symbol] ?? item),
    [items, patches],
  );
}

export function useNseEquityLiveQuote(item, enabled, { isEtf = false } = {}) {
  const itemRef = useRef(item);
  itemRef.current = item;
  const [liveItem, setLiveItem] = useState(item);
  const segment = isEtf ? ETF_STREAM_SEGMENT : EQUITY_STREAM_SEGMENT;

  useEffect(() => {
    setLiveItem(item);
  }, [item]);

  useEffect(() => {
    if (!enabled || !item?.symbol) return undefined;

    const unsubStream = subscribeNseEquityStream(segment, (data) => {
      const current = itemRef.current;
      if (!current) return;
      const merged = mergeStreamIntoEquity(current, data);
      if (merged !== current) setLiveItem(merged);
    });

    const unsubPoll = subscribeNseStocksPoll((rows) => {
      const current = itemRef.current;
      if (!current) return;
      const polled = findPolledEquity(rows, current);
      if (!polled) return;
      const merged = mergePollRowIntoEquity(current, polled);
      if (merged !== current) setLiveItem(merged);
    });

    return () => {
      unsubStream();
      unsubPoll();
    };
  }, [enabled, equityItemSymbol(item), segment]);

  return liveItem;
}
