import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  mergeHoldingsToEditRows,
  parseZerodhaHoldingsScreenshots,
} from '../pages/onboarding/onboardingHoldings';
import { holdingDisplayLabel } from '../lib/portfolioAssetUniverse';
import { previewPortfolioImportMerge } from '../lib/portfolioImportMerge';

/**
 * Full-viewport sheet: pick Excel / screenshots / statement PDF → review merge → confirm.
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
  const pdfRef = useRef(null);
  const pendingPdfRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const [phase, setPhase] = useState('pick'); // pick | reading | password | review
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const [preview, setPreview] = useState(null);
  const [removeStaleIds, setRemoveStaleIds] = useState(() => new Set());
  const [confirming, setConfirming] = useState(false);

  onCloseRef.current = onClose;

  // Reset only when the sheet newly opens — not when parent re-renders
  // (inline onClose previously wiped review state when switching browser tabs).
  useEffect(() => {
    if (!open) return undefined;
    setPhase('pick');
    setError('');
    setProgress(null);
    setPreview(null);
    setRemoveStaleIds(new Set());
    setPdfPassword('');
    setShowUnchanged(false);
    setConfirming(false);
    pendingPdfRef.current = null;
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const reviewGroups = useMemo(() => {
    const rows = preview?.reviewRows ?? [];
    return {
      updated: rows.filter((r) => r.matchStatus === 'updated'),
      unchanged: rows.filter((r) => r.matchStatus === 'unchanged'),
      brandNew: rows.filter((r) => r.matchStatus === 'new'),
    };
  }, [preview]);

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
    setShowUnchanged(false);
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

  const importPdf = async (file, password) => {
    if (!file) return;
    setError('');
    setPhase('reading');
    setProgress({
      percent: 18,
      label: 'Reading PDF statement…',
      fileName: file.name || '',
    });
    try {
      const { parseStatementPdfToHoldings } = await import(
        '../lib/statementParsers/parseStatementHoldings'
      );
      const { rows, sourceLabel } = await parseStatementPdfToHoldings(file, { password });
      const editRows = mergeHoldingsToEditRows(rows);
      setProgress({ percent: 78, label: 'Matching holdings…', fileName: file.name || '' });
      pendingPdfRef.current = null;
      setPdfPassword('');
      await runPreview(editRows, sourceLabel);
    } catch (err) {
      const name = err?.name;
      if (name === 'PdfPasswordRequiredError' || name === 'PdfIncorrectPasswordError') {
        pendingPdfRef.current = file;
        setError(err.message);
        setPhase('password');
        return;
      }
      setError(err?.message ?? 'Could not read that statement PDF.');
      setPhase('pick');
      pendingPdfRef.current = null;
    } finally {
      setProgress(null);
      if (pdfRef.current) pdfRef.current.value = '';
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

  const confirm = async () => {
    if (!preview || confirming) return;
    const keepStale = preview.staleRows.filter((row) => !removeStaleIds.has(row.id));
    const withoutRemoved = preview.merged.filter(
      (row) => !row.missingFromImport || !removeStaleIds.has(row.id)
    );
    const finalRows = withoutRemoved.map((row) =>
      row.missingFromImport && keepStale.some((s) => s.id === row.id)
        ? { ...row, missingFromImport: true }
        : { ...row, missingFromImport: false }
    );
    setConfirming(true);
    setError('');
    try {
      await onApply?.(finalRows, {
        sourceLabel: preview.sourceLabel,
        removedStaleCount: removeStaleIds.size,
        unmappedCount: preview.unmappedCount,
      });
      onCloseRef.current?.();
    } catch (err) {
      setError(err?.message ?? 'Could not save holdings. Try again.');
      setConfirming(false);
    }
  };

  const { updated, unchanged, brandNew } = reviewGroups;
  const staleCount = preview?.staleRows?.length ?? 0;

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex justify-center bg-black/40 ${
        isDesktop ? 'items-center p-4' : 'items-end'
      }`}
      onClick={() => {
        if (!confirming) onCloseRef.current?.();
      }}
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
            onClick={() => {
              if (!confirming) onCloseRef.current?.();
            }}
            disabled={confirming}
            className="shrink-0 rounded-md p-1 text-pe-text-secondary hover:bg-pe-surface disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
          {phase === 'pick' ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-pe-text-secondary">
                Bring Excel, screenshots, or CDSL / CAMS / KFin / MF Central PDFs. Matching
                holdings update by quantity; symbols missing from the file are reviewed next.
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
                icon={<FileText className="h-5 w-5 text-pe-accent" />}
                title="PDF statement"
                description="CDSL demat CAS, CAMS/KFin CAS, or MF Central. Often locked with PAN."
                onClick={() => pdfRef.current?.click()}
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
              <input
                ref={pdfRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => void importPdf(event.target.files?.[0])}
              />
            </div>
          ) : null}

          {phase === 'password' ? (
            <div className="space-y-4">
              <p className="text-sm text-pe-text-secondary">
                This PDF is password-protected. Enter the password (often your PAN).
              </p>
              {error ? <p className="text-sm text-pe-negative">{error}</p> : null}
              <input
                type="password"
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
                placeholder="PDF password"
                className="w-full rounded-lg border border-pe-border-strong bg-pe-canvas px-3 py-2.5 text-base text-pe-text outline-none focus:border-pe-accent"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    pendingPdfRef.current = null;
                    setPdfPassword('');
                    setError('');
                    setPhase('pick');
                  }}
                  className="flex-1 rounded-xl border border-pe-border px-3 py-2.5 text-sm font-semibold text-pe-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!pdfPassword.trim() || !pendingPdfRef.current}
                  onClick={() => void importPdf(pendingPdfRef.current, pdfPassword.trim())}
                  className="flex-1 rounded-xl bg-pe-accent px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  Unlock PDF
                </button>
              </div>
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
              <div>
                <p className="text-sm text-pe-text-secondary">
                  Matched against your current book from{' '}
                  <span className="font-semibold text-pe-text">{preview.sourceLabel}</span>.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <SummaryChip
                    label="Qty changed"
                    count={updated.length}
                    tone="accent"
                  />
                  <SummaryChip label="Same qty" count={unchanged.length} tone="muted" />
                  <SummaryChip label="New" count={brandNew.length} tone="positive" />
                  <SummaryChip label="Not in file" count={staleCount} tone="amber" />
                </div>
              </div>

              {updated.length ? (
                <ReviewSection
                  title="Quantity changed"
                  subtitle="Already in your portfolio — qty from the file differs."
                  count={updated.length}
                >
                  {updated.map((row) => (
                    <HoldingRow
                      key={row.id}
                      row={row}
                      detail={`Qty ${formatQty(row.priorQty)} → ${formatQty(row.qty)}`}
                      status="updated"
                    />
                  ))}
                </ReviewSection>
              ) : null}

              {brandNew.length ? (
                <ReviewSection
                  title="New in this file"
                  subtitle="Not in your current portfolio yet."
                  count={brandNew.length}
                >
                  {brandNew.map((row) => (
                    <HoldingRow
                      key={row.id}
                      row={row}
                      detail={`Qty ${formatQty(row.qty)}`}
                      status="new"
                    />
                  ))}
                </ReviewSection>
              ) : null}

              {unchanged.length ? (
                <ReviewSection
                  title="Already up to date"
                  subtitle="Same holding and quantity — no change on confirm."
                  count={unchanged.length}
                  collapsible
                  expanded={showUnchanged || unchanged.length <= 4}
                  onToggle={() => setShowUnchanged((v) => !v)}
                >
                  {unchanged.map((row) => (
                    <HoldingRow
                      key={row.id}
                      row={row}
                      detail={`Qty ${formatQty(row.qty)}`}
                      status="unchanged"
                    />
                  ))}
                </ReviewSection>
              ) : null}

              {preview.staleRows.length ? (
                <section>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold text-pe-text">
                        Not in this file ({preview.staleRows.length})
                      </p>
                      <p className="mt-0.5 text-[12px] text-pe-text-secondary">
                        Keep in My Portfolio, or mark to remove on confirm.
                      </p>
                    </div>
                  </div>
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
                        <li
                          key={row.id}
                          className="flex items-center justify-between gap-2 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-pe-text">
                              {holdingDisplayLabel(row) || row.ticker}
                            </p>
                            <p className="text-[12px] text-amber-800">
                              Qty {formatQty(row.qty)} · missing from file
                            </p>
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

              {error && phase === 'review' ? (
                <p className="text-sm text-pe-negative">{error}</p>
              ) : null}

              <button
                type="button"
                onClick={() => void confirm()}
                disabled={confirming}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-pe-accent text-[14px] font-bold text-white hover:bg-pe-accent-pressed disabled:opacity-70"
              >
                {confirming ? 'Saving…' : 'Confirm merge'}
              </button>
              <p className="text-center text-[11px] text-pe-text-muted">
                Saves to My Portfolio — no extra Save step
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

function formatQty(value) {
  if (value == null || value === '') return '—';
  const n = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n)) return String(value);
  return String(n);
}

function SummaryChip({ label, count, tone }) {
  if (!count) {
    return (
      <span className="rounded-full border border-pe-border bg-pe-surface px-2.5 py-1 text-[11px] font-semibold text-pe-text-muted">
        {label} 0
      </span>
    );
  }
  const toneClass =
    tone === 'accent'
      ? 'border-pe-accent/30 bg-pe-accent-wash text-pe-accent'
      : tone === 'positive'
        ? 'border-pe-positive/25 bg-pe-positive/10 text-pe-positive'
        : tone === 'amber'
          ? 'border-amber-300 bg-amber-50 text-amber-900'
          : 'border-pe-border bg-white text-pe-text-secondary';
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>
      {label} {count}
    </span>
  );
}

function ReviewSection({
  title,
  subtitle,
  count,
  children,
  collapsible = false,
  expanded = true,
  onToggle,
}) {
  const show = !collapsible || expanded;
  return (
    <section>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-pe-text">
            {title} ({count})
          </p>
          {subtitle ? (
            <p className="mt-0.5 text-[12px] text-pe-text-secondary">{subtitle}</p>
          ) : null}
        </div>
        {collapsible ? (
          <button
            type="button"
            onClick={onToggle}
            className="shrink-0 text-[12px] font-semibold text-pe-accent"
          >
            {show ? 'Hide' : 'Show'}
          </button>
        ) : null}
      </div>
      {show ? (
        <ul className="mt-2 divide-y divide-pe-border rounded-lg border border-pe-border bg-white">
          {children}
        </ul>
      ) : null}
    </section>
  );
}

function HoldingRow({ row, detail, status }) {
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-pe-text">
          {holdingDisplayLabel(row) || row.ticker}
        </p>
        <p className="text-[12px] text-pe-text-muted">{detail}</p>
      </div>
      <StatusPill status={status} />
    </li>
  );
}

function SourceCard({ icon, title, description, badge, onClick, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl border border-pe-border bg-white px-3.5 py-3.5 text-left transition hover:border-pe-accent disabled:cursor-not-allowed disabled:opacity-55"
    >
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pe-accent-wash">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-semibold text-pe-text">{title}</span>
          {badge ? (
            <span className="rounded-full bg-pe-surface px-2 py-0.5 text-[11px] font-semibold text-pe-text-muted">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-pe-text-secondary">
          {description}
        </span>
      </span>
    </button>
  );
}

function StatusPill({ status }) {
  const label =
    status === 'new'
      ? 'New'
      : status === 'updated'
        ? 'Updated'
        : status === 'unchanged'
          ? 'Same'
          : status;
  const className =
    status === 'new'
      ? 'bg-pe-positive/10 text-pe-positive'
      : status === 'updated'
        ? 'bg-pe-accent-wash text-pe-accent'
        : 'bg-pe-surface text-pe-text-muted';
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${className}`}>
      {label}
    </span>
  );
}
