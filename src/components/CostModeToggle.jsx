import { COST_MODES } from '../lib/portfolioEdit';

/** Switch live holding cost input between total invested and avg buy price. */
export default function CostModeToggle({ value, onChange }) {
  return (
    <div
      className="flex w-fit gap-1 rounded-lg bg-pe-surface p-1"
      role="group"
      aria-label="Cost input mode"
    >
      <button
        type="button"
        onClick={() => onChange(COST_MODES.invested)}
        className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${
          value === COST_MODES.invested
            ? 'bg-pe-canvas text-pe-text shadow-sm'
            : 'text-pe-text-muted hover:text-pe-text'
        }`}
      >
        Total invested
      </button>
      <button
        type="button"
        onClick={() => onChange(COST_MODES.avg)}
        className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${
          value === COST_MODES.avg
            ? 'bg-pe-canvas text-pe-text shadow-sm'
            : 'text-pe-text-muted hover:text-pe-text'
        }`}
      >
        Avg price
      </button>
    </div>
  );
}
