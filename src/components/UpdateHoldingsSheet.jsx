import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  X,
} from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { parseZerodhaHoldingsWorkbook } from '../pages/onboarding/zerodhaHoldingsWorkbook';
import { parseZerodhaHoldingsScreenshots } from '../pages/onboarding/onboardingHoldings';
import { holdingDisplayLabel } from '../lib/portfolioAssetUniverse';
import { previewPortfolioImportMerge } from '../lib/portfolioImportMerge';

/**
 * Full-viewport sheet: pick Excel/screenshots (PDF soon) → review merge → confirm.
 */
export default function UpdateHoldingsSheet({
  open,
  currentRows,
  makeRowId,
  onClose,
  onApply,
}) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const excelRef = useRef(null);
  const shotRef = useRef(null);
  const [phase, setPhase] = useState('pick'); // pick | reading | review
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const [preview, setPreview] = useState(null);
  const [removeStaleIds, setRemoveStaleIds] = useState(() => new Set());

  useEffect(() => {
    if (!open) return undefined;
    setPhase('pick');
    setError('');
    setProgress(null);
    setPreview(null);
    setRemoveStaleIds(new Set());
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
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const runPreview = async (importedRows, sourceLabel) => {
    const result = await previewPortfolioImportMerge({
      currentRows,
      importedRows,
      makeRowId,
    });
    if (!result.reviewRows.length && !result.staleRows.length && !importedRows.length) {
      setError(`No usable holdings were found in the ${sourceLabel}.`);
      setPhase('pick');
      return;
    }
    setPreview({ ...result, sourceLabel });
    setRemoveStaleIds(new Set());
    setPhase('review');
  };

  const importExcel = async (file) => {
    if (!file) return;
    setError('');
    setPhase('reading');
    setProgress({ percent: 12, label: 'Reading Excel file…', fileName: file.name || '' });
    try {
      const rows = await parseZerodhaHoldingsWorkbook(file);
      setProgress({ percent: 70, label: 'Matching holdings…', fileName: file.name || '' });
      await runPreview(rows, 'Zerodha Excel file');
    } catch (err) {
      setError(err?.message ?? 'Could not read that Zerodha Excel file.');
      setPhase('pick');
    } finally {
      setProgress(null);
      if (excelRef.current) excelRef.current.value = '';
    }
  };

  const importShots = async (files) => {
    const images = [...(files ?? [])];
    if (!images.length) return;
    setError('');
    setPhase('reading');
    setProgress({
      percent: 0,
      label: `Reading screenshot 1 of ${images.length}…`,
      fileName: images[0]?.name || '',
    });
    try {
      const rows = await parseZerodhaHoldingsScreenshots(images, {
        onProgress: (next) => {
          if (typeof next === 'number') {
            setProgress((prev) => ({
              ...(prev ?? {}),
              percent: Math.min(84, Math.round(next * 0.85)),
              label: prev?.label ?? 'Reading screenshots…',
            }));
            return;
          }
          const current = next.current ?? 1;
          const total = next.total ?? images.length;
          setProgress({
            percent: Math.min(84, Math.round((next.percent ?? 0) * 0.85)),
            label: `Reading screenshot ${current} of ${total}…`,
            fileName: next.fileName ?? '',
          });
        },
      });
      setProgress({ percent: 90, label: 'Matching holdings…', fileName: '' });
      await runPreview(rows, 'holdings screenshot');
    } catch (err) {
      setError(err?.message ?? 'Could not read those holdings screenshots.');
      setPhase('pick');
    } finally {
      setProgress(null);
      if (shotRef.current) shotRef.current.value = '';
    }
  };

  const toggleStale = (id) => {
    setRemoveStaleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirm = () => {
    if (!preview) return;
    const keepStale = preview.staleRows.filter((row) => !removeStaleIds.has(row.id));
    const withoutRemoved = preview.merged.filter(
      (row) => !row.missingFromImport || !removeStaleIds.has(row.id)
    );
    // Stale kept rows stay flagged for amber review in the edit grid.
    const finalRows = withoutRemoved.map((row) =>
      row.missingFromImport && keepStale.some((s) => s.id === row.id)
        ? { ...row, missingFromImport: true }
        : { ...row, missingFromImport: false }
    );
    onApply?.(finalRows, {
      sourceLabel: preview.sourceLabel,
      removedStaleCount: removeStaleIds.size,
      unmappedCount: preview.unmappedCount,
    });
    onClose?.();
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex justify-center bg-black/40 ${
        isDesktop ? 'items-center p-4' : 'items-end'
      }`}
      onClick={onClose}
    >
      <div
        className={`flex w-full flex-col overflow-hidden border border-pe-border bg-pe-canvas shadow-[0_12px_36px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.06)] ${
          isDesktop
            ? 'max-h-[min(90vh,760px)] max-w-lg rounded-2xl'
            : 'max-h-[92dvh] rounded-t-2xl'
        }`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Update holdings"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-pe-border px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-pe-text">Update holdings</p>
            <p className="mt-0.5 text-sm text-pe-text-muted">
              Merge broker exports into My Portfolio
            </p>
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
          {phase === 'pick' ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-pe-text-secondary">
                Bring Zerodha Excel or Kite / Groww screenshots into this book. Matching
                holdings update; symbols missing from the file are reviewed next.
              </p>
              {error ? <p className="text-sm text-pe-negative">{error}</p> : null}

              <SourceCard
                icon={<FileSpreadsheet className="h-5 w-5 text-pe-accent" />}
                title="Excel (Zerodha)"
                description="Equity + Mutual Funds sheets from a Zerodha holdings statement."
                badge="Recommended"
                onClick={() => excelRef.current?.click()}
              />
              <SourceCard
                icon={<Camera className="h-5 w-5 text-pe-accent" />}
                title="Screenshots (Kite / Groww)"
                description="Upload one or more clear holdings screens. Parsed on your device."
                onClick={() => shotRef.current?.click()}
              />
              <SourceCard
                icon={<FileText className="h-5 w-5 text-pe-text-muted" />}
                title="PDF statement"
                description="Broker PDF holdings import is coming soon. Use Excel or screenshots today."
                badge="Coming soon"
                disabled
              />

              <input
                ref={excelRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(event) => void importExcel(event.target.files?.[0])}
              />
              <input
                ref={shotRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/*"
                multiple
                className="hidden"
                onChange={(event) => void importShots(event.target.files)}
              />
            </div>
          ) : null}

          {phase === 'reading' ? (
            <div role="status" aria-live="polite">
              <div className="flex items-center gap-2 text-pe-text">
                <RefreshCw className="h-4 w-4 animate-spin text-pe-accent" />
                <p className="text-sm font-semibold">{progress?.label ?? 'Reading…'}</p>
              </div>
              {progress?.fileName ? (
                <p className="mt-1 truncate text-[12px] text-pe-text-muted">{progress.fileName}</p>
              ) : null}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-pe-surface">
                <div
                  className="h-full rounded-full bg-pe-accent transition-all"
                  style={{ width: `${Math.max(2, progress?.percent ?? 0)}%` }}
                />
              </div>
            </div>
          ) : null}

          {phase === 'review' && preview ? (
            <div className="space-y-5">
              <p className="text-sm text-pe-text-secondary">
                Review from {preview.sourceLabel}. Confirm to merge into your edit grid.
              </p>

              {preview.reviewRows.length ? (
                <section>
                  <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                    From import ({preview.reviewRows.length})
                  </p>
                  <ul className="mt-2 divide-y divide-pe-border rounded-lg border border-pe-border">
                    {preview.reviewRows.map((row) => (
                      <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-pe-text">
                            {holdingDisplayLabel(row) || row.ticker}
                          </p>
                          <p className="text-[12px] text-pe-text-muted">
                            Qty {row.qty || '—'} · Invested {row.invested || '—'}
                          </p>
                        </div>
                        <StatusPill status={row.matchStatus} />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {preview.staleRows.length ? (
                <section>
                  <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
                    Not in this file ({preview.staleRows.length})
                  </p>
                  <p className="mt-1 text-[12px] text-pe-text-secondary">
                    Keep them in My Portfolio, or remove selected ones from this update.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setRemoveStaleIds(new Set())}
                      className="rounded-full border border-pe-border px-2.5 py-1 text-[12px] font-semibold text-pe-text-secondary hover:bg-pe-surface"
                    >
                      Keep all
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRemoveStaleIds(new Set(preview.staleRows.map((r) => r.id)))
                      }
                      className="rounded-full border border-pe-border px-2.5 py-1 text-[12px] font-semibold text-pe-text-secondary hover:bg-pe-surface"
                    >
                      Remove all
                    </button>
                  </div>
                  <ul className="mt-2 divide-y divide-pe-border rounded-lg border border-amber-200 bg-amber-50/40">
                    {preview.staleRows.map((row) => {
                      const remove = removeStaleIds.has(row.id);
                      return (
                        <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-pe-text">
                              {holdingDisplayLabel(row) || row.ticker}
                            </p>
                            <p className="text-[12px] text-amber-800">Symbol not found in file</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleStale(row.id)}
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                              remove
                                ? 'bg-pe-negative/10 text-pe-negative'
                                : 'bg-white text-pe-text-secondary'
                            }`}
                          >
                            {remove ? 'Removing' : 'Keep'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setPhase('pick');
                  }}
                  className="flex-1 rounded-lg border border-pe-border py-2.5 text-sm font-semibold text-pe-text-secondary hover:bg-pe-surface"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  className="flex-1 rounded-lg bg-pe-accent py-2.5 text-sm font-bold text-white hover:bg-pe-accent-pressed"
                >
                  Apply to portfolio
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

function SourceCard({ icon, title, description, badge, onClick, disabled = false }) {
  const Comp = disabled || !onClick ? 'div' : 'button';
  return (
    <Comp
      type={Comp === 'button' ? 'button' : undefined}
      onClick={disabled ? undefined : onClick}
      disabled={disabled || undefined}
      className={`flex w-full items-start gap-3 rounded-xl border border-pe-border bg-white px-3.5 py-3.5 text-left ${
        disabled
          ? 'opacity-60'
          : 'transition hover:border-pe-accent hover:bg-pe-accent-wash/40'
      }`}
    >
      <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pe-surface">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-semibold text-pe-text">{title}</p>
          {badge ? (
            <span className="rounded-md border border-pe-accent-border bg-pe-accent-wash px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-pe-accent">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-pe-text-muted">{description}</p>
      </div>
    </Comp>
  );
}

function StatusPill({ status }) {
  const label =
    status === 'new' ? 'New' : status === 'updated' ? 'Updated' : 'Unchanged';
  const className =
    status === 'new'
      ? 'bg-pe-accent-wash text-pe-accent'
      : status === 'updated'
        ? 'bg-black/[0.06] text-pe-text'
        : 'bg-pe-surface text-pe-text-muted';
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${className}`}>
      {label}
    </span>
  );
}
