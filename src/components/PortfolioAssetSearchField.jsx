import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AssetLogo from './AssetLogo';
import { MARKET_MIN_SEARCH_CHARS } from '../lib/marketDataApi';
import { searchPortfolioAssets } from '../lib/portfolioAssetUniverse';
import { formatTicker } from '../lib/tickers';

const OPEN_MS = 420;
const CLOSE_MS = 300;
const EASE_OPEN = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_CLOSE = 'cubic-bezier(0.4, 0, 0.2, 1)';

function displaySymbol(asset) {
  if (asset?.kind === 'fund') return asset.name || asset.key;
  return formatTicker(asset.symbol || asset.key);
}

function AssetSuggestionRow({ asset, onSelect }) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(asset)}
      className="w-full border-b border-pe-border px-4 py-3 text-left last:border-b-0 hover:bg-pe-surface"
    >
      <div className="flex items-center gap-2.5">
        <AssetLogo
          logoIconUrl={asset.logoIconUrl}
          assetType={asset.kind}
          assetKey={asset.key}
          name={asset.name || asset.symbol}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-pe-text">
              {displaySymbol(asset)}
            </span>
            <span className="shrink-0 rounded-full bg-pe-surface px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-pe-text-muted">
              {asset.kindLabel}
            </span>
          </div>
          {asset.kind === 'fund' ? null : (
            <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-pe-text-muted">
              {asset.name}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function insetFromRect(rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const top = Math.max(0, rect.top);
  const left = Math.max(0, rect.left);
  const width = Math.max(rect.width, 40);
  const height = Math.max(rect.height, 40);
  return `inset(${top}px ${Math.max(0, vw - left - width)}px ${Math.max(
    0,
    vh - top - height
  )}px ${left}px round 8px)`;
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
  const titleId = useId();
  const triggerRef = useRef(null);
  const sheetInputRef = useRef(null);
  const closeTimerRef = useRef(null);
  const valueAtOpenRef = useRef('');
  const dirtyRef = useRef(false);
  const sheetPhaseRef = useRef('closed');

  const [sheetPhase, setSheetPhase] = useState('closed'); // closed | opening | open | closing
  const [sheetQuery, setSheetQuery] = useState('');
  const [clipPath, setClipPath] = useState('');
  const [sheetRadius, setSheetRadius] = useState('8px');
  const [transition, setTransition] = useState('none');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  sheetPhaseRef.current = sheetPhase;

  const query = sheetQuery.trim();
  const showResults = sheetPhase === 'open' || sheetPhase === 'opening';
  const canSearch = showResults && query.length >= MARKET_MIN_SEARCH_CHARS;
  const displayValue = value || '';
  const isEmpty = !displayValue.trim();

  useEffect(() => {
    if (!canSearch) {
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
  }, [query, canSearch, exclude]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (sheetPhase === 'closed') return undefined;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sheetPhase]);

  // Keep focus on the sheet field so iOS opens the keyboard from the tap gesture.
  useEffect(() => {
    if (sheetPhase !== 'opening' && sheetPhase !== 'open') return undefined;
    sheetInputRef.current?.focus({ preventScroll: true });
    return undefined;
  }, [sheetPhase]);

  const closeSheet = (opts = {}) => {
    const { commit = false } = opts;
    if (sheetPhaseRef.current === 'closed' || sheetPhaseRef.current === 'closing') return;

    sheetInputRef.current?.blur();
    setSheetPhase('closing');

    if (!commit && dirtyRef.current) {
      onValueChange?.(valueAtOpenRef.current);
    }

    const trigger = triggerRef.current;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      setTransition(
        `clip-path ${CLOSE_MS}ms ${EASE_CLOSE}, border-radius ${CLOSE_MS}ms ease`
      );
      setClipPath(insetFromRect(rect));
      setSheetRadius('8px');
    } else {
      setTransition(`opacity ${CLOSE_MS}ms ease`);
    }

    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setSheetPhase('closed');
      setClipPath('');
      setSheetRadius('8px');
      setTransition('none');
      setSheetQuery('');
      setSuggestions([]);
      dirtyRef.current = false;
      onBlur?.();
    }, CLOSE_MS + 20);
  };

  useEffect(() => {
    if (sheetPhase !== 'open' && sheetPhase !== 'opening') return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') closeSheet();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetPhase]);

  const openSheet = () => {
    if (sheetPhase !== 'closed' || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    valueAtOpenRef.current = value;
    dirtyRef.current = false;
    setSheetQuery('');
    setSuggestions([]);
    setClipPath(insetFromRect(rect));
    setSheetRadius('8px');
    setTransition('none');
    setSheetPhase('opening');
    onFocus?.();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransition(
          `clip-path ${OPEN_MS}ms ${EASE_OPEN}, border-radius ${OPEN_MS}ms ${EASE_OPEN}`
        );
        setClipPath('inset(0 0 0 0 round 0px)');
        setSheetRadius('0px');
        sheetInputRef.current?.focus({ preventScroll: true });
        window.setTimeout(() => {
          if (sheetPhaseRef.current === 'opening') setSheetPhase('open');
        }, OPEN_MS);
      });
    });
  };

  const handleSelect = (asset) => {
    dirtyRef.current = false;
    onSelect?.(asset);
    closeSheet({ commit: true });
  };

  const triggerClass =
    inputClassName ||
    'w-full rounded-md border border-pe-border-strong bg-pe-canvas px-2.5 py-2 text-left text-base text-pe-text outline-none';

  const sheetVisible = sheetPhase !== 'closed';

  return (
    <div className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={openSheet}
        aria-label="Ticker"
        aria-haspopup="dialog"
        aria-expanded={sheetVisible}
        className={`text-left ${triggerClass} ${isEmpty ? 'text-pe-text-muted' : ''}`.trim()}
      >
        <span className="block truncate">{isEmpty ? placeholder : displayValue}</span>
      </button>

      {sheetVisible
        ? createPortal(
            <div
              className="fixed inset-0 z-[80]"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              <button
                type="button"
                aria-label="Close search"
                className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${
                  sheetPhase === 'closing' ? 'opacity-0' : 'opacity-100'
                }`}
                onClick={closeSheet}
              />

              <div
                className="absolute inset-0 flex flex-col bg-pe-canvas"
                style={{
                  clipPath: clipPath || undefined,
                  borderRadius: sheetRadius,
                  transition,
                  willChange: 'clip-path',
                }}
              >
                <div
                  id={titleId}
                  className="grid shrink-0 grid-cols-[auto_1fr] items-center gap-2.5 border-b border-pe-border bg-pe-canvas/95 px-4 pb-2.5 pt-[max(0.65rem,env(safe-area-inset-top))] backdrop-blur-md"
                >
                  <button
                    type="button"
                    onClick={closeSheet}
                    className="px-1 py-1.5 text-[15px] font-semibold text-pe-text-secondary"
                  >
                    Cancel
                  </button>
                  <div className="flex min-h-11 items-center rounded-lg border border-pe-border-strong bg-pe-surface px-3 focus-within:border-pe-accent focus-within:ring-1 focus-within:ring-pe-accent">
                    <input
                      ref={sheetInputRef}
                      type="text"
                      inputMode="search"
                      enterKeyHint="search"
                      value={sheetQuery}
                      onChange={(event) => {
                        const next = event.target.value;
                        dirtyRef.current = true;
                        setSheetQuery(next);
                        onValueChange?.(next);
                      }}
                      placeholder={placeholder}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      aria-label="Search ticker"
                      className="w-full min-w-0 border-0 bg-transparent text-base text-pe-text outline-none placeholder:text-pe-text-muted"
                    />
                  </div>
                </div>

                <div
                  className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))] transition-[opacity,transform] ${
                    sheetPhase === 'open'
                      ? 'translate-y-0 opacity-100 duration-300 ease-out'
                      : sheetPhase === 'closing'
                        ? 'translate-y-1.5 opacity-0 duration-150'
                        : 'translate-y-2.5 opacity-0 duration-300'
                  }`}
                >
                  {query.length > 0 && query.length < MARKET_MIN_SEARCH_CHARS ? (
                    <p className="px-4 py-3 text-[12px] text-pe-text-muted">
                      Type at least {MARKET_MIN_SEARCH_CHARS} characters…
                    </p>
                  ) : null}

                  {canSearch ? (
                    loading ? (
                      <p className="px-4 py-3 text-[12px] text-pe-text-muted">Searching…</p>
                    ) : suggestions.length === 0 ? (
                      <p className="px-4 py-3 text-[12px] text-pe-text-muted">No matches found.</p>
                    ) : (
                      suggestions.map((asset) => (
                        <AssetSuggestionRow
                          key={`${asset.kind}-${asset.key}`}
                          asset={asset}
                          onSelect={handleSelect}
                        />
                      ))
                    )
                  ) : null}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
