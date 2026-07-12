import { ExternalLink } from 'lucide-react';
import { formatTicker } from '../lib/tickers';

export default function CorporateActionsList({ items, showTicker = false, onSelectStock }) {
  if (!items?.length) {
    return (
      <p className="px-6 py-14 text-center text-sm text-pe-text-secondary">
        No corporate actions found.
      </p>
    );
  }

  return (
    <div className="divide-y divide-pe-border">
      {items.map((item) => {
        const tickerLabel = formatTicker(item.ticker);
        const title = item.details?.trim() || item.eventType;
        const content = (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {showTicker ? (
                <p className="text-xs font-semibold text-pe-text-secondary">{tickerLabel}</p>
              ) : null}
              <p
                className={`text-[15px] font-semibold leading-snug text-pe-text ${
                  showTicker ? 'mt-0.5' : ''
                }`}
              >
                {title}
              </p>
              {item.displayDate ? (
                <p className="mt-1 text-sm text-pe-text-muted">
                  {item.dateLabel ? `${item.dateLabel}: ` : ''}
                  {item.displayDate}
                </p>
              ) : null}
            </div>
            {item.documentUrl ? (
              <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-pe-text-muted" aria-hidden="true" />
            ) : null}
          </div>
        );

        if (item.documentUrl) {
          return (
            <a
              key={item.id}
              href={item.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-4 transition hover:bg-pe-surface"
            >
              {content}
            </a>
          );
        }

        if (showTicker && onSelectStock) {
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectStock(item.ticker)}
              className="block w-full px-4 py-4 text-left transition hover:bg-pe-surface"
            >
              {content}
            </button>
          );
        }

        return (
          <div key={item.id} className="px-4 py-4">
            {content}
          </div>
        );
      })}
    </div>
  );
}
