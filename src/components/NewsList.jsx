import { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { formatNewsDate } from '../lib/format';
import { formatTicker } from '../lib/tickers';

const NewsSummaryMarkdown = lazy(() => import('./NewsSummaryMarkdown'));

function newsItemDate(item) {
  return formatNewsDate(item.publishedAt) || item.time || '';
}

function MarkdownFallback() {
  return <p className="text-sm text-pe-text-muted">Loading summary…</p>;
}

/**
 * Full-viewport news sheet via portal so the dim overlay covers Shell chrome
 * (top search + right rail) and sits above the mobile bottom nav.
 */
export function NewsSummarySheet({ item, onClose }) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const date = newsItemDate(item);

  useEffect(() => {
    if (!item) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [item, onClose]);

  if (!item || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex justify-center bg-black/40 ${
        isDesktop
          ? 'items-center p-4'
          : 'items-end pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]'
      }`}
      onClick={onClose}
    >
      <div
        className={`w-full overflow-y-auto border border-pe-border bg-pe-canvas shadow-[0_12px_36px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.06)] ${
          isDesktop
            ? 'max-h-[min(85vh,720px)] max-w-lg rounded-2xl'
            : 'max-h-[min(85dvh,calc(100dvh-3.5rem-env(safe-area-inset-bottom,0px)-0.5rem))] rounded-t-2xl'
        }`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
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
          <Suspense fallback={<MarkdownFallback />}>
            <NewsSummaryMarkdown content={item.summary} />
          </Suspense>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function NewsList({ items, showTicker = false }) {
  const [openItem, setOpenItem] = useState(null);

  return (
    <>
      <div className="divide-y divide-pe-border">
        {items.map((item) => {
          const date = newsItemDate(item);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setOpenItem(item)}
              className="w-full px-4 py-4 text-left transition hover:bg-pe-surface"
            >
              {showTicker && item.ticker ? (
                <p className="text-xs font-semibold text-pe-text-secondary">{formatTicker(item.ticker)}</p>
              ) : null}
              <p className="text-[15px] font-semibold leading-snug text-pe-text">{item.title}</p>
              {date ? <p className="mt-1 text-sm text-pe-text-muted">{date}</p> : null}
            </button>
          );
        })}
      </div>

      {openItem ? (
        <NewsSummarySheet item={openItem} onClose={() => setOpenItem(null)} />
      ) : null}
    </>
  );
}
