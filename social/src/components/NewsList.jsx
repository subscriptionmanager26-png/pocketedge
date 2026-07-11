import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { formatNewsDate } from '../lib/format';
import { formatTicker } from '../lib/tickers';
import NewsSummaryMarkdown from './NewsSummaryMarkdown';

function newsItemDate(item) {
  return formatNewsDate(item.publishedAt) || item.time || '';
}

function NewsSummarySheet({ item, onClose }) {
  const date = newsItemDate(item);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border border-pe-border bg-pe-canvas"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-pe-border bg-pe-canvas px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold leading-snug text-pe-text">{item.title}</p>
            {date ? <p className="mt-1 text-sm text-pe-text-muted">{date}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-pe-text-secondary hover:bg-pe-surface"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 py-4">
          <NewsSummaryMarkdown content={item.summary} />
        </div>
      </div>
    </div>
  );
}

export default function NewsList({ items, showTicker = false }) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [expandedId, setExpandedId] = useState(null);
  const [mobileItem, setMobileItem] = useState(null);

  return (
    <>
      <div className="divide-y divide-pe-border">
        {items.map((item) => {
          const expanded = isDesktop && expandedId === item.id;
          const date = newsItemDate(item);
          const hasSummary = Boolean(item.summary?.trim());

          return (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => {
                  if (isDesktop) {
                    setExpandedId((current) => (current === item.id ? null : item.id));
                    return;
                  }
                  setMobileItem(item);
                }}
                className="w-full px-4 py-4 text-left transition hover:bg-pe-surface"
              >
                {showTicker && item.ticker ? (
                  <p className="text-xs font-semibold text-pe-text-secondary">{formatTicker(item.ticker)}</p>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[15px] font-semibold leading-snug text-pe-text">{item.title}</p>
                  {isDesktop ? (
                    <ChevronDown
                      className={`mt-0.5 h-4 w-4 shrink-0 text-pe-text-muted transition-transform ${
                        expanded ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
                {date ? <p className="mt-1 text-sm text-pe-text-muted">{date}</p> : null}
                {!isDesktop && hasSummary ? (
                  <p className="mt-1 text-xs text-pe-text-muted">Tap to read summary</p>
                ) : null}
              </button>
              {isDesktop && expanded ? (
                <div className="border-t border-pe-border bg-pe-surface/40 px-4 pb-4 pt-3">
                  <NewsSummaryMarkdown content={item.summary} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {!isDesktop && mobileItem ? (
        <NewsSummarySheet item={mobileItem} onClose={() => setMobileItem(null)} />
      ) : null}
    </>
  );
}
