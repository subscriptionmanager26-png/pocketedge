import { useMemo, useState } from 'react';
import { ArrowRight, Pencil } from 'lucide-react';
import OnboardingShell, { primaryBtnClass } from './OnboardingShell';
import HoldingsEditTable, {
  emptyHoldingRow,
  validateHoldingsRows,
} from './HoldingsEditTable';

function formatInr(value) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function holdingsToEditRows(holdings) {
  const rows = (holdings ?? []).map((h) => {
    const qty = Number(h.qty) || 0;
    const avg = Number(h.avg) || 0;
    const invested = qty * avg;
    return {
      id: crypto.randomUUID(),
      ticker: h.ticker ?? '',
      name: h.name ?? '',
      invested: invested ? String(invested) : '',
      qty: qty ? String(qty) : '',
      avg: avg ? String(avg) : '',
    };
  });
  return rows.length ? rows : [emptyHoldingRow()];
}

function investedFromHoldings(holdings) {
  return (holdings ?? []).reduce((sum, h) => sum + (Number(h.qty) || 0) * (Number(h.avg) || 0), 0);
}

/** Confirm total invested; optional row edit if the figure looks off. */
export default function ConfirmInvestedStep({
  holdings,
  onConfirm,
  onChangeHoldings,
  onBack,
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState(() => holdingsToEditRows(holdings));
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');

  const totalInvested = useMemo(() => {
    if (editing) {
      return rows.reduce((sum, row) => {
        const invested = Number(row.invested);
        return sum + (Number.isFinite(invested) && invested > 0 ? invested : 0);
      }, 0);
    }
    return investedFromHoldings(holdings);
  }, [editing, rows, holdings]);

  const saveEdits = () => {
    const result = validateHoldingsRows(rows);
    setFieldErrors(result.errors);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError('');
    onChangeHoldings?.(result.holdings);
    setEditing(false);
  };

  if (editing) {
    return (
      <OnboardingShell
        onBack={() => {
          setEditing(false);
          setError('');
          setRows(holdingsToEditRows(holdings));
        }}
        badge="Edit"
        footer={
          <>
            {error ? <p className="mb-2 text-[12px] text-pe-negative">{error}</p> : null}
            <button type="button" onClick={saveEdits} className={primaryBtnClass}>
              Save changes
            </button>
          </>
        }
      >
        <p className="text-2xl font-bold text-pe-text">Fix holdings</p>
        <p className="mt-1 text-sm text-pe-text-secondary">Then we’ll re-check the total.</p>
        <div className="mt-6">
          <HoldingsEditTable
            rows={rows}
            fieldErrors={fieldErrors}
            onUpdateRow={(id, patch) =>
              setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
            }
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
      badge="Confirm"
      footer={
        <button type="button" onClick={onConfirm} className={primaryBtnClass}>
          <span>Looks right</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      }
    >
      <p className="text-center text-[13px] font-semibold uppercase tracking-[0.08em] text-pe-text-muted">
        Total invested
      </p>
      <p className="mt-3 text-center text-[40px] font-bold tracking-tight tabular-nums text-pe-text md:text-[48px]">
        {formatInr(totalInvested)}
      </p>
      <p className="mt-2 text-center text-[14px] text-pe-text-secondary">
        Across {holdings.length} holding{holdings.length === 1 ? '' : 's'}
      </p>

      <button
        type="button"
        onClick={() => {
          setRows(holdingsToEditRows(holdings));
          setEditing(true);
        }}
        className="mx-auto mt-10 flex items-center gap-1.5 text-[14px] font-semibold text-pe-accent"
      >
        <Pencil className="h-3.5 w-3.5" />
        Something looks off
      </button>
    </OnboardingShell>
  );
}
