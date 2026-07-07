import { useState } from 'react';
import { X } from 'lucide-react';
import { STOCKS } from '../data/mockData';
import { formatTicker } from '../lib/tickers';

export default function WatchlistModal({ open, onClose, onSave }) {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [tickers, setTickers] = useState([]);

  if (!open) return null;

  const addSymbol = () => {
    const t = symbol.trim().toUpperCase();
    if (!t || !STOCKS[t] || tickers.includes(t)) return;
    setTickers((prev) => [...prev, t]);
    setSymbol('');
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
          <div className="flex gap-2">
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSymbol())}
              placeholder="Add symbol (e.g. TCS)"
              className="min-w-0 flex-1 rounded-lg border border-pe-border-strong bg-pe-surface px-3 py-2.5 text-[15px] outline-none focus:border-pe-accent"
            />
            <button
              type="button"
              onClick={addSymbol}
              className="shrink-0 rounded-md border border-pe-border-strong px-3 py-2 text-sm font-bold text-pe-text"
            >
              Add
            </button>
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
