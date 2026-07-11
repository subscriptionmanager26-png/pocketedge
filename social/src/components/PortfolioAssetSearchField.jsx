import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MARKET_MIN_SEARCH_CHARS } from '../lib/marketDataApi';
import { searchPortfolioAssets } from '../lib/portfolioAssetUniverse';
import { formatTicker } from '../lib/tickers';

function displaySymbol(asset) {
  return asset?.kind === 'fund' ? asset.key : formatTicker(asset.key);
}

function AssetSuggestionRow({ asset, onSelect }) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(asset)}
      className="w-full border-b border-pe-border px-3 py-2.5 text-left last:border-b-0 hover:bg-pe-surface"
    >
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-semibold text-pe-text">{displaySymbol(asset)}</span>
        <span className="rounded-full bg-pe-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pe-text-muted">
          {asset.kindLabel}
        </span>
      </div>
      <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-pe-text-muted">{asset.name}</p>
    </button>
  );
}

export default function PortfolioAssetSearchField({
  value,
  exclude = [],
  placeholder = 'Search stock, ETF, or fund',
  onValueChange,
  onSelect,
  onFocus,
  onBlur,
  inputClassName = '',
}) {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);

  const query = value.trim();
  const showResults = open && query.length >= MARKET_MIN_SEARCH_CHARS;

  useEffect(() => {
    if (!showResults) {
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(() => {
      searchPortfolioAssets(query, { exclude, limit: 8 })
        .then((items) => {
          if (!cancelled) setSuggestions(items);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, showResults, exclude]);

  useEffect(() => {
    if (!showResults || !anchorRef.current) {
      setMenuStyle(null);
      return undefined;
    }

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 320), window.innerWidth - 32);
      const left = Math.min(rect.left, window.innerWidth - width - 16);
      setMenuStyle({
        top: rect.bottom + 4,
        left: Math.max(16, left),
        width,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [showResults, query]);

  const handleSelect = (asset) => {
    onSelect?.(asset);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={anchorRef} className="relative min-w-0">
      <input
        type="text"
        value={value}
        onChange={(event) => {
          onValueChange?.(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          onFocus?.();
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
            onBlur?.();
          }, 120);
        }}
        placeholder={placeholder}
        autoComplete="off"
        aria-label="Ticker"
        className={inputClassName}
      />

      {showResults && menuStyle
        ? createPortal(
            <div
              style={menuStyle}
              className="fixed z-[70] max-h-64 overflow-y-auto rounded-md border border-pe-border-strong bg-pe-canvas shadow-lg"
            >
              {loading ? (
                <p className="px-2.5 py-2 text-[12px] text-pe-text-muted">Searching…</p>
              ) : suggestions.length === 0 ? (
                <p className="px-2.5 py-2 text-[12px] text-pe-text-muted">No matches found.</p>
              ) : (
                suggestions.map((asset) => (
                  <AssetSuggestionRow key={`${asset.kind}-${asset.key}`} asset={asset} onSelect={handleSelect} />
                ))
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
