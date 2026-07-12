/** Map legacy 1–5 star ratings onto Bullish / Neutral / Bearish signals. */
export const SIGNAL_OPTIONS = [
  { id: 'bearish', label: 'Bearish', rating: 1 },
  { id: 'neutral', label: 'Neutral', rating: 3 },
  { id: 'bullish', label: 'Bullish', rating: 5 },
];

export function signalFromRating(rating) {
  const value = Number(rating) || 0;
  if (value <= 2) return 'bearish';
  if (value >= 4) return 'bullish';
  if (value === 3) return 'neutral';
  return null;
}

export function ratingFromSignal(signalId) {
  return SIGNAL_OPTIONS.find((option) => option.id === signalId)?.rating ?? 0;
}

export function signalLabelFromRating(rating) {
  const id = signalFromRating(rating);
  return SIGNAL_OPTIONS.find((option) => option.id === id)?.label ?? null;
}

const TONE = {
  bearish: {
    active: 'border-pe-negative bg-pe-negative/10 text-pe-negative',
    idle: 'border-pe-border-strong text-pe-text-secondary hover:border-pe-negative/40 hover:text-pe-negative',
  },
  neutral: {
    active: 'border-pe-text-muted bg-pe-surface text-pe-text',
    idle: 'border-pe-border-strong text-pe-text-secondary hover:border-pe-text-muted hover:text-pe-text',
  },
  bullish: {
    active: 'border-pe-positive bg-pe-positive/10 text-pe-positive',
    idle: 'border-pe-border-strong text-pe-text-secondary hover:border-pe-positive/40 hover:text-pe-positive',
  },
};

export function SignalDisplay({ rating, size = 'md' }) {
  const id = signalFromRating(rating);
  const label = signalLabelFromRating(rating);
  if (!id || !label) return null;

  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center rounded-md border font-bold uppercase tracking-wide ${pad} ${TONE[id].active}`}
    >
      {label}
    </span>
  );
}

export default function SignalPicker({ value, onChange }) {
  const selected = signalFromRating(value);

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Signal">
      {SIGNAL_OPTIONS.map((option) => {
        const active = selected === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange?.(option.rating)}
            className={`rounded-lg border px-3 py-2.5 text-sm font-bold transition ${
              active ? TONE[option.id].active : TONE[option.id].idle
            }`}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
