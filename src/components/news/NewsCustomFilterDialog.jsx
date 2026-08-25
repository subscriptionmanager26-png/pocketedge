import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import NewsCustomFilters from './NewsCustomFilters';

function hasDraftFilters(draft) {
  if (!draft) return false;
  if (draft.customDim === 'company') return (draft.companies ?? []).length > 0;
  if (draft.customDim === 'type') return (draft.types ?? []).length > 0;
  if (draft.customDim === 'industry') return (draft.industries ?? []).length > 0;
  return false;
}

function emptyDraft() {
  return {
    customDim: 'company',
    companies: [],
    companyLabels: {},
    types: [],
    industries: [],
  };
}

/**
 * Modal / sheet for News custom filters — opens on first Custom visit or via Edit.
 */
export default function NewsCustomFilterDialog({
  open,
  onClose,
  onApply,
  customDim = 'company',
  companies = [],
  companyLabels = {},
  types = [],
  typeOptions = [],
  industries = [],
  industryOptions = [],
}) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [draft, setDraft] = useState(emptyDraft);

  useEffect(() => {
    if (!open) return;
    setDraft({
      customDim: customDim || 'company',
      companies: [...companies],
      companyLabels: { ...companyLabels },
      types: [...types],
      industries: [...industries],
    });
  }, [open, customDim, companies, companyLabels, types, industries]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const canApply = hasDraftFilters(draft);

  const apply = () => {
    if (!canApply) return;
    onApply?.(draft);
    onClose?.();
  };

  const body = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
        <NewsCustomFilters
          embedded
          customDim={draft.customDim}
          onCustomDimChange={(dim) =>
            setDraft((prev) => ({
              ...prev,
              customDim: dim,
              companies: [],
              companyLabels: {},
              types: [],
              industries: [],
            }))
          }
          companies={draft.companies}
          companyLabels={draft.companyLabels}
          onCompaniesChange={(keys, labels) =>
            setDraft((prev) => ({
              ...prev,
              companies: keys,
              companyLabels: labels ?? prev.companyLabels,
            }))
          }
          types={draft.types}
          typeOptions={typeOptions}
          onTypesChange={(next) => setDraft((prev) => ({ ...prev, types: next }))}
          industries={draft.industries}
          industryOptions={industryOptions}
          onIndustriesChange={(next) => setDraft((prev) => ({ ...prev, industries: next }))}
        />
      </div>
      <div className="shrink-0 border-t border-pe-border px-4 py-3 md:px-5">
        <button
          type="button"
          onClick={apply}
          disabled={!canApply}
          className="w-full rounded-xl bg-pe-accent py-2.5 text-sm font-bold text-white hover:bg-pe-accent-pressed disabled:cursor-not-allowed disabled:opacity-40"
        >
          Show results
        </button>
      </div>
    </div>
  );

  if (isDesktop) {
    return createPortal(
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <div
          className="flex max-h-[min(85vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-pe-border bg-pe-canvas shadow-[0_12px_36px_rgba(0,0,0,0.12)]"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Custom news filters"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-pe-border px-4 py-3.5 md:px-5">
            <p className="text-[15px] font-semibold text-pe-text">Filter news</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-pe-text-muted hover:bg-pe-surface"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {body}
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl border border-pe-border bg-pe-canvas shadow-[0_12px_36px_rgba(0,0,0,0.12)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Custom news filters"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-pe-border px-4 py-3.5">
          <p className="text-[15px] font-semibold text-pe-text">Filter news</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-pe-text-muted hover:bg-pe-surface"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {body}
      </div>
    </div>,
    document.body
  );
}
