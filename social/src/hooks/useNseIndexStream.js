import { useEffect, useMemo, useRef, useState } from 'react';
import {
  findPolledIndex,
  mergePollRowsIntoItems,
  subscribeNseIndicesPoll,
} from '../lib/nseIndicesPoll';
import {
  INDEX_STREAM_SEGMENTS,
  mergePollRowIntoIndex,
  mergeStreamIntoIndex,
  segmentForIndexGroup,
  subscribeNseIndexStreams,
} from '../lib/nseIndexStream';

function useItemsRef(items) {
  const ref = useRef(items);
  ref.current = items;
  return ref;
}

function applyStreamPatch(items, data, prevPatches) {
  let changed = false;
  const next = { ...prevPatches };
  for (const item of items) {
    const merged = mergeStreamIntoIndex(item, data);
    if (merged !== item) {
      next[item.id] = merged;
      changed = true;
    }
  }
  return changed ? next : prevPatches;
}

function applyPollPatch(items, rows, prevPatches) {
  const mergedItems = mergePollRowsIntoItems(items, rows);
  let changed = false;
  const next = { ...prevPatches };
  for (let i = 0; i < items.length; i += 1) {
    const merged = mergedItems[i];
    if (merged !== items[i]) {
      next[items[i].id] = merged;
      changed = true;
    }
  }
  return changed ? next : prevPatches;
}

/**
 * Merge NSE WebSocket ticks and REST poll updates into index rows.
 */
export function useNseIndexLiveItems(items, enabled) {
  const itemsRef = useItemsRef(items);
  const [patches, setPatches] = useState({});

  useEffect(() => {
    if (!enabled) {
      setPatches({});
      return undefined;
    }

    const unsubStream = subscribeNseIndexStreams(INDEX_STREAM_SEGMENTS, (data) => {
      setPatches((prev) => applyStreamPatch(itemsRef.current, data, prev));
    });

    const unsubPoll = subscribeNseIndicesPoll((rows) => {
      setPatches((prev) => applyPollPatch(itemsRef.current, rows, prev));
    });

    return () => {
      unsubStream();
      unsubPoll();
    };
  }, [enabled]);

  return useMemo(
    () => items.map((item) => patches[item.id] ?? item),
    [items, patches],
  );
}

/**
 * Stream a single index on its detail page.
 */
export function useNseIndexLiveQuote(index, enabled) {
  const indexRef = useRef(index);
  indexRef.current = index;
  const [liveIndex, setLiveIndex] = useState(index);

  useEffect(() => {
    setLiveIndex(index);
  }, [index]);

  const segment = segmentForIndexGroup(index?.group);

  useEffect(() => {
    if (!enabled || !index) return undefined;

    const unsubStream = segment
      ? subscribeNseIndexStreams([segment], (data) => {
          const current = indexRef.current;
          if (!current) return;
          const merged = mergeStreamIntoIndex(current, data);
          if (merged !== current) setLiveIndex(merged);
        })
      : () => {};

    const unsubPoll = subscribeNseIndicesPoll((rows) => {
      const current = indexRef.current;
      if (!current) return;
      const polled = findPolledIndex(rows, current);
      if (!polled) return;
      const merged = mergePollRowIntoIndex(current, polled);
      if (merged !== current) setLiveIndex(merged);
    });

    return () => {
      unsubStream();
      unsubPoll();
    };
  }, [enabled, index?.id, segment]);

  return liveIndex;
}
