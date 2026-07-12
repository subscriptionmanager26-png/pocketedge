import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import HoldingsEditTable, {
  emptyHoldingRow,
  validateHoldingsRows,
} from './HoldingsEditTable';
import OnboardingShell, { primaryBtnClass } from './OnboardingShell';

export default function ManualStep({ onBack, onSubmit }) {
  const [rows, setRows] = useState([emptyHoldingRow(), emptyHoldingRow()]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');

  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setFieldErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSubmit = () => {
    const result = validateHoldingsRows(rows);
    setFieldErrors(result.errors);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError('');
    onSubmit(result.holdings, 'manual');
  };

  return (
    <OnboardingShell
      onBack={onBack}
      badge="Manual"
      footer={
        <>
          {error ? <p className="mb-2 text-[13px] text-pe-negative">{error}</p> : null}
          <button type="button" onClick={handleSubmit} className={primaryBtnClass}>
            <span>Analyse the portfolio</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      }
    >
      <p className="text-2xl font-bold text-pe-text md:text-3xl">Add your holdings</p>
      <p className="mt-2 text-[15px] leading-relaxed text-pe-text-secondary">
        Enter ticker, total investment, and quantity — same as editing a portfolio in
        PocketEdge. Works for any broker, including Zerodha.
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
