import { ArrowRight } from 'lucide-react';
import { FormStatusIcon } from '../../components/FormStatusIcons';
import OnboardingShell, { primaryBtnClass } from './OnboardingShell';

const SIGNALS = [
  {
    form: 'out_of_form',
    label: 'Out of Form',
    meaning: 'Stocks that are below their trendline',
    tone: 'negative',
  },
  {
    form: 'unsure',
    label: 'Neutral',
    meaning: 'No clear signal',
    tone: 'muted',
  },
  {
    form: 'in_form',
    label: 'In Form',
    meaning: 'Stocks that are above their trendline',
    tone: 'positive',
  },
];

export default function AttractStep({ onContinue, onSkip }) {
  return (
    <OnboardingShell
      badge={null}
      footer={
        <>
          <button type="button" onClick={onContinue} className={primaryBtnClass}>
            <span>Check Now</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          {onSkip ? (
            <button
              type="button"
              onClick={onSkip}
              className="mt-3 w-full py-2 text-center text-[14px] font-semibold text-pe-text-muted transition hover:text-pe-text"
            >
              Check Later
            </button>
          ) : null}
        </>
      }
    >
      <h1 className="text-center text-[28px] font-bold tracking-tight text-pe-text md:text-[32px]">
        Are your holdings doing well?
      </h1>
      <p className="mx-auto mt-2 max-w-[22rem] text-center text-[15px] leading-snug text-pe-text-secondary">
        Each holding gets a clear signal based on 200 and 50 DMA.
      </p>

      <div className="mx-auto mt-10 flex w-full max-w-md flex-col gap-3">
        {SIGNALS.map((signal) => (
          <SignalCard key={signal.form} {...signal} />
        ))}
      </div>
    </OnboardingShell>
  );
}

function SignalCard({ form, label, meaning, tone }) {
  const labelClass =
    tone === 'positive'
      ? 'text-pe-positive'
      : tone === 'negative'
        ? 'text-pe-negative'
        : 'text-pe-text-muted';

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-pe-border bg-white px-4 py-4 text-left">
      <FormStatusIcon form={form} className="h-12 w-12 shrink-0" />
      <div className="min-w-0">
        <p className={`text-[15px] font-bold leading-tight ${labelClass}`}>{label}</p>
        <p className="mt-1 text-[13px] leading-snug text-pe-text-muted">{meaning}</p>
      </div>
    </div>
  );
}
