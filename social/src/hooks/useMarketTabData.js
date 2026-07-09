import { useEffect, useState } from 'react';
import { fetchMarketTab } from '../lib/marketDataApi';

export function useMarketTabData(tab) {
  const [items, setItems] = useState([]);
  const [syncedAt, setSyncedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchMarketTab(tab)
      .then((payload) => {
        if (cancelled) return;
        setItems(payload.items ?? []);
        setSyncedAt(payload.syncedAt ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load market data');
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab]);

  return { items, syncedAt, loading, error };
}
