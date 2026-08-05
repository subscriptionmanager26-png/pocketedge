import { ArrowRight } from 'lucide-react';
import { FormStatusIcon } from '../../components/FormStatusIcons';
import AuthLayoutHeader from '../../components/AuthLayoutHeader';
import OnboardingShell, { primaryBtnClass } from './OnboardingShell';

export function AnalyzingStep({ holdings }) {
  return (
    <div className="flex min-h-dvh flex-col bg-pe-canvas text-pe-text">
      <AuthLayoutHeader badge="Analysing" />
      <div className="mx-auto flex w-full max-w-feed flex-1 flex-col justify-center px-4 py-10">
        <p className="text-center text-2xl font-bold text-pe-text md:text-3xl">Reading form…</p>
        <p className="mt-2 text-center text-[15px] text-pe-text-secondary">
          {holdings.length} holding{holdings.length === 1 ? '' : 's'}
        </p>
        <div className="mx-auto mt-10 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-pe-surface">
          <div className="h-full w-2/5 animate-pulse rounded-full bg-pe-accent" />
        </div>
      </div>
    </div>
  );
}

export default function AnalysisStep({
  summary,
  finishing = false,
  finishError = '',
  unmappedCount = 0,
  onFinish,
}) {
  const cards = [
    { key: 'in_form', label: 'In Form', count: summary?.buckets?.in_form?.length ?? 0, tone: 'positive' },
    {
      key: 'out_of_form',
      label: 'Out of Form',
      count: summary?.buckets?.out_of_form?.length ?? 0,
      tone: 'negative',
    },
    { key: 'unsure', label: 'Neutral', count: summary?.buckets?.unsure?.length ?? 0, tone: 'muted' },
    {
      key: 'unmapped',
      label: 'Unmapped',
      count: unmappedCount,
      tone: 'warn',
    },
  ];

  const headline = summary?.headline || 'Your form check';

  return (
    <OnboardingShell
      badge={null}
      footer={
        <>
          {finishError ? (
            <p className="mb-2 text-[12px] text-pe-negative">{finishError}</p>
          ) : null}
          <button
            type="button"
            onClick={onFinish}
            disabled={finishing}
            className={primaryBtnClass}
          >
            <span>{finishing ? 'Saving…' : 'Enter PocketEdge'}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      }
    >
      <h1 className="text-center text-2xl font-bold tracking-tight text-pe-text md:text-3xl">
        {headline}
      </h1>
      <p className="mx-auto mt-2 max-w-[22rem] text-center text-[15px] leading-snug text-pe-text-secondary">
        See these stocks on your Portfolio page.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <ResultCard
            key={card.key}
            form={card.key === 'unmapped' ? null : card.key}
            label={card.label}
            count={card.count}
            tone={card.tone}
          />
        ))}
      </div>

      {unmappedCount > 0 ? (
        <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-[13px] leading-relaxed text-amber-900">
          {unmappedCount} holding{unmappedCount === 1 ? '' : 's'} couldn’t be mapped.
          Correct them anytime from your Profile page.
        </p>
      ) : null}
    </OnboardingShell>
  );
}

function ResultCard({ form, label, count, tone }) {
  const wrap =
    tone === 'positive'
      ? 'border-pe-positive/25 bg-pe-positive/8'
      : tone === 'negative'
        ? 'border-pe-negative/25 bg-pe-negative/8'
        : tone === 'warn'
          ? 'border-amber-200 bg-amber-50'
          : 'border-pe-border bg-pe-surface';
  const valueClass =
    tone === 'positive'
      ? 'text-pe-positive'
      : tone === 'negative'
        ? 'text-pe-negative'
        : tone === 'warn'
          ? 'text-amber-800'
          : 'text-pe-text';

  return (
    <div className={`flex flex-col items-center rounded-2xl border px-3 py-5 ${wrap}`}>
      {tone === 'warn' || !form ? (
        <span className="grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-[20px] font-bold text-amber-800">
          ?
        </span>
      ) : (
        <FormStatusIcon form={form} className="h-12 w-12" />
      )}
      <p className={`mt-3 text-[28px] font-bold tabular-nums ${valueClass}`}>{count}</p>
      <p className="mt-1 text-[12px] font-bold uppercase tracking-[0.04em] text-pe-text-muted">
        {label}
      </p>
    </div>
  );
}
