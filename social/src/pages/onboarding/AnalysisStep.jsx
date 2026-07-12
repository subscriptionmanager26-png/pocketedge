import { ArrowRight } from 'lucide-react';
import { FormStatusIcon } from '../../components/FormStatusIcons';
import AuthLayoutHeader from '../../components/AuthLayoutHeader';
import OnboardingShell, { primaryBtnClass, sectionLabelClass } from './OnboardingShell';

export function AnalyzingStep({ holdings }) {
  return (
    <div className="flex min-h-dvh flex-col bg-pe-canvas text-pe-text">
      <AuthLayoutHeader badge="Analysing" />
      <div className="mx-auto flex w-full max-w-feed flex-1 flex-col justify-center px-4 py-10">
        <p className="text-2xl font-bold text-pe-text md:text-3xl">
          Reading your portfolio form
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-pe-text-secondary">
          Checking last close vs 50 DMA and 200 DMA for {holdings.length}{' '}
          {holdings.length === 1 ? 'holding' : 'holdings'}.
        </p>

        <div className="mt-8 h-1.5 w-full overflow-hidden rounded-full bg-pe-surface">
          <div className="h-full w-2/5 animate-pulse rounded-full bg-pe-accent" />
        </div>

        <ul className="mt-8 divide-y divide-pe-border rounded-lg border border-pe-border">
          {holdings.slice(0, 6).map((h) => (
            <li
              key={h.ticker}
              className="flex items-center justify-between px-4 py-3 text-[13px]"
            >
              <span className="font-semibold text-pe-text">{h.ticker}</span>
              <span className="text-pe-text-muted">comparing averages…</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function formatInr(value) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

export default function AnalysisStep({
  rows,
  summary,
  source,
  finishing = false,
  finishError = '',
  onFinish,
}) {
  const sections = [
    { key: 'in_form', title: 'In Form', items: summary.buckets.in_form },
    { key: 'out_of_form', title: 'Off Track', items: summary.buckets.out_of_form },
    { key: 'unsure', title: 'Unsure', items: summary.buckets.unsure },
  ];

  const sourceLabel =
    source === 'broker-screenshot' || source === 'zerodha-screenshot'
      ? 'broker screenshot'
      : source === 'manual'
        ? 'manual entry'
        : source;

  return (
    <OnboardingShell
      badge="Analysis"
      footer={
        <>
          {finishError ? (
            <p className="mb-2 text-[13px] text-pe-negative">{finishError}</p>
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
          <p className="mt-3 text-center text-[13px] text-pe-text-muted">
            We&apos;ll save this as your portfolio so you can keep editing in the app.
          </p>
        </>
      }
    >
      <p className="text-[13px] font-semibold text-pe-text-muted">Via {sourceLabel}</p>
      <p className="mt-2 text-2xl font-bold text-pe-text md:text-3xl">{summary.headline}</p>
      <p className="mt-2 text-[15px] leading-relaxed text-pe-text-secondary">
        {summary.detail}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3 border-t border-pe-border pt-8 sm:grid-cols-4">
        <Stat label="Holdings" value={String(rows.length)} />
        <Stat label="In Form" value={`${Math.round(summary.inFormShare)}%`} accent="positive" />
        <Stat
          label="Off Track"
          value={`${Math.round(summary.offTrackShare)}%`}
          accent="negative"
        />
        <Stat
          label="Unrealised"
          value={`${summary.pnlPct >= 0 ? '+' : ''}${summary.pnlPct.toFixed(1)}%`}
        />
      </div>

      <p className="mt-3 text-[13px] text-pe-text-muted">
        Portfolio value {formatInr(summary.totalValue)} · invested{' '}
        {formatInr(summary.totalInvested)}
      </p>

      <div className="mt-10 space-y-8">
        {sections.map((section) =>
          section.items.length ? (
            <div key={section.key}>
              <div className="mb-3 flex items-center gap-2">
                <FormStatusIcon form={section.key} className="h-5 w-5" />
                <p className={sectionLabelClass}>
                  {section.title}
                  <span className="ml-2 font-medium normal-case tracking-normal text-pe-text-muted">
                    {section.items.length}
                  </span>
                </p>
              </div>
              <ul className="divide-y divide-pe-border rounded-lg border border-pe-border">
                {section.items.map((row) => (
                  <li
                    key={row.ticker}
                    className="flex items-center justify-between gap-3 px-4 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-pe-text">{row.ticker}</p>
                      <p className="truncate text-[12px] text-pe-text-muted">
                        {row.qty} shares · avg {formatInr(row.avg)}
                        {row.ma50 != null && row.ma200 != null
                          ? ` · 50DMA ${formatInr(row.ma50)} · 200DMA ${formatInr(row.ma200)}`
                          : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[14px] font-semibold text-pe-text">
                        {formatInr(row.value)}
                      </p>
                      <p
                        className={`text-[12px] font-medium ${
                          row.pnlPct >= 0 ? 'text-pe-positive' : 'text-pe-negative'
                        }`}
                      >
                        {row.pnlPct >= 0 ? '+' : ''}
                        {row.pnlPct.toFixed(1)}%
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null
        )}
      </div>

      <p className="mt-10 text-[12px] leading-relaxed text-pe-text-muted">
        Form uses last close vs 50 and 200 day moving averages. This is not investment
        advice.
      </p>
    </OnboardingShell>
  );
}

function Stat({ label, value, accent }) {
  const valueClass =
    accent === 'positive'
      ? 'text-pe-positive'
      : accent === 'negative'
        ? 'text-pe-negative'
        : 'text-pe-text';
  return (
    <div className="rounded-lg border border-pe-border bg-pe-surface px-3 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
        {label}
      </p>
      <p className={`mt-1 text-[22px] font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
