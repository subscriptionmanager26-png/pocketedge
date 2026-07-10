import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { formatTicker } from '../lib/tickers';
import { MARKET_MIN_SEARCH_CHARS } from '../lib/marketDataApi';
import { resolvePortfolioAsset, searchPortfolioAssets } from '../lib/portfolioAssetUniverse';

export default function WatchlistModal({ open, onClose, onSave }) {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [tickers, setTickers] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) {
      setSuggestions([]);
      setSearching(false);
      return undefined;
    }

    const query = symbol.trim();
    if (query.length < MARKET_MIN_SEARCH_CHARS) {
      setSuggestions([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchPortfolioAssets(query, { exclude: tickers, limit: 6 })
        .then((items) => {
          if (!cancelled) setSuggestions(items);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, symbol, tickers]);

  if (!open) return null;

  const addAsset = async (assetKey) => {
    const asset = assetKey
      ? suggestions.find((entry) => entry.key === assetKey) ?? (await resolvePortfolioAsset(assetKey))
      : await resolvePortfolioAsset(symbol.trim());

    if (!asset || tickers.includes(asset.key)) return;

    setTickers((prev) => [...prev, asset.key]);
    setSymbol('');
    setSuggestions([]);
  };

  const save = () => {
    if (!name.trim()) return;
    onSave?.({ name: name.trim(), tickers });
    setName('');
    setSymbol('');
    setTickers([]);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl border border-pe-border bg-pe-canvas sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-pe-border px-4 py-3.5">
          <button type="button" onClick={onClose} className="rounded-md p-1 text-pe-text-secondary hover:bg-pe-surface">
            <X className="h-5 w-5" />
          </button>
          <span className="text-[15px] font-semibold text-pe-text">New watchlist</span>
          <button
            type="button"
            onClick={save}
            disabled={!name.trim()}
            className="rounded-md bg-pe-accent px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40"
          >
            Save
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="List name"
            className="w-full rounded-lg border border-pe-border-strong bg-pe-surface px-3 py-2.5 text-[15px] outline-none focus:border-pe-accent"
          />
          <div className="relative">
            <div className="flex gap-2">
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAsset();
                  }
                }}
                placeholder="Search stock, ETF, or fund"
                className="min-w-0 flex-1 rounded-lg border border-pe-border-strong bg-pe-surface px-3 py-2.5 text-[15px] outline-none focus:border-pe-accent"
              />
              <button
                type="button"
                onClick={() => addAsset()}
                className="shrink-0 rounded-md border border-pe-border-strong px-3 py-2 text-sm font-bold text-pe-text"
              >
                Add
              </button>
            </div>
            {searching ? (
              <p className="mt-2 text-xs text-pe-text-muted">Searching…</p>
            ) : null}
            {suggestions.length > 0 ? (
              <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-pe-border-strong bg-pe-canvas shadow-lg">
                {suggestions.map((asset) => (
                  <button
                    key={`${asset.kind}-${asset.key}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addAsset(asset.key)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-pe-surface"
                  >
                    <span className="min-w-0">
                      <span className="text-sm font-semibold text-pe-text">
                        {asset.kind === 'fund' ? asset.key : formatTicker(asset.key)}
                      </span>
                      <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-pe-text-muted">
                        {asset.kindLabel}
                      </span>
                    </span>
                    <span className="truncate text-xs text-pe-text-muted">{asset.name}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {tickers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tickers.map((t) => (
                <span key={t} className="rounded-full bg-pe-accent-wash px-2.5 py-1 text-xs font-semibold text-pe-accent">
                  {formatTicker(t)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
