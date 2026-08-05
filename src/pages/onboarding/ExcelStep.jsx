import { useRef, useState } from 'react';
import { ArrowRight, FileSpreadsheet, Plus } from 'lucide-react';

import {
  countFilledHoldings,
  sumTotalInvested,
  validateHoldingsRows,
} from './HoldingsEditTable';
import { hashFileContent } from './importDedupe';
import { mergeHoldingsToEditRows } from './onboardingHoldings';
import OnboardingShell, { primaryBtnClass } from './OnboardingShell';
import { parseZerodhaHoldingsWorkbook } from './zerodhaHoldingsWorkbook';

function formatInr(value) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

/** Data fingerprint in case two differently named files carry the same book. */
export function holdingsDataKey(rows) {
  return rows
    .map((row) => {
      const ticker = String(row.ticker ?? '')
        .trim()
        .toUpperCase();
      const qty = Number(row.qty) || 0;
      const invested = Number(row.invested) || 0;
      return `${ticker}:${qty}:${Math.round(invested * 100)}`;
    })
    .filter((part) => !part.startsWith(':'))
    .sort()
    .join('|');
}

const EMPTY_DRAFT = {
  rows: [],
  fileNames: [],
  contentKeys: [],
  dataKeys: [],
};

export default function ExcelStep({ draft, onDraftChange, onBack, onSubmit }) {
  const inputRef = useRef(null);
  const draftRef = useRef(draft ?? EMPTY_DRAFT);
  draftRef.current = draft ?? EMPTY_DRAFT;

  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');

  const rows = draft?.rows ?? [];
  const fileNames = draft?.fileNames ?? [];
  const validated = validateHoldingsRows(rows);
  const ready = validated.ok;
  const holdingCount = countFilledHoldings(rows);
  const invested = sumTotalInvested(rows);

  const parseFile = async (nextFile) => {
    if (!nextFile || reading) return;
    setReading(true);
    setError('');
    try {
      const current = draftRef.current;
      const contentKey = await hashFileContent(nextFile);
      if (current.contentKeys.includes(contentKey)) {
        setError('That Excel file is already added.');
        return;
      }

      const parsed = await parseZerodhaHoldingsWorkbook(nextFile);
      const check = validateHoldingsRows(parsed);
      if (!check.ok) {
        throw new Error(check.message || 'Could not read holdings from this file.');
      }

      const dataKey = holdingsDataKey(parsed);
      if (current.dataKeys.includes(dataKey)) {
        setError('Those holdings are already in this upload.');
        return;
      }

      const nextRows = current.rows.length
        ? mergeHoldingsToEditRows([...current.rows, ...parsed])
        : parsed;
      onDraftChange?.({
        rows: nextRows,
        fileNames: [...current.fileNames, nextFile.name],
        contentKeys: [...current.contentKeys, contentKey],
        dataKeys: [...current.dataKeys, dataKey],
      });
    } catch (err) {
      setError(err?.message ?? 'Could not read that holdings file.');
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const submit = () => {
    const result = validateHoldingsRows(rows);
    if (!result.ok) {
      setError(result.message || 'Could not read holdings from this file.');
      return;
    }
    onSubmit(result.holdings, 'zerodha-excel');
  };

  return (
    <OnboardingShell
      onBack={onBack}
      badge={null}
      footer={
        <>
          {error ? <p className="mb-2 text-[12px] text-pe-negative">{error}</p> : null}
          <button
            type="button"
            onClick={submit}
            disabled={!ready || reading}
            className={primaryBtnClass}
          >
            <span>{reading ? 'Reading…' : 'Analyse holdings'}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      }
    >
      <p className="text-center text-2xl font-bold text-pe-text md:text-3xl">Zerodha Excel</p>
      <p className="mt-2 text-center text-sm text-pe-text-muted">.xlsx · .xls</p>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(event) => parseFile(event.target.files?.[0])}
      />

      {reading ? (
        <div className="mt-8 rounded-2xl border border-pe-border bg-pe-surface px-5 py-10 text-center">
          <p className="text-[15px] font-semibold text-pe-text">Reading Excel…</p>
        </div>
      ) : ready ? (
        <div className="mt-8 space-y-3">
          <div className="rounded-2xl border border-pe-border bg-white px-4 py-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <p className="truncate text-[13px] font-semibold text-pe-text-muted">
              {fileNames.length === 1
                ? fileNames[0]
                : `${fileNames.length} Excel files`}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-pe-text-muted">
                  Total invested
                </p>
                <p className="mt-1 text-[22px] font-bold tabular-nums tracking-tight text-pe-text">
                  {formatInr(invested)}
                </p>
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-pe-text-muted">
                  Holdings
                </p>
                <p className="mt-1 text-[22px] font-bold tabular-nums tracking-tight text-pe-text">
                  {holdingCount}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-pe-border-strong bg-white px-4 py-5 text-[15px] font-semibold text-pe-text transition hover:border-pe-accent hover:bg-pe-accent-wash/40"
          >
            <Plus className="h-5 w-5 text-pe-accent" />
            Add More
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            parseFile(event.dataTransfer.files?.[0]);
          }}
          className="mt-8 flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-pe-border-strong bg-pe-surface px-5 py-12 text-center transition hover:border-pe-accent hover:bg-pe-accent-wash"
        >
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-pe-accent shadow-sm">
            <FileSpreadsheet className="h-7 w-7" />
          </span>
          <p className="mt-4 text-[15px] font-semibold text-pe-text">Drop or browse</p>
          <p className="mt-1 text-sm text-pe-text-muted">Zerodha only</p>
        </button>
      )}
    </OnboardingShell>
  );
}
