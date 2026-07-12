import { BearIcon, BullIcon, CactusIcon } from './FormStatusIcons';

/** Map legacy 1–5 star ratings onto Bullish / Neutral / Bearish signals. */
export const SIGNAL_OPTIONS = [
  { id: 'bearish', label: 'Bearish', rating: 1, Icon: BearIcon },
  { id: 'neutral', label: 'Neutral', rating: 3, Icon: CactusIcon },
  { id: 'bullish', label: 'Bullish', rating: 5, Icon: BullIcon },
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
    icon: 'text-pe-negative',
    active:
      'border-pe-negative/40 bg-pe-negative/10 text-pe-negative shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
    idle: 'border-pe-border bg-white text-pe-text-secondary hover:border-pe-negative/30 hover:text-pe-negative',
  },
  neutral: {
    icon: 'text-pe-text-muted',
    active:
      'border-pe-border-strong bg-pe-surface text-pe-text shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
    idle: 'border-pe-border bg-white text-pe-text-secondary hover:border-pe-border-strong hover:text-pe-text',
  },
  bullish: {
    icon: 'text-pe-positive',
    active:
      'border-pe-positive/40 bg-pe-positive/10 text-pe-positive shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
    idle: 'border-pe-border bg-white text-pe-text-secondary hover:border-pe-positive/30 hover:text-pe-positive',
  },
};

function SignalIcon({ id, className = 'h-5 w-5' }) {
  const option = SIGNAL_OPTIONS.find((entry) => entry.id === id);
  if (!option) return null;
  const Icon = option.Icon;
  return <Icon className={`${className} ${TONE[id].icon}`} />;
}

export function SignalDisplay({ rating, size = 'md' }) {
  const id = signalFromRating(rating);
  const label = signalLabelFromRating(rating);
  if (!id || !label) return null;

  const pad = size === 'sm' ? 'gap-1 px-2 py-0.5 text-[11px]' : 'gap-1.5 px-2.5 py-1 text-xs';
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <span
      className={`inline-flex items-center rounded-full border font-bold uppercase tracking-wide ${pad} ${TONE[id].active}`}
    >
      <SignalIcon id={id} className={iconSize} />
      {label}
    </span>
  );
}

export default function SignalPicker({ value, onChange }) {
  const selected = signalFromRating(value);

  return (
    <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="Signal">
      {SIGNAL_OPTIONS.map((option) => {
        const active = selected === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange?.(option.rating)}
            className={`flex flex-col items-center gap-2 rounded-[12px] border px-2 py-3.5 transition ${
              active ? TONE[option.id].active : TONE[option.id].idle
            }`}
            aria-pressed={active}
          >
            <SignalIcon id={option.id} className="h-7 w-7" />
            <span className="text-[12px] font-bold tracking-wide">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
