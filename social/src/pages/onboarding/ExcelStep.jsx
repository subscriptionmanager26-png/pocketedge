import { useRef, useState } from 'react';
import { ArrowRight, FileSpreadsheet } from 'lucide-react';

import HoldingsEditTable, {
  emptyHoldingRow,
  validateHoldingsRows,
} from './HoldingsEditTable';
import OnboardingShell, { primaryBtnClass, sectionLabelClass } from './OnboardingShell';
import { parseZerodhaHoldingsWorkbook } from './zerodhaHoldingsWorkbook';

export default function ExcelStep({ onBack, onSubmit }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [phase, setPhase] = useState('upload');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');

  const parseFile = async (nextFile) => {
    if (!nextFile) return;
    setFile(nextFile);
    setError('');
    setPhase('reading');
    try {
      setRows(await parseZerodhaHoldingsWorkbook(nextFile));
      setPhase('review');
    } catch (err) {
      setPhase('upload');
      setError(err?.message ?? 'Could not read that holdings file.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setFieldErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const submit = () => {
    const result = validateHoldingsRows(rows);
    setFieldErrors(result.errors);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSubmit(result.holdings, 'zerodha-excel');
  };

  if (phase === 'reading') {
    return (
      <OnboardingShell badge="Excel">
        <p className="text-2xl font-bold text-pe-text md:text-3xl">Reading your holdings file</p>
        <p className="mt-2 text-[15px] leading-relaxed text-pe-text-secondary">
          Parsing {file?.name ?? 'your Zerodha statement'} on your device…
        </p>
      </OnboardingShell>
    );
  }

  if (phase === 'review') {
    return (
      <OnboardingShell
        onBack={() => {
          setPhase('upload');
          setRows([]);
          setFieldErrors({});
          setError('');
        }}
        badge="Summary"
        footer={
          <>
            {error ? <p className="mb-2 text-[13px] text-pe-negative">{error}</p> : null}
            <button type="button" onClick={submit} className={primaryBtnClass}>
              <span>Analyse the portfolio</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        }
      >
        <p className="text-2xl font-bold text-pe-text md:text-3xl">Review your holdings summary</p>
        <p className="mt-2 text-[15px] leading-relaxed text-pe-text-secondary">
          Parsed from {file?.name}. Edit anything that looks off, then analyse.
        </p>
        <div className="mt-8 border-t border-pe-border pt-8">
          <HoldingsEditTable
            rows={rows}
            fieldErrors={fieldErrors}
            onUpdateRow={updateRow}
            onRemoveRow={(id) =>
              setRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.id !== id)))
            }
            onAddRow={() => setRows((prev) => [...prev, emptyHoldingRow()])}
          />
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      onBack={onBack}
      badge="Excel"
      footer={
        <>
          {error ? <p className="mb-2 text-[13px] text-pe-negative">{error}</p> : null}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={primaryBtnClass}
          >
            <span>Choose Excel file</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      }
    >
      <p className="text-2xl font-bold text-pe-text md:text-3xl">Upload your Zerodha holdings</p>
      <p className="mt-2 text-[15px] leading-relaxed text-pe-text-secondary">
        Upload the Excel holdings statement exported from Zerodha. Equity and Mutual Fund
        holdings are read locally; the file is not uploaded to our servers.
      </p>
      <div className="mt-8 border-t border-pe-border pt-8">
        <p className={sectionLabelClass}>Zerodha holdings statement</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            parseFile(event.dataTransfer.files?.[0]);
          }}
          className="mt-3 flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-pe-border-strong bg-pe-surface px-5 py-10 text-center transition hover:border-pe-accent hover:bg-pe-accent-wash"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-pe-accent-wash text-pe-accent">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <p className="mt-3 text-[15px] font-semibold text-pe-text">Drop an Excel file or browse</p>
          <p className="mt-1 text-sm text-pe-text-muted">One .xlsx or .xls file · Zerodha only</p>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(event) => parseFile(event.target.files?.[0])}
        />
      </div>
    </OnboardingShell>
  );
}
