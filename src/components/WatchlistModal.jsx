import { useState } from 'react';
import { X } from 'lucide-react';
import AppModalOverlay from './AppModalOverlay';
import PortfolioAssetSearchField from './PortfolioAssetSearchField';
import { formatTicker } from '../lib/tickers';
import { resolvePortfolioAsset } from '../lib/portfolioAssetUniverse';

export default function WatchlistModal({ open, onClose, onSave }) {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [tickers, setTickers] = useState([]);

  if (!open) return null;

  const addAsset = async (assetKey) => {
    const asset = assetKey
      ? await resolvePortfolioAsset(assetKey)
      : await resolvePortfolioAsset(symbol.trim());

    if (!asset || tickers.includes(asset.key)) return;

    setTickers((prev) => [...prev, asset.key]);
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
    <AppModalOverlay open={open} onClose={onClose} label="New watchlist">
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
          className="w-full rounded-lg border border-pe-border-strong bg-pe-surface px-3 py-2.5 text-base outline-none focus:border-pe-accent md:text-[15px]"
        />
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <PortfolioAssetSearchField
              value={symbol}
              exclude={tickers}
              placeholder="Search stock, ETF, or fund"
              inputClassName="min-w-0 flex-1 rounded-lg border border-pe-border-strong bg-pe-surface px-3 py-2.5 text-base outline-none focus:border-pe-accent md:text-[15px]"
              onValueChange={setSymbol}
              onSelect={(asset) => addAsset(asset.key)}
            />
          </div>
          <button
            type="button"
            onClick={() => addAsset()}
            className="mt-0.5 shrink-0 self-start rounded-md border border-pe-border-strong px-3 py-2.5 text-sm font-bold text-pe-text"
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
    </AppModalOverlay>
  );
}
